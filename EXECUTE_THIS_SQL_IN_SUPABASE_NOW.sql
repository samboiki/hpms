-- MEDICAL AID AUTO-FIX TRIGGER WITH SECURITY DEFINER
-- Execute this script in Supabase SQL Editor to permanently fix medical aid billing

-- Step 1: Clean up any existing triggers
DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;
DROP FUNCTION IF EXISTS auto_fix_medical_aid_service_values();

-- Step 2: Create function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.auto_fix_medical_aid_service_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL: Bypass RLS to access medical_aid_details
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
    ELSE
        -- Cash patient: Patient pays 100%, medical aid covers nothing
        NEW.medical_aid_covered := 0;
        NEW.patient_portion := NEW.total_price;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Step 3: Create the trigger
CREATE TRIGGER auto_fix_medical_aid_values_trigger
    BEFORE INSERT OR UPDATE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION auto_fix_medical_aid_service_values();

-- Success message
SELECT 'SUCCESS: Medical aid auto-fix trigger installed with SECURITY DEFINER!' as result;