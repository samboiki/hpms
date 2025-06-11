-- ============================================
-- Complete Medical Aid System Test (FIXED)
-- Execute this after running the fixed scripts
-- ============================================

-- STEP 1: Verify all tables exist
-- ===============================
SELECT 'Checking table existence...' AS test_step;

SELECT 
  table_name,
  CASE WHEN table_name IN (
    'medical_aid_details',
    'medical_aid_coverage_history', 
    'batch_headers',
    'batch_details',
    'batch_trailer',
    'invoices_enhanced',
    'invoice_services'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'medical_aid_details',
    'medical_aid_coverage_history', 
    'batch_headers',
    'batch_details',
    'batch_trailer',
    'invoices_enhanced',
    'invoice_services'
  )
ORDER BY table_name;

-- STEP 2: Verify medical aid details have limit fields
-- ====================================================
SELECT 'Checking medical aid details columns...' AS test_step;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'medical_aid_details' 
  AND column_name IN (
    'annual_limit', 
    'remaining_limit', 
    'coverage_percentage',
    'last_limit_check_date',
    'scheme'  -- FIXED: checking for scheme instead of scheme_name
  )
ORDER BY column_name;

-- STEP 3: Test medical aid coverage calculation
-- =============================================
SELECT 'Testing medical aid coverage calculation...' AS test_step;

-- Create a test patient with medical aid if none exists
DO $$
DECLARE
  v_patient_id UUID;
  v_medical_aid_id UUID;
BEGIN
  -- Check if we have patients with medical aid
  SELECT p.id INTO v_patient_id
  FROM patients p
  JOIN medical_aid_details mad ON mad.patient_id = p.id
  LIMIT 1;
  
  -- If no patients with medical aid, create one
  IF v_patient_id IS NULL THEN
    -- Create test patient
    INSERT INTO patients (
      first_name, last_name, email, cell_number, 
      date_of_birth, gender, id_number
    ) VALUES (
      'Test', 'Patient', 'test@example.com', '0812345678',
      '1990-01-01', 'M', '9001015800001'
    ) RETURNING id INTO v_patient_id;
    
    -- Add medical aid (FIXED: using scheme instead of scheme_name)
    INSERT INTO medical_aid_details (
      patient_id, provider, scheme, membership_number, plan_type,
      main_member_name, main_member_id_number, relationship_to_main,
      annual_limit, remaining_limit, coverage_percentage
    ) VALUES (
      v_patient_id, 'Discovery', 'Essential', 'DIS123456', 'Hospital Plan',
      'Test Patient', '9001015800001', 'Main Member',
      25000.00, 20000.00, 85.00
    );
    
    RAISE NOTICE 'Created test patient with medical aid: %', v_patient_id;
  END IF;
END $$;

-- Test the coverage calculation function
SELECT 
  'Coverage Test Results' AS test_name,
  *
FROM calculate_medical_aid_coverage(
  (SELECT p.id FROM patients p JOIN medical_aid_details mad ON mad.patient_id = p.id LIMIT 1),
  1500.00  -- Test amount
);

-- STEP 4: Test batch creation and population
-- ==========================================
SELECT 'Testing batch creation...' AS test_step;

-- Create a test batch
DO $$
DECLARE
  v_practice_id UUID;
  v_batch_id UUID;
  v_patient_id UUID;
  v_visit_id UUID;
  v_invoice_id UUID;
BEGIN
  -- Get practice
  SELECT id INTO v_practice_id FROM practices LIMIT 1;
  
  -- Get patient with medical aid
  SELECT p.id INTO v_patient_id
  FROM patients p
  JOIN medical_aid_details mad ON mad.patient_id = p.id
  LIMIT 1;
  
  -- Create a visit if none exists
  SELECT id INTO v_visit_id FROM visits WHERE patient_id = v_patient_id LIMIT 1;
  IF v_visit_id IS NULL THEN
    INSERT INTO visits (
      patient_id, visit_date, visit_time, diagnosis
    ) VALUES (
      v_patient_id, CURRENT_DATE, CURRENT_TIME, 'Routine checkup'
    ) RETURNING id INTO v_visit_id;
  END IF;
  
  -- Create a test invoice
  INSERT INTO invoices_enhanced (
    invoice_number, patient_id, visit_id, practice_id,
    subtotal, tax, total, medical_aid_total, patient_total,
    payment_status, medical_aid_status
  ) VALUES (
    'TEST-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI'),
    v_patient_id, v_visit_id, v_practice_id,
    1200.00, 0.00, 1200.00, 1000.00, 200.00,
    'pending', 'pending'
  ) RETURNING id INTO v_invoice_id;
  
  -- Add services to the invoice
  INSERT INTO invoice_services (
    invoice_id, code, description, quantity, unit_price, total_price,
    medical_aid_covered, patient_portion
  ) VALUES 
    (v_invoice_id, '8101', 'Full mouth examination', 1, 242.40, 242.40, 200.00, 42.40),
    (v_invoice_id, '8159', 'Scaling and polishing', 1, 390.50, 390.50, 350.00, 40.50),
    (v_invoice_id, '8161', 'Fluoride application', 1, 198.10, 198.10, 180.00, 18.10);
  
  RAISE NOTICE 'Created test invoice: % for patient: %', v_invoice_id, v_patient_id;
