-- 🔧 FIX EXISTING INVOICE TOTALS
-- Run this AFTER the NUCLEAR_BILLING_FIX.sql to update existing invoices

-- Update all existing invoices with calculated totals
UPDATE invoices_enhanced 
SET 
    subtotal = COALESCE(service_totals.subtotal_calc, 0),
    tax = COALESCE(service_totals.tax_calc, 0),
    total = COALESCE(service_totals.total_calc, 0),
    medical_aid_total = COALESCE(service_totals.medical_aid_calc, 0),
    patient_total = COALESCE(service_totals.patient_calc, 0),
    updated_at = NOW()
FROM (
    SELECT 
        invoice_id,
        SUM(total_price) as subtotal_calc,
        SUM(total_price) * 0.15 as tax_calc,
        SUM(total_price) * 1.15 as total_calc,
        SUM(medical_aid_covered) as medical_aid_calc,
        SUM(patient_portion) as patient_calc
    FROM invoice_services 
    GROUP BY invoice_id
) AS service_totals
WHERE invoices_enhanced.id = service_totals.invoice_id;

-- Show results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Updated % invoices with calculated totals', updated_count;
END $$;

-- Verify the updates
SELECT 
    invoice_number,
    subtotal,
    tax,
    total,
    medical_aid_total,
    patient_total
FROM invoices_enhanced 
WHERE subtotal > 0
ORDER BY created_at DESC
LIMIT 10;