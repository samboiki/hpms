-- ============================================
-- Complete Batch Population System
-- This will populate your batch tables with existing data
-- AND set up automatic triggers for future invoices
-- ============================================

-- PART 1: Create automatic trigger for new invoices
-- ================================================

-- Function to automatically add invoice to appropriate batch
CREATE OR REPLACE FUNCTION auto_add_invoice_to_batch()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_medical_aid_ref VARCHAR(10);
  v_practice_id UUID;
  v_patient RECORD;
  v_medical_aid RECORD;
  v_service RECORD;
  v_transaction_number INTEGER;
BEGIN
  -- Only process if invoice has medical aid coverage
  IF NEW.medical_aid_status IS NULL OR NEW.medical_aid_status = 'not_submitted' THEN
    -- Get patient and medical aid details
    SELECT p.*, mad.provider, mad.membership_number, mad.main_member_name
    INTO v_patient
    FROM patients p
    LEFT JOIN medical_aid_details mad ON mad.patient_id = p.id
    WHERE p.id = NEW.patient_id;
    
    -- Skip if no medical aid
    IF v_patient.provider IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get medical aid reference
    SELECT medical_aid_reference INTO v_medical_aid_ref
    FROM medical_aid_providers
    WHERE name = v_patient.provider
    LIMIT 1;
    
    -- Skip if no matching medical aid provider
    IF v_medical_aid_ref IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get or create active batch for this medical aid
    SELECT id INTO v_batch_id
    FROM batch_headers
    WHERE practice_id = NEW.practice_id
      AND medical_aid_reference = v_medical_aid_ref
      AND status = 'active'
      AND batch_date = CURRENT_DATE
    LIMIT 1;
    
    -- Create new batch if none exists
    IF v_batch_id IS NULL THEN
      v_batch_id := create_new_batch(NEW.practice_id, v_medical_aid_ref, CURRENT_DATE);
    END IF;
    
    -- Add invoice to batch
    PERFORM add_invoice_to_batch(v_batch_id, NEW.id);
    
    -- Update invoice with batch_id
    UPDATE invoices_enhanced SET batch_id = v_batch_id WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new invoices
DROP TRIGGER IF EXISTS auto_batch_new_invoices ON invoices_enhanced;
CREATE TRIGGER auto_batch_new_invoices
AFTER INSERT ON invoices_enhanced
FOR EACH ROW
EXECUTE FUNCTION auto_add_invoice_to_batch();

-- PART 2: Populate existing invoices into batches
-- ================================================

DO $$
DECLARE
  v_practice RECORD;
  v_batch_id UUID;
  v_medical_aid RECORD;
  v_invoice RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting batch population process...';
  
  -- Get all practices with practice numbers
  FOR v_practice IN 
    SELECT DISTINCT p.id, p.name, p.practice_number
    FROM practices p
    WHERE p.practice_number IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing practice: % (%)', v_practice.name, v_practice.practice_number;
    
    -- Create batches for each medical aid
    FOR v_medical_aid IN 
      SELECT DISTINCT medical_aid_reference, name 
      FROM medical_aid_providers 
      WHERE medical_aid_reference IS NOT NULL
    LOOP
      -- Create new batch
      v_batch_id := create_new_batch(v_practice.id, v_medical_aid.medical_aid_reference, CURRENT_DATE);
      RAISE NOTICE '  Created batch for %', v_medical_aid.name;
      
      -- Add all pending invoices for this medical aid to the batch
      FOR v_invoice IN 
        SELECT DISTINCT i.id, i.invoice_number
        FROM invoices_enhanced i
        JOIN patients p ON p.id = i.patient_id
        LEFT JOIN medical_aid_details mad ON mad.patient_id = i.patient_id
        LEFT JOIN medical_aid_providers map ON map.name = mad.provider
        WHERE i.practice_id = v_practice.id
          AND map.medical_aid_reference = v_medical_aid.medical_aid_reference
          AND i.batch_id IS NULL  -- Not already in a batch
          AND (i.payment_status = 'pending' OR i.payment_status IS NULL)
          AND (i.medical_aid_status != 'rejected' OR i.medical_aid_status IS NULL)
      LOOP
        -- Add invoice to batch
        PERFORM add_invoice_to_batch(v_batch_id, v_invoice.id);
        v_count := v_count + 1;
        RAISE NOTICE '    Added invoice %', v_invoice.invoice_number;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Batch population completed. Added % invoices to batches.', v_count;