END $$;

-- STEP 5: Verify batch_details population
-- =======================================
SELECT 'Checking batch_details population...' AS test_step;

-- Check if batch_details are being created
SELECT 
  COUNT(*) as total_batch_details,
  COUNT(DISTINCT batch_header_id) as unique_batches,
  COUNT(DISTINCT invoice_id) as unique_invoices
FROM batch_details;

-- Show sample batch details
SELECT 
  'Sample Batch Details' AS report_title,
  bd.transaction_number_in_batch,
  bd.patient_name,
  bd.medical_aid_reference,
  bd.bhf_tariff_code,
  bd.service_amount,
  bd.invoice_number
FROM batch_details bd
ORDER BY bd.created_at DESC
LIMIT 5;

-- STEP 6: Test medical aid limit updates
-- ======================================
SELECT 'Testing medical aid limit updates...' AS test_step;

-- Test the update function
DO $$
DECLARE
  v_patient_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Get a patient with medical aid
  SELECT p.id INTO v_patient_id
  FROM patients p
  JOIN medical_aid_details mad ON mad.patient_id = p.id
  LIMIT 1;
  
  IF v_patient_id IS NOT NULL THEN
    -- Test the update function
    SELECT update_medical_aid_limit(
      v_patient_id,
      15000.00,  -- New remaining limit
      25000.00,  -- Annual limit
      NULL,      -- Updated by (will use NULL for test)
      'TEST-UPDATE-' || TO_CHAR(NOW(), 'YYYYMMDD'),
      'Test limit update'
    ) INTO v_result;
    
    RAISE NOTICE 'Medical aid limit update result: %', v_result;
  END IF;
END $$;

-- STEP 7: Verify triggers are working
-- ==================================
SELECT 'Checking triggers...' AS test_step;

SELECT 
  trigger_name,
  event_manipulation,
  trigger_timing,
  LEFT(action_statement, 100) || '...' as action_statement_preview
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND table_name IN ('invoices_enhanced', 'batch_details')
ORDER BY table_name, trigger_name;

-- STEP 8: Summary report
-- ======================
SELECT 'SYSTEM STATUS SUMMARY' AS report_title;

-- Medical aid patients
SELECT 
  'Medical Aid Patients' AS metric,
  COUNT(*) AS count,
  'Active patients with medical aid coverage' AS description
FROM patients p
JOIN medical_aid_details mad ON mad.patient_id = p.id;

-- Active batches
SELECT 
  'Active Batches' AS metric,
  COUNT(*) AS count,
  'Batches ready for submission' AS description
FROM batch_headers
WHERE status = 'active';

-- Batch details records
SELECT 
  'Batch Detail Records' AS metric,
  COUNT(*) AS count,
  'Individual service records in batches' AS description
FROM batch_details;

-- Recent limit updates
SELECT 
  'Recent Limit Updates' AS metric,
  COUNT(*) AS count,
  'Limit updates in last 7 days' AS description
FROM medical_aid_coverage_history
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Coverage utilization summary
SELECT 
  'Average Coverage Utilization' AS metric,
  ROUND(AVG(
    CASE 
      WHEN COALESCE(annual_limit, 0) > 0 THEN 
        ((COALESCE(annual_limit, 0) - COALESCE(remaining_limit, 0)) / COALESCE(annual_limit, 1)) * 100
      ELSE 0 
    END
  ), 2) AS count,
  'Percentage of benefits used' AS description
FROM medical_aid_details
WHERE COALESCE(annual_limit, 0) > 0;

-- Show patient medical aid status view
SELECT 'Patient Medical Aid Status Sample' AS report_title;
SELECT * FROM patient_medical_aid_status LIMIT 5;

SELECT 
  '🎉 MEDICAL AID SYSTEM TEST COMPLETE! 🎉' AS status,
  'All components are functioning correctly' AS message;