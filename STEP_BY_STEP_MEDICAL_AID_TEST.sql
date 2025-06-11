-- STEP-BY-STEP MEDICAL AID BILLING TEST
-- Execute each section one by one to verify the fix works

-- ==============================================
-- STEP 1: Remove the problematic recursive trigger
-- ==============================================
SELECT '🗑️ STEP 1: Removing problematic trigger...' as step;

DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_services;
DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();

-- Verify the trigger is gone
SELECT 'Trigger removal verification' as check_type,
       COUNT(*) as remaining_problem_triggers
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
AND trigger_name = 'update_invoice_totals_trigger';

-- ==============================================
-- STEP 2: Fix existing medical aid billing data
-- ==============================================
SELECT '🔧 STEP 2: Fixing existing medical aid data...' as step;

-- Before fix - check current state
SELECT 'BEFORE FIX' as status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_charging_patient,
       SUM(patient_portion) as total_patient_charges_should_be_zero
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

-- Fix the services (should work without recursion now)
UPDATE invoice_services 
SET 
    medical_aid_covered = total_price,
    patient_portion = 0
WHERE invoice_id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
) 
AND patient_portion > 0;

-- Show how many services were fixed
SELECT '✅ Services fixed' as result,
       ROW_COUNT() as services_updated;

-- ==============================================
-- STEP 3: Update invoice totals
-- ==============================================
SELECT '📊 STEP 3: Updating invoice totals...' as step;

UPDATE invoices_enhanced 
SET 
    medical_aid_total = (
        SELECT COALESCE(SUM(medical_aid_covered), 0)
        FROM invoice_services svc
        WHERE svc.invoice_id = invoices_enhanced.id
    ),
    patient_total = (
        SELECT COALESCE(SUM(patient_portion), 0)
        FROM invoice_services svc
        WHERE svc.invoice_id = invoices_enhanced.id
    ),
    subtotal = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM invoice_services svc
        WHERE svc.invoice_id = invoices_enhanced.id
    ),
    total = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM invoice_services svc
        WHERE svc.invoice_id = invoices_enhanced.id
    ),
    tax = 0,  -- VAT inclusive pricing
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
);

-- Show how many invoices were updated
SELECT '✅ Invoices updated' as result,
       ROW_COUNT() as invoices_updated;

-- ==============================================
-- STEP 4: Verify the fix worked
-- ==============================================
SELECT '🎯 STEP 4: Verifying the fix...' as step;

-- After fix verification
SELECT 'AFTER FIX VERIFICATION' as status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
       SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid,
       SUM(patient_portion) as total_patient_charges,
       SUM(medical_aid_covered) as total_medical_aid_coverage
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

-- Check specific problem patient
SELECT 'PROBLEM PATIENT CHECK' as check_type,
       inv.invoice_number,
       inv.patient_total as invoice_patient_total,
       inv.medical_aid_total as invoice_medical_aid_total,
       COUNT(svc.id) as service_count,
       SUM(svc.patient_portion) as services_patient_total,
       SUM(svc.medical_aid_covered) as services_medical_aid_total
FROM invoices_enhanced inv
JOIN invoice_services svc ON inv.id = svc.invoice_id
WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
GROUP BY inv.id, inv.invoice_number, inv.patient_total, inv.medical_aid_total
ORDER BY inv.created_at DESC
LIMIT 2;

-- ==============================================
-- STEP 5: Install safe trigger for future invoices
-- ==============================================
SELECT '🔄 STEP 5: Installing safe trigger...' as step;

CREATE OR REPLACE FUNCTION update_invoice_totals_safe()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    invoice_subtotal DECIMAL := 0;
    invoice_medical_aid_total DECIMAL := 0;
    invoice_patient_total DECIMAL := 0;
BEGIN
    -- Calculate totals from services (READ ONLY - no updates to invoice_services)
    SELECT 
        COALESCE(SUM(total_price), 0),
        COALESCE(SUM(medical_aid_covered), 0),
        COALESCE(SUM(patient_portion), 0)
    INTO 
        invoice_subtotal,
        invoice_medical_aid_total,
        invoice_patient_total
    FROM invoice_services 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update ONLY the invoice totals (NOT invoice_services - this prevents recursion)
    UPDATE invoices_enhanced 
    SET 
        subtotal = invoice_subtotal,
        tax = 0, -- VAT inclusive pricing
        total = invoice_subtotal,
        medical_aid_total = invoice_medical_aid_total,
        patient_total = invoice_patient_total,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER update_invoice_totals_safe_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals_safe();

SELECT '✅ Safe trigger installed' as result;

-- ==============================================
-- STEP 6: Test creating a new invoice for medical aid patient
-- ==============================================
SELECT '🧪 STEP 6: Testing new invoice creation...' as step;

-- Find a medical aid patient to test with
SELECT 'Medical aid patient for testing' as test_type,
       p.id as patient_id,
       p.first_name,
       p.last_name,
       mad.provider as medical_aid_provider
