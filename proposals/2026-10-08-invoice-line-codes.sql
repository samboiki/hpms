-- Applied 2026-10-09 as migration invoice_line_codes_2026_10_08 (version 20261009005606; stored statement md5 93998a50dca4f2cdfb46e8b5dd535e4c = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Rehearsed with simulated logins (receptionist, practice administrator, another practice): a 2-line invoice was batched with
-- 8101=J06.9/I10 at the charged N$400.00 (a code typed twice sent once) and 8109 without codes; a code added later reached
-- the open batch; external-cause main codes, 6 codes, codes without a main code, malformed codes, a fee change without who
-- or with a blank reason were refused; after the batch was sent, changing and deleting lines left it untouched; staff,
-- anon and PUBLIC cannot run sync_invoice_to_batch. Repeated against the applied function: same results.
-- =============================================================================================
-- PROPOSAL: ICD-10 codes and a changed fee on each invoice line, carried into the claim
-- File:   proposals/2026-10-08-invoice-line-codes.sql                   Drafted: 2026-10-09
-- Code:   src/utils/billing/invoiceLineRow.ts (the stored line; tested), src/utils/billing/icd10Defaults.ts (the
--         codes a line starts with; tested), src/components/visits/BillingLineDetails.tsx (the visit Billing tab),
--         src/services/invoicingSetup.ts (LINE_CODE_COLUMNS: the app writes the new columns only once they exist)
--
-- Why (parity D1, D2): ICD-10 codes could only be entered at claim review, one batch line at a time, and they were
-- lost whenever the invoice changed (sync_invoice_to_batch rebuilt the batch lines without them). A line's fee could
-- not be changed from the price list, so an agreed or reduced fee could not be billed with the reason recorded.
--
-- What it does (additive: nothing existing is changed or removed)
--   1. invoice_services.icd10_primary and icd10_secondary: the line's ICD-10 codes, at most 5 in all, because a
--      claim line carries 5 (claim field 33). The same columns as section 1 of the older proposals/2026-10-claims.sql
--      with the claim's limit instead of 10 codes; the check has the same name, so that file skips its own.
--   2. invoice_services.fee_override_reason, fee_override_from, fee_override_by, fee_override_at: a fee changed
--      from the price list, why, the unit price before, who changed it and when. unit_price and total_price stay the
--      fee charged, so the totals, receipts and the claim amount (service_amount) need no change.
--   3. sync_invoice_to_batch: each batch line gets its invoice line's codes in diagnostic_code ("J06.9/I10", the
--      way claim review saves them), so claim review and the claim file read them as saved. Started from the live
--      definition (identical to proposals/2026-10-08-claim-sent-batches.sql) and changed only there: the sent-batch
--      guard, eligibility, "Do not claim", medicines (GMED with type M, R or D), materials (0201), the NAPPI code,
--      the type of service and EXECUTE revoked from PUBLIC, anon and authenticated stay as they were.
--   The narrative printed under a line is the existing invoice_services.notes (only quote line notes used it).
--   No policy changes: invoice_services keeps its practice-isolation policies.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Section 4 shows the result.
-- Undo, in this order: sync_invoice_to_batch as in proposals/2026-10-08-claim-sent-batches.sql; then
--   ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_fee_override_complete,
--     DROP CONSTRAINT IF EXISTS invoice_services_icd10_valid, DROP COLUMN IF EXISTS fee_override_at,
--     DROP COLUMN IF EXISTS fee_override_by, DROP COLUMN IF EXISTS fee_override_from,
--     DROP COLUMN IF EXISTS fee_override_reason, DROP COLUMN IF EXISTS icd10_secondary,
--     DROP COLUMN IF EXISTS icd10_primary;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The line's ICD-10 codes: a main code, then up to 4 more (5 in all, what a claim line carries)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services
  ADD COLUMN IF NOT EXISTS icd10_primary text,
  ADD COLUMN IF NOT EXISTS icd10_secondary text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_icd10_valid' AND conrelid = 'public.invoice_services'::regclass
  ) THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_icd10_valid CHECK (
      -- The main code: a letter, two digits, optionally a dot and one or two digits; never an external cause (V-Y)
      (icd10_primary IS NULL OR (icd10_primary ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' AND icd10_primary !~ '^[VWXY]'))
      -- More codes only after a main code: at most 4, each a code
      AND (cardinality(icd10_secondary) = 0 OR icd10_primary IS NOT NULL)
      AND cardinality(icd10_secondary) <= 4
      AND array_position(icd10_secondary, NULL) IS NULL
      AND (cardinality(icd10_secondary) = 0
           OR array_to_string(icd10_secondary, '/') ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?(/[A-Z][0-9]{2}(\.[0-9]{1,2})?)*$')
    );
  END IF;
END $$;

COMMENT ON COLUMN public.invoice_services.icd10_primary IS
  'Main ICD-10 code of the line (e.g. J06.9); the claim line takes it (batch_details.diagnostic_code, first code).';
COMMENT ON COLUMN public.invoice_services.icd10_secondary IS
  'Up to 4 more ICD-10 codes of the line: a claim line carries 5 in all (claim field 33).';

-- ---------------------------------------------------------------------------------------------
-- 2. A fee changed from the price list: why, the unit price before, who and when (all four, or none)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services
  ADD COLUMN IF NOT EXISTS fee_override_reason text,
  ADD COLUMN IF NOT EXISTS fee_override_from numeric(12,2),
  ADD COLUMN IF NOT EXISTS fee_override_by uuid,
  ADD COLUMN IF NOT EXISTS fee_override_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_fee_override_complete' AND conrelid = 'public.invoice_services'::regclass
  ) THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_fee_override_complete CHECK (
      (fee_override_reason IS NULL AND fee_override_from IS NULL AND fee_override_by IS NULL AND fee_override_at IS NULL)
      OR (btrim(fee_override_reason) <> '' AND length(fee_override_reason) <= 200
          AND fee_override_from >= 0 AND fee_override_by IS NOT NULL AND fee_override_at IS NOT NULL)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.invoice_services.fee_override_reason IS
  'Why the fee was changed from the price list (unit_price is the fee charged); NULL when it was not changed.';
COMMENT ON COLUMN public.invoice_services.fee_override_from IS 'The unit price before the change (the tariff or fund price).';
COMMENT ON COLUMN public.invoice_services.fee_override_by IS 'users.id of the staff member who changed the fee.';
COMMENT ON COLUMN public.invoice_services.fee_override_at IS 'When the fee was changed.';

-- ---------------------------------------------------------------------------------------------
-- 3. sync_invoice_to_batch: the live definition, plus each line's ICD-10 codes in diagnostic_code
--    (marked "ICD-10" below; everything else is unchanged)
-- ---------------------------------------------------------------------------------------------

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
    -- ICD-10: the line's codes as the claim carries them (claim field 33)
    v_diagnostic_code TEXT;
BEGIN
    -- Get the master invoice record
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;

    -- An invoice in a batch that was already sent keeps its claim lines exactly as the fund received them: a later
    -- change is corrected through the fund's response (rejection queue, resubmission) or a credit note, never by
    -- rewriting the sent batch or claiming the invoice again in a new one
    IF v_invoice.batch_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.batch_headers b
         WHERE b.id = v_invoice.batch_id
           AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
    ) THEN
        RETURN;
    END IF;

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

        -- ICD-10: the line's codes, main code first, each once, "/"-separated as claim review saves them (at most 5,
        -- the invoice line's check); empty when the line has none, so claim review asks for them
        SELECT string_agg(c.code, '/' ORDER BY c.first_pos) INTO v_diagnostic_code
          FROM (SELECT btrim(u.code) AS code, min(u.pos) AS first_pos
                  FROM unnest(ARRAY[v_service.icd10_primary] || COALESCE(v_service.icd10_secondary, '{}'::text[])) WITH ORDINALITY AS u(code, pos)
                 WHERE NULLIF(btrim(u.code), '') IS NOT NULL
                 GROUP BY btrim(u.code)) c;

        -- Insert the fresh, up-to-date record
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number,
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number, gender, patient_id_number, patient_id, visit_id, nappi_code, type_of_service,
            diagnostic_code
        ) VALUES (
            v_batch.id, p_invoice_id, v_transaction_number, v_service.system_transaction_number,
            v_patient.system_patient_reference_number::TEXT, v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''), REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''), TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_code, v_service.total_price, v_formatted_diagnosis,
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'), v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_batch.practice_number, REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id, left(NULLIF(btrim(v_service.nappi_code), ''), 20), v_service_type,
            left(COALESCE(v_diagnostic_code, ''), 64)
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Finally, ensure the invoice is linked to the batch
    UPDATE public.invoices_enhanced SET batch_id = v_batch.id WHERE id = p_invoice_id;
END;
$$;

-- Only the invoice-line trigger runs it (as its owner); no app user may re-batch an invoice directly
REVOKE EXECUTE ON FUNCTION public.sync_invoice_to_batch(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Result (read only): the new columns, their checks and the function's rights
-- ---------------------------------------------------------------------------------------------

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoice_services'
  AND column_name IN ('icd10_primary', 'icd10_secondary', 'fee_override_reason', 'fee_override_from', 'fee_override_by', 'fee_override_at')
ORDER BY column_name;

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.invoice_services'::regclass AND conname IN ('invoice_services_icd10_valid', 'invoice_services_fee_override_complete');

SELECT p.prosecdef, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_run,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_run
FROM pg_proc p WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
