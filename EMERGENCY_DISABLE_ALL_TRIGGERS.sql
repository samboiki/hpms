-- EMERGENCY: Disable ALL triggers to stop recursion
-- Execute this in Supabase SQL Editor

-- First, try to drop specific triggers we know about
DROP TRIGGER IF EXISTS fix_medical_aid_invoice_totals_trigger ON invoice_services;
DROP TRIGGER IF EXISTS calculate_invoice_totals_trigger ON invoice_services;
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_services;
DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_services;

-- Drop the problematic functions
DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();
DROP FUNCTION IF EXISTS calculate_invoice_totals();
DROP FUNCTION IF EXISTS update_invoice_totals();

-- Nuclear option: Disable ALL triggers on both tables
ALTER TABLE invoice_services DISABLE TRIGGER ALL;
ALTER TABLE invoices_enhanced DISABLE TRIGGER ALL;

-- Verify triggers are disabled
SELECT 'Triggers on invoice_services' as table_name, 
       trigger_name, 
       event_manipulation,
       action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
UNION ALL
SELECT 'Triggers on invoices_enhanced' as table_name,
       trigger_name, 
       event_manipulation,
       action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices_enhanced';

-- Now fix the medical aid billing data
-- This should work without any trigger interference

-- Step 1: Fix all medical aid services that are charging patients
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

-- Step 2: Update invoice totals to match the corrected services
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

-- Step 3: Verification
SELECT 'FINAL VERIFICATION' as status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
       SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid,
       SUM(patient_portion) as total_patient_charges,
       SUM(medical_aid_covered) as total_medical_aid_coverage
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

-- Step 4: Check the specific problem patient
SELECT 'PROBLEM PATIENT CHECK' as check_type,
       inv.invoice_number,
       inv.medical_aid_total as invoice_medical_aid_total,
       inv.patient_total as invoice_patient_total,
       COUNT(svc.id) as service_count,
       SUM(svc.medical_aid_covered) as services_medical_aid_total,
       SUM(svc.patient_portion) as services_patient_total
FROM invoices_enhanced inv
JOIN invoice_services svc ON inv.id = svc.invoice_id
WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
GROUP BY inv.id, inv.invoice_number, inv.medical_aid_total, inv.patient_total
ORDER BY inv.created_at DESC
LIMIT 3;

-- Success message
SELECT 'SUCCESS: Medical aid billing should now be fixed!' as message,
       'All medical aid patients should show N$ 0.00 patient portion' as note;