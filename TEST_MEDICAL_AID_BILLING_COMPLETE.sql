-- COMPLETE MEDICAL AID BILLING TEST
-- This tests the entire workflow from database to frontend

-- Step 1: Find a medical aid patient for testing
SELECT 'TEST PATIENT SELECTION' as test_step,
       p.id as patient_id,
       p.first_name,
       p.last_name,
       mad.provider as medical_aid_provider,
       mad.membership_number
FROM patients p
JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY p.created_at DESC
LIMIT 1;

-- Step 2: Create a test visit for this patient
WITH test_patient AS (
    SELECT p.id as patient_id
    FROM patients p
    JOIN medical_aid_details mad ON p.id = mad.patient_id
    ORDER BY p.created_at DESC
    LIMIT 1
),
new_test_visit AS (
    INSERT INTO visits (
        patient_id,
        visit_date,
        visit_time,
        visit_type,
        chief_complaint,
        diagnosis,
        treatment_plan,
        status,
        created_at
    )
    SELECT 
        patient_id,
        CURRENT_DATE,
        CURRENT_TIME,
        'consultation',
        'COMPLETE BILLING TEST - Medical Aid Patient',
        'Test diagnosis for billing verification',
        'Test treatment plan',
        'completed',
        NOW()
    FROM test_patient
    RETURNING id as visit_id, patient_id
)
SELECT 'TEST VISIT CREATED' as test_step,
       visit_id,
       patient_id
FROM new_test_visit;

-- Step 3: Create a test invoice
WITH test_visit AS (
    SELECT id as visit_id, patient_id
    FROM visits 
    WHERE chief_complaint = 'COMPLETE BILLING TEST - Medical Aid Patient'
    ORDER BY created_at DESC
    LIMIT 1
),
new_test_invoice AS (
    INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        visit_id,
        issue_date,
        due_date,
        payment_status,
        created_at
    )
    SELECT 
        'BILLING-TEST-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        patient_id,
        visit_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'pending',
        NOW()
    FROM test_visit
    RETURNING id as invoice_id, invoice_number, patient_id, visit_id
)
SELECT 'TEST INVOICE CREATED' as test_step,
       invoice_id,
       invoice_number,
       patient_id,
       visit_id
FROM new_test_invoice;

-- Step 4: Add test services (this will trigger our auto-fix function)
WITH test_invoice AS (
    SELECT id as invoice_id, patient_id
    FROM invoices_enhanced 
    WHERE invoice_number LIKE 'BILLING-TEST-%'
    ORDER BY created_at DESC
    LIMIT 1
),
get_tariff AS (
    SELECT id as tariff_id, code, description, price FROM practice_tariffs LIMIT 1
),
test_services AS (
    INSERT INTO invoice_services (
        invoice_id,
        tariff_id,
        code,
        description,
        quantity,
        unit_price,
        total_price,
        medical_aid_covered,
        patient_portion,
        notes
    )
    SELECT 
        ti.invoice_id,
        gt.tariff_id,
        gt.code,
        gt.description || ' - BILLING TEST',
        1,
        COALESCE(gt.price::decimal, 50.00),
        COALESCE(gt.price::decimal, 50.00),
        999.99, -- Intentionally wrong value - should be auto-fixed by trigger
        888.88, -- Intentionally wrong value - should be auto-fixed by trigger
        'Test service - values should be auto-fixed by trigger'
    FROM test_invoice ti, get_tariff gt
    RETURNING invoice_id, code, description, total_price, medical_aid_covered, patient_portion
)
SELECT 'TEST SERVICES ADDED' as test_step,
       invoice_id,
       code,
       description,
       total_price,
       medical_aid_covered,
       patient_portion,
       CASE 
           WHEN medical_aid_covered = total_price AND patient_portion = 0 THEN '✅ AUTO-FIX WORKED!'
           ELSE '❌ AUTO-FIX FAILED!'
       END as auto_fix_status
FROM test_services;

-- Step 5: Wait for triggers to process
SELECT pg_sleep(1);

-- Step 6: Verify the auto-fix worked
SELECT 'AUTO-FIX VERIFICATION' as test_step,
       svc.code,
       svc.description,
       svc.total_price,
       svc.medical_aid_covered,
       svc.patient_portion,
       inv.patient_total as invoice_patient_total,
       inv.medical_aid_total as invoice_medical_aid_total,
       CASE 
           WHEN svc.medical_aid_covered = svc.total_price AND svc.patient_portion = 0 THEN '✅ SERVICE LEVEL: CORRECT'
           ELSE '❌ SERVICE LEVEL: FAILED'
       END as service_status,
       CASE 
           WHEN inv.patient_total = 0 AND inv.medical_aid_total > 0 THEN '✅ INVOICE LEVEL: CORRECT'
           ELSE '❌ INVOICE LEVEL: FAILED'
       END as invoice_status
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
WHERE inv.invoice_number LIKE 'BILLING-TEST-%'
ORDER BY svc.created_at DESC
LIMIT 5;

