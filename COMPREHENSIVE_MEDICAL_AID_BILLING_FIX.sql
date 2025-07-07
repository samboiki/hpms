-- COMPREHENSIVE MEDICAL AID BILLING FIX
-- This script fixes the medical aid billing issue where medical aid patients are being charged

-- 1. First, let's check the current state
DO $$ 
BEGIN
    RAISE NOTICE '🔍 Checking current invoice services with medical aid issues...';
END $$;

-- Show problematic invoice services where patients with medical aid are being charged
SELECT 
    inv.invoice_number,
    inv.patient_id,
    inv.medical_aid_total,
    inv.patient_total,
    svc.code,
    svc.description,
    svc.medical_aid_covered,
    svc.patient_portion,
    mad.provider as medical_aid_provider
FROM invoices_enhanced inv
JOIN invoice_services svc ON inv.id = svc.invoice_id
LEFT JOIN medical_aid_details mad ON inv.patient_id = mad.patient_id
WHERE mad.id IS NOT NULL -- Patient has medical aid
  AND svc.patient_portion > 0 -- But patient is being charged
ORDER BY inv.created_at DESC
LIMIT 10;

-- 2. Fix the update_invoice_totals function to properly handle medical aid coverage
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    invoice_totals RECORD;
    patient_has_medical_aid BOOLEAN := FALSE;
BEGIN
    -- Check if patient has medical aid
    SELECT EXISTS(
        SELECT 1 FROM medical_aid_details mad 
        JOIN invoices_enhanced inv ON mad.patient_id = inv.patient_id 
        WHERE inv.id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ) INTO patient_has_medical_aid;
    
    -- Calculate totals for the affected invoice
    SELECT 
        COALESCE(SUM(total_price), 0) as subtotal_calc,
        COALESCE(SUM(total_price) * 0.15, 0) as tax_calc,
        COALESCE(SUM(total_price) * 1.15, 0) as total_calc,
        CASE 
            WHEN patient_has_medical_aid THEN COALESCE(SUM(total_price) * 1.15, 0) -- Medical aid covers everything including tax
            ELSE 0 
        END as medical_aid_calc,
        CASE 
            WHEN patient_has_medical_aid THEN 0 -- Patient pays nothing
            ELSE COALESCE(SUM(total_price) * 1.15, 0) -- Patient pays everything
        END as patient_calc
    INTO invoice_totals
    FROM invoice_services 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update the invoice with calculated totals
    UPDATE invoices_enhanced 
    SET 
        subtotal = invoice_totals.subtotal_calc,
        tax = invoice_totals.tax_calc,
        total = invoice_totals.total_calc,
        medical_aid_total = invoice_totals.medical_aid_calc,
        patient_total = invoice_totals.patient_calc,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3. Create or replace the batch_parent_invoice function to ensure proper medical aid handling
CREATE OR REPLACE FUNCTION public.batch_parent_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_invoice_id UUID := NEW.invoice_id;
    v_invoice RECORD;
    v_medical_aid_ref TEXT;
    v_batch_id UUID;
    patient_has_medical_aid BOOLEAN := FALSE;
BEGIN
    -- First, get the parent invoice details
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = v_invoice_id;

    -- CHECK 1: Has this invoice already been batched? If so, stop.
    IF v_invoice.batch_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- CHECK 2: Check if patient has medical aid
    SELECT EXISTS(
        SELECT 1 FROM medical_aid_details 
        WHERE patient_id = v_invoice.patient_id
    ) INTO patient_has_medical_aid;

    -- If patient has no medical aid, this is a cash invoice - stop batching
    IF NOT patient_has_medical_aid THEN
        RETURN NEW;
    END IF;

    -- CHECK 3: Find the patient's medical aid reference
    SELECT map.medical_aid_reference INTO v_medical_aid_ref
    FROM public.medical_aid_details mad
    JOIN public.medical_aid_providers map ON mad.medical_aid_provider_id = map.id
    WHERE mad.patient_id = v_invoice.patient_id
    LIMIT 1;

    IF v_medical_aid_ref IS NULL THEN
        -- Patient has medical aid but no provider reference
        RETURN NEW;
    END IF;

    -- Get the batch ID (or create a new batch)
    v_batch_id := get_or_create_active_batch_id(v_invoice.practice_id, v_medical_aid_ref);

    -- Add the invoice and ALL its services to the batch
    PERFORM add_invoice_to_batch(v_batch_id, v_invoice_id);

    RETURN NEW;
