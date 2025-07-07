-- FINAL MEDICAL AID BILLING FIX
-- Execute this in Supabase SQL Editor to fix remaining legacy data

-- Step 1: Fix existing medical aid services that are still charging patients
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

-- Step 2: Update invoice totals to reflect the changes
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
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
);

-- Step 3: Verification - Show remaining incorrect services
SELECT 
    'VERIFICATION' as check_type,
    COUNT(*) as medical_aid_services_still_charging_patients
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;

-- Step 4: Show sample of fixed services
SELECT 
    'SAMPLE FIXED SERVICES' as sample_type,
    inv.invoice_number,
    p.first_name || ' ' || p.last_name as patient_name,
    mad.provider as medical_aid,
    svc.code,
    svc.total_price,
    svc.medical_aid_covered,
    svc.patient_portion
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY svc.created_at DESC
LIMIT 5;

SELECT 'SUCCESS: All medical aid patients should now pay N$ 0.00!' as result;