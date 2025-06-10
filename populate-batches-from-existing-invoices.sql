-- Script to populate batch data from existing invoices_enhanced table
-- This creates sample batches for testing

-- 1. First, let's see what invoices we have
SELECT 
  i.id,
  i.invoice_number,
  i.total,
  i.payment_status,
  p.first_name || ' ' || p.last_name as patient_name,
  mad.provider as medical_aid_provider,
  map.medical_aid_reference
FROM invoices_enhanced i
LEFT JOIN patients p ON p.id = i.patient_id
LEFT JOIN medical_aid_details mad ON mad.patient_id = i.patient_id
LEFT JOIN medical_aid_providers map ON map.name = mad.provider
WHERE i.medical_aid_status != 'not_submitted' OR mad.provider IS NOT NULL
LIMIT 20;

-- 2. Create active batches for each medical aid provider
DO $$
DECLARE
  v_practice_id UUID;
  v_batch_id UUID;
  v_medical_aid RECORD;
  v_invoice RECORD;
BEGIN
  -- Get a practice ID (assuming NewCharm)
  SELECT id INTO v_practice_id FROM practices WHERE practice_number = '0540001133241' LIMIT 1;
  
  IF v_practice_id IS NULL THEN
    SELECT id INTO v_practice_id FROM practices WHERE slug = 'newcharm-dental' LIMIT 1;
  END IF;
  
  -- Create a batch for each medical aid provider
  FOR v_medical_aid IN 
    SELECT DISTINCT medical_aid_reference, name 
    FROM medical_aid_providers 
    WHERE medical_aid_reference IS NOT NULL
  LOOP
    -- Create new batch
    v_batch_id := create_new_batch(v_practice_id, v_medical_aid.medical_aid_reference, CURRENT_DATE);
    
    RAISE NOTICE 'Created batch % for %', v_batch_id, v_medical_aid.name;
    
    -- Add invoices to this batch
    FOR v_invoice IN 
      SELECT DISTINCT i.id
      FROM invoices_enhanced i
      JOIN patients p ON p.id = i.patient_id
      LEFT JOIN medical_aid_details mad ON mad.patient_id = i.patient_id
      LEFT JOIN medical_aid_providers map ON map.name = mad.provider
      WHERE map.medical_aid_reference = v_medical_aid.medical_aid_reference
        AND i.batch_id IS NULL  -- Not already in a batch
        AND i.payment_status = 'pending'  -- Only pending invoices
      LIMIT 5  -- Limit to 5 invoices per batch for testing
    LOOP
      -- Add invoice to batch
      PERFORM add_invoice_to_batch(v_batch_id, v_invoice.id);
      RAISE NOTICE 'Added invoice % to batch', v_invoice.id;
    END LOOP;
  END LOOP;
END $$;

-- 3. Create some sample invoices if none exist
DO $$
DECLARE
  v_practice_id UUID;
  v_patient RECORD;
  v_visit RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_counter INTEGER := 1;
BEGIN
  -- Get practice ID
  SELECT id INTO v_practice_id FROM practices WHERE practice_number = '0540001133241' LIMIT 1;
  
  -- Only create sample invoices if we have less than 10
  IF (SELECT COUNT(*) FROM invoices_enhanced) < 10 THEN
    -- Create invoices for patients with medical aid
    FOR v_patient IN 
      SELECT DISTINCT p.id as patient_id, mad.provider, map.medical_aid_reference
      FROM patients p
      JOIN medical_aid_details mad ON mad.patient_id = p.id
      JOIN medical_aid_providers map ON map.name = mad.provider
      JOIN visits v ON v.patient_id = p.id
      WHERE map.medical_aid_reference IS NOT NULL
      LIMIT 10
    LOOP
      -- Generate invoice number
      v_invoice_number := 'INV-2025-' || LPAD(v_counter::TEXT, 6, '0');
      
      -- Get a visit for this patient
      SELECT id INTO v_visit FROM visits WHERE patient_id = v_patient.patient_id ORDER BY visit_date DESC LIMIT 1;
      
      -- Create invoice
      INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        visit_id,
        practice_id,
        issue_date,
        due_date,
        subtotal,
        tax,
        total,
        medical_aid_total,
        patient_total,
        payment_status,
        medical_aid_status
      ) VALUES (
        v_invoice_number,
        v_patient.patient_id,
        v_visit.id,
        v_practice_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE + INTERVAL '20 days',
        1500.00,
        0.00,
        1500.00,
        1200.00,
        300.00,
        'pending',
        'not_submitted'
      ) RETURNING id INTO v_invoice_id;
      
      -- Add some services
      INSERT INTO invoice_services (
        invoice_id,
        code,
        description,
        quantity,
        unit_price,
        total_price,
        medical_aid_covered,
        patient_portion
      ) VALUES 
        (v_invoice_id, '8101', 'Full mouth examination and charting', 1, 242.40, 242.40, 200.00, 42.40),
        (v_invoice_id, '8110', 'Provision of sterilised instruments', 1, 73.10, 73.10, 60.00, 13.10),
        (v_invoice_id, '8159', 'Scaling and polishing', 1, 390.50, 390.50, 350.00, 40.50),
        (v_invoice_id, '8161', 'Topical application of fluoride', 1, 198.10, 198.10, 180.00, 18.10);
      
      v_counter := v_counter + 1;
      RAISE NOTICE 'Created invoice % for patient %', v_invoice_number, v_patient.patient_id;
    END LOOP;
  END IF;
END $$;

-- 4. Show batch summary
SELECT 
  bh.medical_aid_reference,
  map.name as medical_aid_name,
  bh.batch_number,
  bh.status,
  bh.total_invoices,
  bh.total_amount,
  bh.batch_date,
  p.name as practice_name
FROM batch_headers bh
JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
JOIN practices p ON p.id = bh.practice_id
WHERE bh.status = 'active'
ORDER BY bh.medical_aid_reference, bh.batch_number;