END $$;

-- PART 3: Create some test invoices if your system has none
-- ================================================

DO $$
DECLARE
  v_practice_id UUID;
  v_patient RECORD;
  v_invoice_id UUID;
  v_invoice_count INTEGER;
  v_service_count INTEGER := 0;
BEGIN
  -- Count existing invoices
  SELECT COUNT(*) INTO v_invoice_count FROM invoices_enhanced;
  
  IF v_invoice_count = 0 THEN
    RAISE NOTICE 'No invoices found. Creating test invoices...';
    
    -- Get a practice
    SELECT id INTO v_practice_id 
    FROM practices 
    WHERE practice_number IS NOT NULL 
    LIMIT 1;
    
    -- Create invoices for patients with medical aid
    FOR v_patient IN 
      SELECT p.id, p.first_name, p.last_name, v.id as visit_id, mad.provider
      FROM patients p
      JOIN visits v ON v.patient_id = p.id
      JOIN medical_aid_details mad ON mad.patient_id = p.id
      WHERE mad.provider IS NOT NULL
      LIMIT 10
    LOOP
      -- Create invoice
      INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        visit_id,
        practice_id,
        subtotal,
        tax,
        total,
        medical_aid_total,
        patient_total,
        payment_status,
        medical_aid_status
      ) VALUES (
        'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((v_invoice_count + 1)::TEXT, 6, '0'),
        v_patient.id,
        v_patient.visit_id,
        v_practice_id,
        1500.00,
        0.00,
        1500.00,
        1200.00,
        300.00,
        'pending',
        'pending'
      ) RETURNING id INTO v_invoice_id;
      
      -- Add services
      INSERT INTO invoice_services (invoice_id, code, description, quantity, unit_price, total_price, medical_aid_covered, patient_portion)
      VALUES 
        (v_invoice_id, '8101', 'Full mouth examination', 1, 242.40, 242.40, 200.00, 42.40),
        (v_invoice_id, '8159', 'Scaling and polishing', 1, 390.50, 390.50, 350.00, 40.50),
        (v_invoice_id, '8161', 'Fluoride application', 1, 198.10, 198.10, 180.00, 18.10);
      
      v_invoice_count := v_invoice_count + 1;
      v_service_count := v_service_count + 3;
      
      RAISE NOTICE 'Created invoice for % %', v_patient.first_name, v_patient.last_name;
    END LOOP;
    
    RAISE NOTICE 'Created % test invoices with % services', v_invoice_count, v_service_count;
  END IF;
END $$;

-- PART 4: Show results
-- ================================================

-- Show batch summary
SELECT 
  'Active Batches Summary' as report_type,
  bh.medical_aid_reference,
  map.name as medical_aid_name,
  COUNT(DISTINCT bh.id) as batch_count,
  SUM(bh.total_invoices) as total_invoices,
  SUM(bh.total_amount) as total_amount
FROM batch_headers bh
JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
WHERE bh.status = 'active'
GROUP BY bh.medical_aid_reference, map.name
ORDER BY bh.medical_aid_reference;

-- Show batch details count
SELECT 
  'Batch Details Count' as report_type,
  COUNT(*) as total_batch_details
FROM batch_details;

-- Show sample batch details
SELECT 
  'Sample Batch Details (First 5)' as report_type,
  bd.transaction_number_in_batch,
  bd.patient_name,
  bd.bhf_tariff_code,
  bd.service_amount,
  bd.invoice_number
FROM batch_details bd
LIMIT 5;

-- Final success message
SELECT 'Batch population complete! Check the tables above for results.' AS status;