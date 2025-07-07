-- NON-RECURSIVE MEDICAL AID FIX
-- This fixes the recursive trigger issue by removing the problematic trigger
-- and using a direct data fix approach instead

-- Step 1: Drop the problematic recursive trigger
DROP TRIGGER IF EXISTS fix_medical_aid_invoice_totals_trigger ON invoice_services;
DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();

-- Step 2: Direct data fix without triggers (bolt.new style)
-- Fix all medical aid services that are charging patients when they shouldn't

-- First, let's see what we're working with
SELECT 'BEFORE FIX - Medical Aid Services Still Charging Patient' as status,
       COUNT(*) as total_services_charging_patient,
       SUM(patient_portion) as total_patient_charges_that_should_be_zero
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;

-- Step 3: Fix all medical aid services in one go (NO TRIGGERS INVOLVED)
-- This is a direct UPDATE statement that bypasses any triggers
UPDATE invoice_services 
SET 
    medical_aid_covered = total_price,
    patient_portion = 0,
    updated_at = NOW()
WHERE id IN (
    SELECT svc.id
    FROM invoice_services svc
    JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
    WHERE svc.patient_portion > 0
);

-- Step 4: Fix invoice totals to match the corrected services
-- Update medical aid invoices to show correct totals
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
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT inv.id 
    FROM invoices_enhanced inv
    JOIN patients p ON inv.patient_id = p.id
    JOIN medical_aid_details mad ON p.id = mad.patient_id
);

-- Step 5: Create a simple, NON-RECURSIVE trigger for future invoice services
-- This trigger will NOT update invoice_services, only invoices_enhanced
CREATE OR REPLACE FUNCTION update_invoice_totals_only()
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
    
    -- Update ONLY the invoice totals (NOT invoice_services)
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

-- Step 6: Create trigger that only updates invoice totals (no recursion possible)
CREATE TRIGGER update_invoice_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals_only();

-- Step 7: Verification
SELECT 'AFTER FIX - Medical Aid Services Status' as status,
       COUNT(*) as total_medical_aid_services,
       SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
       SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid,
       SUM(patient_portion) as total_patient_charges,
       SUM(medical_aid_covered) as total_medical_aid_coverage
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id;

-- Step 8: Check specific problem invoice
SELECT 'SPECIFIC INVOICE CHECK' as check_type,
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