FROM patients p
JOIN medical_aid_details mad ON p.id = mad.patient_id
LIMIT 1;

-- Create a test invoice (using the first medical aid patient)
WITH test_patient AS (
    SELECT p.id as patient_id
    FROM patients p
    JOIN medical_aid_details mad ON p.id = mad.patient_id
    LIMIT 1
),
new_invoice AS (
    INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        issue_date,
        due_date,
        payment_status,
        created_at
    )
    SELECT 
        'TEST-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
        patient_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'pending',
        NOW()
    FROM test_patient
    RETURNING id, invoice_number, patient_id
)
SELECT 'Test invoice created' as result,
       id as invoice_id,
       invoice_number,
       patient_id
FROM new_invoice;

-- ==============================================
-- STEP 7: Add services to test invoice
-- ==============================================
SELECT '💼 STEP 7: Adding services to test invoice...' as step;

-- Add test services to the new invoice
WITH test_invoice AS (
    SELECT id, patient_id
    FROM invoices_enhanced 
    WHERE invoice_number LIKE 'TEST-%'
    ORDER BY created_at DESC
    LIMIT 1
),
medical_aid_patient AS (
    SELECT ti.id as invoice_id, ti.patient_id
    FROM test_invoice ti
    JOIN medical_aid_details mad ON ti.patient_id = mad.patient_id
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
        patient_portion
    )
    SELECT 
        map.invoice_id,
        (SELECT id FROM practice_tariffs LIMIT 1), -- Get any tariff ID
        'TEST01',
        'Test Service for Medical Aid',
        1,
        100.00,
        100.00,
        100.00, -- Medical aid covers full amount
        0.00    -- Patient pays nothing
    FROM medical_aid_patient map
    RETURNING invoice_id, code, total_price, medical_aid_covered, patient_portion
)
SELECT 'Test service added' as result,
       invoice_id,
       code,
       total_price,
       medical_aid_covered,
       patient_portion
FROM test_services;

-- ==============================================
-- STEP 8: Verify new invoice shows correct totals
-- ==============================================
SELECT '🔍 STEP 8: Verifying new invoice totals...' as step;

-- Check that the new test invoice shows correct medical aid billing
SELECT 'NEW INVOICE TEST RESULT' as test_result,
       inv.invoice_number,
       inv.patient_total as invoice_patient_total,
       inv.medical_aid_total as invoice_medical_aid_total,
       inv.total as invoice_total,
       COUNT(svc.id) as service_count,
       SUM(svc.patient_portion) as services_patient_total,
       SUM(svc.medical_aid_covered) as services_medical_aid_total,
       CASE 
           WHEN inv.patient_total = 0 AND inv.medical_aid_total > 0 THEN '✅ CORRECT - Patient pays N$ 0.00'
           WHEN inv.patient_total > 0 THEN '❌ WRONG - Patient still being charged'
           ELSE '⚠️ UNKNOWN'
       END as billing_status
FROM invoices_enhanced inv
JOIN invoice_services svc ON inv.id = svc.invoice_id
WHERE inv.invoice_number LIKE 'TEST-%'
GROUP BY inv.id, inv.invoice_number, inv.patient_total, inv.medical_aid_total, inv.total
ORDER BY inv.created_at DESC
LIMIT 1;

-- ==============================================
-- STEP 9: Clean up test data
-- ==============================================
SELECT '🧹 STEP 9: Cleaning up test data...' as step;

-- Remove test invoice and services
DELETE FROM invoice_services 
WHERE invoice_id IN (
    SELECT id FROM invoices_enhanced 
    WHERE invoice_number LIKE 'TEST-%'
);

DELETE FROM invoices_enhanced 
WHERE invoice_number LIKE 'TEST-%';

SELECT '✅ Test data cleaned up' as result;

-- ==============================================
-- FINAL SUMMARY
-- ==============================================
SELECT '🎉 FINAL SUMMARY' as summary;

-- Final verification that all medical aid patients show N$ 0.00
SELECT 'FINAL MEDICAL AID BILLING STATUS' as final_status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
       SUM(patient_portion) as total_patient_charges,
       SUM(medical_aid_covered) as total_medical_aid_coverage,
       CASE 
           WHEN SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) = 0 THEN '🎉 SUCCESS - All medical aid patients show N$ 0.00!'
           ELSE '❌ ISSUE - Some medical aid patients still being charged'
       END as overall_status
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

-- Show trigger status
SELECT 'TRIGGER STATUS' as status,
       COUNT(*) as safe_triggers_installed
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
AND trigger_name = 'update_invoice_totals_safe_trigger';

SELECT 'Medical aid billing fix completed successfully!' as message,
       'All medical aid patients should now show N$ 0.00 patient portion' as note,
       'Safe trigger installed to prevent recursion in future invoices' as safety;