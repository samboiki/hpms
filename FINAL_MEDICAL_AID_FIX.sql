-- FINAL MEDICAL AID FIX
-- Remove competing triggers and fix everything properly

-- Step 1: Remove the problematic old trigger
DROP TRIGGER IF EXISTS calculate_invoice_totals_trigger ON invoice_services;

-- Step 2: Update our trigger function to also fix individual service records
CREATE OR REPLACE FUNCTION public.fix_medical_aid_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    patient_has_medical_aid BOOLEAN := FALSE;
    invoice_total DECIMAL := 0;
BEGIN
    -- Get the invoice total
    SELECT COALESCE(SUM(total_price), 0) INTO invoice_total
    FROM invoice_services 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Check if patient has medical aid
    SELECT EXISTS(
        SELECT 1 
        FROM invoices_enhanced inv
        JOIN patients p ON inv.patient_id = p.id
        JOIN medical_aid_details mad ON p.id = mad.patient_id
        WHERE inv.id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ) INTO patient_has_medical_aid;
    
    -- STEP A: Fix all individual services for this invoice
    IF patient_has_medical_aid THEN
        -- Medical aid patient: Medical aid covers all services, patient pays nothing
        UPDATE invoice_services 
        SET 
            medical_aid_covered = total_price,
            patient_portion = 0
        WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSE
        -- Cash patient: Patient pays for all services
        UPDATE invoice_services 
        SET 
            medical_aid_covered = 0,
            patient_portion = total_price
        WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    END IF;
    
    -- STEP B: Fix invoice totals (VAT inclusive pricing)
    IF patient_has_medical_aid THEN
        -- Medical aid patient: Medical aid pays everything, patient pays nothing
        UPDATE invoices_enhanced 
        SET 
            subtotal = invoice_total,
            tax = 0,
            total = invoice_total,
            medical_aid_total = invoice_total,
            patient_total = 0,
            updated_at = NOW()
        WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSE
        -- Cash patient: Patient pays everything
        UPDATE invoices_enhanced 
        SET 
            subtotal = invoice_total,
            tax = 0,
            total = invoice_total,
            medical_aid_total = 0,
            patient_total = invoice_total,
            updated_at = NOW()
        WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Step 3: Fix all existing medical aid services that are still wrong
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

-- Step 4: Trigger a recalculation for the problematic invoice
UPDATE invoice_services 
SET medical_aid_covered = total_price
WHERE invoice_id = (
    SELECT inv.id 
    FROM invoices_enhanced inv
    WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
    ORDER BY inv.created_at DESC
    LIMIT 1
);

-- Step 5: Verification
SELECT 'FINAL VERIFICATION' as status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
       SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;