-- FINAL AUTO-FIX TRIGGER FOR MEDICAL AID BILLING
-- Execute this ENTIRE script in Supabase SQL Editor
-- This will fix the medical aid billing issue permanently

-- Step 1: Remove any existing auto-fix triggers
DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;
DROP FUNCTION IF EXISTS auto_fix_medical_aid_service_values();

-- Step 2: Create the auto-fix function
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

-- Step 3: Create the trigger
CREATE TRIGGER auto_fix_medical_aid_values_trigger
    BEFORE INSERT OR UPDATE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION auto_fix_medical_aid_service_values();

-- Step 4: Fix existing wrong medical aid services
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

-- Step 5: Update invoice totals to reflect the corrections
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

-- Step 6: Verification
SELECT 
    'TRIGGER INSTALLATION' as check_type,
    COUNT(*) as triggers_found
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services'
AND trigger_name = 'auto_fix_medical_aid_values_trigger';

SELECT 
    'MEDICAL AID SERVICES STATUS' as check_type,
    COUNT(*) as total_medical_aid_services,
    SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patients,
    SUM(patient_portion) as total_patient_charges_should_be_zero
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

SELECT 'SUCCESS: Auto-fix trigger installed and existing data corrected!' as result;