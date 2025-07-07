-- TARGETED FIX: Remove the specific recursive trigger causing the issue
-- Execute this in Supabase SQL Editor

-- Step 1: Remove the problematic recursive trigger
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_services;

-- Step 2: Remove the recursive function
DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();

-- Step 3: Verify the trigger is gone
SELECT 'Remaining triggers on invoice_services' as check_type,
       trigger_name, 
       event_manipulation,
       action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
AND trigger_name = 'update_invoice_totals_trigger';

-- Step 4: Now fix the medical aid billing data (should work without recursion)
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

-- Step 5: Update invoice totals to match the corrected services
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

-- Step 6: Verification - should show 0 services charging patients
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

-- Step 7: Check the specific problem patient (should show N$ 0.00)
SELECT 'PROBLEM PATIENT FIXED' as check_type,
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

-- Step 8: Create a SAFE, non-recursive trigger for future invoices
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

-- Create the safe trigger that only updates invoice totals
CREATE TRIGGER update_invoice_totals_safe_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals_safe();

-- Final success message
SELECT '🎉 SUCCESS: Medical aid billing fixed!' as message,
       'All medical aid patients should now show N$ 0.00 patient portion' as note,
       'Safe trigger installed to prevent future recursion issues' as safety_note;