-- Step 7: Test cash patient (should pay full amount)
WITH cash_patient AS (
    SELECT p.id as patient_id
    FROM patients p
    WHERE p.id NOT IN (SELECT patient_id FROM medical_aid_details)
    ORDER BY p.created_at DESC
    LIMIT 1
),
cash_visit AS (
    INSERT INTO visits (
        patient_id,
        visit_date,
        visit_time,
        visit_type,
        chief_complaint,
        diagnosis,
        treatment_plan,
        status,
        created_at
    )
    SELECT 
        patient_id,
        CURRENT_DATE,
        CURRENT_TIME,
        'consultation',
        'COMPLETE BILLING TEST - Cash Patient',
        'Test diagnosis for billing verification',
        'Test treatment plan',
        'completed',
        NOW()
    FROM cash_patient
    RETURNING id as visit_id, patient_id
),
cash_invoice AS (
    INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        visit_id,
        issue_date,
        due_date,
        payment_status,
        created_at
    )
    SELECT 
        'CASH-TEST-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        cv.patient_id,
        cv.visit_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'pending',
        NOW()
    FROM cash_visit cv
    RETURNING id as invoice_id, invoice_number, patient_id, visit_id
),
cash_service AS (
    INSERT INTO invoice_services (
        invoice_id,
        tariff_id,
        code,
        description,
        quantity,
        unit_price,
        total_price,
        medical_aid_covered,
        patient_portion,
        notes
    )
    SELECT 
        ci.invoice_id,
        (SELECT id FROM practice_tariffs LIMIT 1),
        'TEST02',
        'Cash Patient Test Service',
        1,
        75.00,
        75.00,
        999.99, -- Intentionally wrong - should be auto-fixed to 0
        0.01,   -- Intentionally wrong - should be auto-fixed to 75.00
        'Cash test service - should be auto-fixed'
    FROM cash_invoice ci
    RETURNING invoice_id, code, total_price, medical_aid_covered, patient_portion
)
SELECT 'CASH PATIENT TEST' as test_step,
       cs.code,
       cs.total_price,
       cs.medical_aid_covered,
       cs.patient_portion,
       CASE 
           WHEN cs.medical_aid_covered = 0 AND cs.patient_portion = cs.total_price THEN '✅ CASH AUTO-FIX WORKED!'
           ELSE '❌ CASH AUTO-FIX FAILED!'
       END as cash_auto_fix_status
FROM cash_service cs;

-- Step 8: Final verification
SELECT pg_sleep(1);

SELECT 'FINAL VERIFICATION' as test_step,
       'Medical Aid Services' as service_type,
       COUNT(*) as total_services,
       SUM(CASE WHEN patient_portion = 0 THEN 1 ELSE 0 END) as correctly_covered_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as incorrectly_charged_services,
       SUM(patient_portion) as total_patient_charges
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE inv.invoice_number LIKE 'BILLING-TEST-%';

SELECT 'FINAL VERIFICATION' as test_step,
       'Cash Patient Services' as service_type,
       COUNT(*) as total_services,
       SUM(CASE WHEN patient_portion = total_price THEN 1 ELSE 0 END) as correctly_charged_services,
       SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as incorrectly_covered_services,
       SUM(medical_aid_covered) as total_medical_aid_coverage
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
WHERE p.id NOT IN (SELECT patient_id FROM medical_aid_details)
AND inv.invoice_number LIKE 'CASH-TEST-%';

-- Step 9: Clean up test data
DELETE FROM invoice_services 
WHERE invoice_id IN (
    SELECT id FROM invoices_enhanced 
    WHERE invoice_number LIKE 'BILLING-TEST-%' OR invoice_number LIKE 'CASH-TEST-%'
);

DELETE FROM invoices_enhanced 
WHERE invoice_number LIKE 'BILLING-TEST-%' OR invoice_number LIKE 'CASH-TEST-%';

DELETE FROM visits 
WHERE chief_complaint IN (
    'COMPLETE BILLING TEST - Medical Aid Patient',
    'COMPLETE BILLING TEST - Cash Patient'
);

SELECT 'TEST CLEANUP COMPLETED' as test_step;

-- Step 10: Overall result
SELECT 
    'BILLING TEST COMPLETE' as final_result,
    'All medical aid patients should show N$ 0.00 patient portion' as expected_result,
    'All cash patients should show full amount as patient portion' as cash_expected,
    'Auto-fix trigger should correct any wrong values automatically' as safety_net;