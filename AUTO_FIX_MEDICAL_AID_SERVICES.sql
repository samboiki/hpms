-- AUTO-FIX MEDICAL AID SERVICES TRIGGER
-- This trigger automatically fixes medical aid values when services are inserted/updated

-- Step 1: Create function that auto-fixes medical aid service values
CREATE OR REPLACE FUNCTION auto_fix_medical_aid_service_values()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    patient_has_medical_aid BOOLEAN := FALSE;
    invoice_patient_id UUID;
BEGIN
    -- Get the patient ID from the invoice
    SELECT patient_id INTO invoice_patient_id
    FROM invoices_enhanced 
    WHERE id = NEW.invoice_id;
    
    -- Check if this patient has medical aid
    SELECT EXISTS(
        SELECT 1 FROM medical_aid_details 
        WHERE patient_id = invoice_patient_id
    ) INTO patient_has_medical_aid;
    
    -- Auto-fix the medical aid values based on patient's medical aid status
    IF patient_has_medical_aid THEN
        -- Medical aid patient: Medical aid covers 100%, patient pays nothing
        NEW.medical_aid_covered := NEW.total_price;
        NEW.patient_portion := 0;
        
        RAISE NOTICE 'AUTO-FIX: Medical aid patient - Service % set to medical_aid_covered=%, patient_portion=0', 
                     NEW.code, NEW.total_price;
    ELSE
        -- Cash patient: Patient pays 100%, medical aid covers nothing
        NEW.medical_aid_covered := 0;
        NEW.patient_portion := NEW.total_price;
        
        RAISE NOTICE 'AUTO-FIX: Cash patient - Service % set to medical_aid_covered=0, patient_portion=%', 
                     NEW.code, NEW.total_price;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Step 2: Create trigger that fires BEFORE INSERT/UPDATE on invoice_services
-- This will fix the values before they're saved to the database
DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;

CREATE TRIGGER auto_fix_medical_aid_values_trigger
    BEFORE INSERT OR UPDATE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION auto_fix_medical_aid_service_values();

-- Step 3: Test the trigger by checking if it exists
SELECT 'AUTO-FIX TRIGGER INSTALLED' as status,
       trigger_name,
       event_manipulation,
       action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
AND trigger_name = 'auto_fix_medical_aid_values_trigger';

-- Step 4: Fix any existing services that have wrong values
SELECT 'FIXING EXISTING SERVICES' as status;

-- Fix all existing medical aid services that are still charging patients
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

-- Fix all existing cash patient services that might have wrong values
UPDATE invoice_services 
SET 
    medical_aid_covered = 0,
    patient_portion = total_price
WHERE invoice_id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    WHERE p.id NOT IN (SELECT patient_id FROM medical_aid_details)
) 
AND medical_aid_covered > 0;

-- Step 5: Verification
SELECT 'VERIFICATION RESULTS' as check_type,
       'Medical aid services still charging patients' as description,
       COUNT(*) as count
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;

SELECT 'VERIFICATION RESULTS' as check_type,
       'Cash patient services incorrectly covered by medical aid' as description,
       COUNT(*) as count
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
WHERE p.id NOT IN (SELECT patient_id FROM medical_aid_details)
AND svc.medical_aid_covered > 0;

-- Step 6: Show sample of fixed services
SELECT 'SAMPLE FIXED SERVICES' as sample_type,
       svc.code,
       svc.description,
       svc.total_price,
       svc.medical_aid_covered,
       svc.patient_portion,
       CASE WHEN mad.id IS NOT NULL THEN 'MEDICAL AID PATIENT' ELSE 'CASH PATIENT' END as patient_type
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
LEFT JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY svc.created_at DESC
LIMIT 10;

SELECT 'SUCCESS: Auto-fix trigger installed and existing data corrected!' as message;