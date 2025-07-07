-- SIMPLE MEDICAL AID FIX
-- This directly fixes all medical aid billing issues

-- Step 1: Fix invoice_services table for medical aid patients
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

-- Step 2: Fix invoices_enhanced table for medical aid patients
UPDATE invoices_enhanced 
SET 
    medical_aid_total = total,
    patient_total = 0,
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
    WHERE inv.patient_total > 0
);

-- Step 3: Create a simplified trigger that actually works
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
    
    -- Tariff prices are VAT inclusive, so no additional tax calculation needed
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

-- Step 4: Replace the problematic trigger
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_services;
CREATE TRIGGER update_invoice_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION fix_medical_aid_invoice_totals();