END;
$function$;

-- 4. Fix existing invoice services for patients with medical aid
DO $$ 
DECLARE
    service_record RECORD;
    patient_has_medical_aid BOOLEAN;
BEGIN
    RAISE NOTICE '🔧 Fixing existing invoice services for medical aid patients...';
    
    -- Loop through all invoice services where patient has medical aid but is being charged
    FOR service_record IN 
        SELECT DISTINCT 
            svc.id as service_id,
            svc.invoice_id,
            svc.total_price,
            inv.patient_id
        FROM invoice_services svc
        JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
        JOIN medical_aid_details mad ON inv.patient_id = mad.patient_id
        WHERE svc.patient_portion > 0 -- Patient is being charged
    LOOP
        -- Update the service to have medical aid cover it
        UPDATE invoice_services 
        SET 
            medical_aid_covered = service_record.total_price,
            patient_portion = 0,
            updated_at = NOW()
        WHERE id = service_record.service_id;
        
        RAISE NOTICE '✅ Fixed service ID % for invoice %', service_record.service_id, service_record.invoice_id;
    END LOOP;
    
    RAISE NOTICE '🎉 Completed fixing existing invoice services';
END $$;

-- 5. Trigger the invoice totals recalculation for all affected invoices
DO $$ 
DECLARE
    invoice_record RECORD;
BEGIN
    RAISE NOTICE '🔄 Recalculating invoice totals for medical aid patients...';
    
    -- Get all invoices for patients with medical aid
    FOR invoice_record IN 
        SELECT DISTINCT inv.id, inv.invoice_number
        FROM invoices_enhanced inv
        JOIN medical_aid_details mad ON inv.patient_id = mad.patient_id
        WHERE inv.patient_total > 0 -- Invoice shows patient owes money
    LOOP
        -- Force trigger the update by touching a service
        UPDATE invoice_services 
        SET updated_at = NOW() 
        WHERE invoice_id = invoice_record.id 
        LIMIT 1;
        
        RAISE NOTICE '✅ Recalculated totals for invoice %', invoice_record.invoice_number;
    END LOOP;
    
    RAISE NOTICE '🎉 Completed recalculating invoice totals';
END $$;

-- 6. Verify the fix
DO $$ 
BEGIN
    RAISE NOTICE '✅ VERIFICATION: Checking for any remaining medical aid billing issues...';
END $$;

-- Show any remaining problematic invoices
SELECT 
    'STILL_PROBLEMATIC' as status,
    inv.invoice_number,
    inv.patient_total,
    mad.provider as medical_aid_provider
FROM invoices_enhanced inv
JOIN medical_aid_details mad ON inv.patient_id = mad.patient_id
WHERE inv.patient_total > 0 -- Patient still being charged
ORDER BY inv.created_at DESC;

-- Show success cases
SELECT 
    'FIXED_CORRECTLY' as status,
    COUNT(*) as count_of_fixed_invoices
FROM invoices_enhanced inv
JOIN medical_aid_details mad ON inv.patient_id = mad.patient_id
WHERE inv.patient_total = 0 -- Patient not being charged
  AND inv.medical_aid_total > 0; -- Medical aid is covering

RAISE NOTICE '🎉 MEDICAL AID BILLING FIX COMPLETED!';
RAISE NOTICE 'ℹ️  From now on, all patients with medical aid will have:';
RAISE NOTICE '   - Medical Aid Total: Full amount including tax';  
RAISE NOTICE '   - Patient Total: N$ 0.00';
RAISE NOTICE '   - Automatic batching for medical aid claims';