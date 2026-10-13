-- Applied 2026-10-08 as migration claim_medicines_2026_10_08
-- =============================================================================================
-- PROPOSAL: medicines and materials billed from stock can be claimed
-- File:   proposals/2026-10-08-claim-medicines.sql                      Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, section 8 item 10): a medicine billed from stock carried its NAPPI
-- number as the tariff code, so the claim check refused it ("not a 4-digit NAMAF code") and one medicine
-- blocked the whole batch. The owner's QEDI claim specification (D:\emminance\QEDI_Spec_Methealth.pdf,
-- page 7) says: field 5 type of service M (acute medicine), R (repeat script), D (chronic medicine),
-- T (tariff, also for materials); field 13 the BHF tariff code "or GMED for medicine"; field 26 the NAPPI
-- code for medicines and materials (0201). So sync_invoice_to_batch now writes, for a line billed from a
-- stock item: a medicine (category 'medications') -> code GMED, type M/R/D (R when its dispensing repeats an
-- earlier one, D when it is marked chronic); a material -> its own 4-digit code, else 0201, type T. The
-- NAPPI code goes to field 26 as before (2026-10-08-claim-nappi.sql). Everything else is unchanged.
-- The app checks the same rule (src/utils/billing/claimLine.ts isMedicineLine, claimValidation.ts).
--
-- Undo: run sync_invoice_to_batch as it is in proposals/2026-10-08-claim-nappi.sql.
-- =============================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_invoice_to_batch(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_invoice RECORD;
    v_patient RECORD;
    v_medical_aid RECORD;
    v_batch RECORD;
    v_service RECORD;
    v_practitioner_hpcsa TEXT;
    v_transaction_number INTEGER;
    v_member_initials TEXT;
    v_formatted_diagnosis TEXT;
    v_medical_aid_ref TEXT;
    v_batch_id UUID; -- <<<< FIX 1: Add a variable to temporarily hold the batch ID
    -- Claim fields 5 and 13 of a line billed from stock (QEDI claim specification p. 7)
    v_item_category TEXT;
    v_disp_repeat UUID;
    v_disp_chronic BOOLEAN;
    v_service_type TEXT;
    v_code TEXT;
BEGIN
    -- Get the master invoice record
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;

    -- Wipe the slate clean: Delete all existing details for this invoice
    DELETE FROM public.batch_details WHERE invoice_id = p_invoice_id;

    -- Re-evaluate the invoice for batch eligibility
    IF v_invoice.medical_aid_total IS NULL OR v_invoice.medical_aid_total <= 0 OR NOT EXISTS (SELECT 1 FROM public.invoice_services WHERE invoice_id = p_invoice_id) THEN
        UPDATE public.invoices_enhanced SET batch_id = NULL WHERE id = p_invoice_id;
        RETURN;
    END IF;

    -- A patient whose file is marked "Do not claim" is never claimed (account_flags, 2026-10-07-debtors-and-controls.sql)
    IF EXISTS (
        SELECT 1 FROM public.account_flags f
         WHERE f.practice_id = v_invoice.practice_id AND f.patient_id = v_invoice.patient_id
           AND f.flag = 'no_claims' AND f.cleared_at IS NULL
    ) THEN
        UPDATE public.invoices_enhanced SET batch_id = NULL WHERE id = p_invoice_id;
        RETURN;
    END IF;

    -- It's eligible, so let's get the required data
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM public.medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;
    SELECT u.hpcsa_number INTO v_practitioner_hpcsa FROM public.users u WHERE u.id = v_invoice.practitioner_id;

    -- Find the medical aid reference
    SELECT map.medical_aid_reference INTO v_medical_aid_ref
    FROM public.medical_aid_details mad
    JOIN public.medical_aid_providers map ON mad.medical_aid_provider_id = map.id
    WHERE mad.patient_id = v_invoice.patient_id LIMIT 1;

    IF v_medical_aid_ref IS NULL THEN RETURN; END IF;

    --- *** CORRECTED LOGIC STARTS HERE *** ---
    -- FIX 2: First, get the ID of the active batch and store it.
    v_batch_id := get_or_create_active_batch_id(v_invoice.practice_id, v_medical_aid_ref);

    -- FIX 3: Now, use that ID to fetch the entire batch header record.
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id;
    --- *** CORRECTED LOGIC ENDS HERE *** ---


    -- Rebuild the batch details from scratch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number FROM public.batch_details WHERE batch_header_id = v_batch.id;

    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id
    LOOP
        -- Calculate initials & Format diagnosis (logic unchanged)
        SELECT string_agg(UPPER(SUBSTRING(part FROM 1 FOR 1)), '') INTO v_member_initials FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS part WHERE LENGTH(TRIM(part)) > 0;
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;
        v_formatted_diagnosis := SUBSTRING(UPPER(REPLACE(v_formatted_diagnosis, ',', '')) FROM 1 FOR 30);

        -- A medicine is claimed as GMED with type M (R for a repeat script, D for a chronic medicine) and its NAPPI
        -- code; a material billed from stock keeps a 4-digit tariff code (0201, cost of material, when its own is not one)
        v_service_type := 'T';
        v_code := v_service.code;
        IF v_service.stock_item_id IS NOT NULL THEN
            SELECT i.category INTO v_item_category FROM public.practice_inventory i WHERE i.id = v_service.stock_item_id;
            IF v_item_category = 'medications' THEN
                -- The dispensing of this item on this visit (the claim trigger runs before the stock ledger entry exists)
                SELECT d.repeat_of, d.is_chronic INTO v_disp_repeat, v_disp_chronic
                  FROM public.stock_dispensings d
                 WHERE d.item_id = v_service.stock_item_id AND d.visit_id = v_invoice.visit_id AND d.cancelled_at IS NULL
                 ORDER BY d.dispensed_on DESC, d.created_at DESC LIMIT 1;
                v_code := 'GMED';
                v_service_type := CASE WHEN v_disp_chronic THEN 'D' WHEN v_disp_repeat IS NOT NULL THEN 'R' ELSE 'M' END;
            ELSIF v_service.code !~ '^[0-9]{4}$' THEN
                v_code := '0201';
            END IF;
        END IF;

        -- Insert the fresh, up-to-date record
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number,
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number, gender, patient_id_number, patient_id, visit_id, nappi_code, type_of_service
        ) VALUES (
            v_batch.id, p_invoice_id, v_transaction_number, v_service.system_transaction_number,
            v_patient.system_patient_reference_number::TEXT, v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''), REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''), TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_code, v_service.total_price, v_formatted_diagnosis,
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'), v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_batch.practice_number, REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id, left(NULLIF(btrim(v_service.nappi_code), ''), 20), v_service_type
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Finally, ensure the invoice is linked to the batch
    UPDATE public.invoices_enhanced SET batch_id = v_batch.id WHERE id = p_invoice_id;
END;
$$;

-- Only the invoice-line trigger runs it (as its owner); no app user may re-batch an invoice directly
REVOKE EXECUTE ON FUNCTION public.sync_invoice_to_batch(uuid) FROM PUBLIC, anon, authenticated;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
