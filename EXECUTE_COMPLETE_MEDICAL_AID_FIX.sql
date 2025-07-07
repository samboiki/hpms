-- COMPLETE MEDICAL AID BILLING FIX
-- This will fix ALL medical aid patients who are incorrectly being charged
-- Execute this in Supabase SQL Editor

-- Step 1: Show current problem - how many medical aid patients are being charged
SELECT 
    'BEFORE FIX - PROBLEM SUMMARY' as status,
    COUNT(DISTINCT inv.patient_id) as medical_aid_patients_being_charged,
    COUNT(*) as incorrect_services,
    SUM(svc.patient_portion) as total_incorrect_charges
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;

-- Step 2: Show specific patients and amounts being incorrectly charged
SELECT 
    'PATIENTS BEING INCORRECTLY CHARGED' as status,
    p.first_name || ' ' || p.last_name as patient_name,
    mad.provider as medical_aid_provider,
    inv.invoice_number,
    svc.code as service_code,
    svc.total_price,
    svc.medical_aid_covered,
    svc.patient_portion as incorrect_charge
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0
ORDER BY p.last_name, inv.created_at DESC;

-- Step 3: Fix ALL medical aid services - make medical aid cover 100%, patient pay 0
UPDATE invoice_services 
SET 
    medical_aid_covered = total_price,
    patient_portion = 0,
    updated_at = NOW()
WHERE invoice_id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
) 
AND patient_portion > 0;

-- Step 4: Update invoice totals to match the corrected services
UPDATE invoices_enhanced 
SET 
    medical_aid_total = (
        SELECT COALESCE(SUM(medical_aid_covered), 0) 
        FROM invoice_services 
        WHERE invoice_id = invoices_enhanced.id
    ),
    patient_total = (
        SELECT COALESCE(SUM(patient_portion), 0) 
        FROM invoice_services 
        WHERE invoice_id = invoices_enhanced.id
    ),
    total = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM invoice_services 
        WHERE invoice_id = invoices_enhanced.id
    ),
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
);

-- Step 5: Verify the fix worked - should show 0 medical aid patients being charged
SELECT 
    'AFTER FIX - VERIFICATION' as status,
    COUNT(DISTINCT inv.patient_id) as medical_aid_patients_still_being_charged,
    COUNT(*) as remaining_incorrect_services,
    SUM(svc.patient_portion) as remaining_incorrect_charges
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;

-- Step 6: Show sample of corrected invoices
SELECT 
    'CORRECTED INVOICES SAMPLE' as status,
    inv.invoice_number,
    p.first_name || ' ' || p.last_name as patient_name,
    mad.provider as medical_aid_provider,
    inv.total as invoice_total,
    inv.medical_aid_total,
    inv.patient_total,
    CASE 
        WHEN inv.patient_total = 0 THEN '✅ CORRECT - Patient pays N$ 0.00'
        ELSE '❌ STILL INCORRECT'
    END as status_check
FROM invoices_enhanced inv
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE inv.invoice_number IN ('INV250619682', 'INV250627384', 'INV250650031', 'INV-2025-000006')
ORDER BY inv.created_at DESC;

-- Step 7: Overall medical aid billing summary
SELECT 
    'FINAL MEDICAL AID BILLING SUMMARY' as summary_type,
    COUNT(DISTINCT p.id) as total_medical_aid_patients,
    COUNT(DISTINCT inv.id) as total_invoices,
    COUNT(svc.id) as total_services,
    SUM(svc.total_price) as total_service_value,
    SUM(svc.medical_aid_covered) as total_medical_aid_coverage,
    SUM(svc.patient_portion) as total_patient_payments,
    CASE 
        WHEN SUM(svc.patient_portion) = 0 THEN '✅ ALL CORRECT - No medical aid patients are being charged'
        ELSE '❌ STILL HAVE ISSUES'
    END as overall_status
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

SELECT 'SUCCESS: All medical aid patients should now pay N$ 0.00!' as final_message;