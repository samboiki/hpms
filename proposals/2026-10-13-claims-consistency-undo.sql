-- =============================================================================================
-- UNDO of proposals/2026-10-13-claims-consistency.sql: sync_invoice_to_batch, add_invoice_to_batch and
-- claim_line_correct exactly as they were before it (prosrc md5 9a22f0aaec87e1e0a8f0dbbca0e926aa,
-- 9959083d0bf47f2158b4453fffc75530 and 20361ebc2ead14f9a6516fa9d440e17d, checked at the end), then
-- claim_invoice_into_batch dropped. Privileges are kept by CREATE OR REPLACE.
-- Only for the owner's decision to go back: it ends in ROLLBACK; change that line to COMMIT to undo for real.
-- =============================================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_invoice_to_batch(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Who treated and who bills each line, and its teeth (2026-10-12-line-teeth-and-billing-practitioners.sql)
    v_line_practitioner UUID;
    v_line_hpcna TEXT;
    v_billing_number TEXT;
    v_teeth TEXT;
    v_surfaces TEXT;
    v_quadrant SMALLINT;
    -- The visit's claim details and each line's referral (2026-10-12-referrals-and-authorisations.sql)
    v_claim public.visit_claim_details%ROWTYPE;
    v_ref_found BOOLEAN;
    v_ref_name TEXT;
    v_ref_practice TEXT;
    v_ref_hpcna TEXT;
    v_ref_number TEXT;
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

    -- Wipe the slate clean: delete this invoice's claim lines, except lines in a batch that was already
    -- sent (or is no longer open): they stay exactly as the fund received them, also after a resubmission
    DELETE FROM public.batch_details d
     WHERE d.invoice_id = p_invoice_id
       AND NOT EXISTS (
           SELECT 1 FROM public.batch_headers b
            WHERE b.id = d.batch_header_id
              AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
       );

    -- Re-evaluate the invoice for batch eligibility: lines the patient pays all of (paid_by = 'patient') are never
    -- claimed, so an invoice with only such lines is not claimed (2026-10-09-line-portions.sql)
    IF v_invoice.medical_aid_total IS NULL OR v_invoice.medical_aid_total <= 0 OR NOT EXISTS (SELECT 1 FROM public.invoice_services WHERE invoice_id = p_invoice_id AND paid_by IS DISTINCT FROM 'patient') THEN
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


    -- The visit's referral, hospital stay and place of service (claim fields 25, 30, 42-44)
    SELECT * INTO v_claim FROM public.visit_claim_details WHERE visit_id = v_invoice.visit_id;

    -- Rebuild the batch details from scratch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number FROM public.batch_details WHERE batch_header_id = v_batch.id;

    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id AND paid_by IS DISTINCT FROM 'patient'
    LOOP
        -- Calculate initials & Format diagnosis (logic unchanged)
        SELECT string_agg(UPPER(SUBSTRING(part FROM 1 FOR 1)), '') INTO v_member_initials FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS part WHERE LENGTH(TRIM(part)) > 0;
        -- The treating practitioner: the line's own, else the invoice's. The claim line carries THAT practitioner's
        -- HPCNA number (none: claim review stops the line; never a colleague's number) and bills under their own
        -- practice number when they have one (claim field 29), else the batch's
        v_line_practitioner := COALESCE(v_service.practitioner_id, v_invoice.practitioner_id);
        v_line_hpcna := NULL;
        v_billing_number := NULL;
        IF v_line_practitioner IS NOT NULL THEN
            SELECT NULLIF(btrim(u.hpcsa_number), '') INTO v_line_hpcna FROM public.users u WHERE u.id = v_line_practitioner;
            SELECT NULLIF(btrim(pb.practice_number), '') INTO v_billing_number FROM public.practitioner_billing pb
             WHERE pb.practice_id = v_batch.practice_id AND pb.user_id = v_line_practitioner;
        END IF;
        v_billing_number := COALESCE(v_billing_number, v_batch.practice_number);
        -- The teeth (claim field 37: separated by spaces here, joined in the file), the surfaces of a one-tooth line and
        -- the quadrant; the description starts with them, as the funds read it: "TOOTH: 46 MO ...", "QUAD: 1 ..."
        v_teeth := NULLIF(btrim(regexp_replace(COALESCE(v_service.tooth_number, ''), '[[:space:],;]+', ' ', 'g')), '');
        v_surfaces := NULLIF(btrim(v_service.tooth_surfaces), '');
        v_quadrant := v_service.tooth_quadrant;
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || COALESCE(' ' || v_surfaces, '') || ' ' || v_service.description;
        ELSIF v_quadrant IS NOT NULL THEN
            v_formatted_diagnosis := 'QUAD: ' || v_quadrant || ' ' || v_service.description;
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

        -- The referring practitioner: the line's own referral from the patient's register, else the visit's
        v_ref_found := false;
        IF v_service.referral_id IS NOT NULL THEN
            SELECT r.referring_name, r.referring_practice_number, r.referring_hpcna, r.referral_number
              INTO v_ref_name, v_ref_practice, v_ref_hpcna, v_ref_number
              FROM public.patient_referrals r
             WHERE r.id = v_service.referral_id AND r.patient_id = v_invoice.patient_id AND r.removed_at IS NULL;
            v_ref_found := FOUND;
        END IF;
        IF NOT v_ref_found THEN
            v_ref_name := v_claim.referring_name;
            v_ref_practice := v_claim.referring_practice_number;
            v_ref_hpcna := v_claim.referring_hpcna;
            v_ref_number := v_claim.referral_number;
        END IF;

        -- Insert the fresh, up-to-date record
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number,
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number, gender, patient_id_number, patient_id, visit_id, nappi_code, type_of_service,
            diagnostic_code, authorisation_number, tooth_numbers, tooth_surfaces, tooth_quadrant,
            referring_doctor, referring_doctor_2, tracking_number, hospital_indicator, place_of_service
        ) VALUES (
            v_batch.id, p_invoice_id, v_transaction_number, v_service.system_transaction_number,
            v_patient.system_patient_reference_number::TEXT, v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''), REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''), TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_code, v_service.total_price, v_formatted_diagnosis,
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'), v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_billing_number, REPLACE(COALESCE(v_line_hpcna, ''), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id, left(NULLIF(btrim(v_service.nappi_code), ''), 20), v_service_type,
            left(COALESCE(v_diagnostic_code, ''), 64),
            -- The fund's authorisation number for the line, as the visit's Billing tab saved it
            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), ''),
            -- The line's teeth (claim field 37), surfaces and quadrant
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant,
            -- Who referred the patient (fields 25, 43, 44), a hospital case (30) and the place of service (42)
            btrim(left(btrim(regexp_replace(upper(COALESCE(NULLIF(btrim(v_ref_practice), ''), v_ref_name, '')), '[[:space:],"]+', ' ', 'g')), 15)),
            left(COALESCE(v_ref_hpcna, ''), 15), left(COALESCE(v_ref_number, ''), 15),
            CASE WHEN v_claim.in_hospital THEN 'H' ELSE '' END, COALESCE(v_claim.place_of_service, '')
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Finally, ensure the invoice is linked to the batch
    UPDATE public.invoices_enhanced SET batch_id = v_batch.id WHERE id = p_invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_invoice_to_batch(p_batch_id uuid, p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Who treated and who bills each line, and its teeth (2026-10-12-line-teeth-and-billing-practitioners.sql)
    v_line_practitioner UUID;
    v_line_hpcna TEXT;
    v_billing_number TEXT;
    v_teeth TEXT;
    v_surfaces TEXT;
    v_quadrant SMALLINT;
    -- The visit's claim details and each line's referral (2026-10-12-referrals-and-authorisations.sql)
    v_claim public.visit_claim_details%ROWTYPE;
    v_ref_found BOOLEAN;
    v_ref_name TEXT;
    v_ref_practice TEXT;
    v_ref_hpcna TEXT;
    v_ref_number TEXT;
BEGIN
    -- Get all the necessary records
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = p_batch_id;
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM public.medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;

    -- practice check: the batch and the invoice belong to the caller's practice
    PERFORM public.rls_assert_my_practice(v_batch.practice_id);
    PERFORM public.rls_assert_my_practice(COALESCE(v_invoice.practice_id, v_patient.practice_id));

    -- Get the treating doctor's professional number
    SELECT u.hpcsa_number INTO v_practitioner_hpcsa
    FROM public.users u
    WHERE u.id = v_invoice.practitioner_id;

    -- Calculate member's initials
    SELECT string_agg(UPPER(SUBSTRING(name_part FROM 1 FOR 1)), '')
    INTO v_member_initials
    FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS name_part
    WHERE LENGTH(TRIM(name_part)) > 0;

    -- Get the next transaction number for this batch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number
    FROM public.batch_details WHERE batch_header_id = p_batch_id;

    -- The visit's referral, hospital stay and place of service (claim fields 25, 30, 42-44)
    SELECT * INTO v_claim FROM public.visit_claim_details WHERE visit_id = v_invoice.visit_id;

    -- Loop through each service on the invoice
    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id AND paid_by IS DISTINCT FROM 'patient'
    LOOP
        -- Format the diagnosis string
        -- The treating practitioner: the line's own, else the invoice's. The claim line carries THAT practitioner's
        -- HPCNA number (none: claim review stops the line; never a colleague's number) and bills under their own
        -- practice number when they have one (claim field 29), else the batch's
        v_line_practitioner := COALESCE(v_service.practitioner_id, v_invoice.practitioner_id);
        v_line_hpcna := NULL;
        v_billing_number := NULL;
        IF v_line_practitioner IS NOT NULL THEN
            SELECT NULLIF(btrim(u.hpcsa_number), '') INTO v_line_hpcna FROM public.users u WHERE u.id = v_line_practitioner;
            SELECT NULLIF(btrim(pb.practice_number), '') INTO v_billing_number FROM public.practitioner_billing pb
             WHERE pb.practice_id = v_batch.practice_id AND pb.user_id = v_line_practitioner;
        END IF;
        v_billing_number := COALESCE(v_billing_number, v_batch.practice_number);
        -- The teeth (claim field 37: separated by spaces here, joined in the file), the surfaces of a one-tooth line and
        -- the quadrant; the description starts with them, as the funds read it: "TOOTH: 46 MO ...", "QUAD: 1 ..."
        v_teeth := NULLIF(btrim(regexp_replace(COALESCE(v_service.tooth_number, ''), '[[:space:],;]+', ' ', 'g')), '');
        v_surfaces := NULLIF(btrim(v_service.tooth_surfaces), '');
        v_quadrant := v_service.tooth_quadrant;
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || COALESCE(' ' || v_surfaces, '') || ' ' || v_service.description;
        ELSIF v_quadrant IS NOT NULL THEN
            v_formatted_diagnosis := 'QUAD: ' || v_quadrant || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;
        v_formatted_diagnosis := SUBSTRING(UPPER(v_formatted_diagnosis) FROM 1 FOR 30);

        -- The referring practitioner: the line's own referral from the patient's register, else the visit's
        v_ref_found := false;
        IF v_service.referral_id IS NOT NULL THEN
            SELECT r.referring_name, r.referring_practice_number, r.referring_hpcna, r.referral_number
              INTO v_ref_name, v_ref_practice, v_ref_hpcna, v_ref_number
              FROM public.patient_referrals r
             WHERE r.id = v_service.referral_id AND r.patient_id = v_invoice.patient_id AND r.removed_at IS NULL;
            v_ref_found := FOUND;
        END IF;
        IF NOT v_ref_found THEN
            v_ref_name := v_claim.referring_name;
            v_ref_practice := v_claim.referring_practice_number;
            v_ref_hpcna := v_claim.referring_hpcna;
            v_ref_number := v_claim.referral_number;
        END IF;

        -- Insert into batch_details
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number, -- Added here
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number,
            gender, patient_id_number, patient_id, visit_id, tooth_numbers, tooth_surfaces, tooth_quadrant,
            authorisation_number, referring_doctor, referring_doctor_2, tracking_number, hospital_indicator, place_of_service
        ) VALUES (
            p_batch_id, p_invoice_id, v_transaction_number, v_service.system_transaction_number, -- Added here
            v_patient.system_patient_reference_number::TEXT,
            v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''),
            REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''),
            TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_service.code, v_service.total_price, REPLACE(v_formatted_diagnosis, ',', ''),
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'),
            v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_billing_number,
            REPLACE(COALESCE(v_line_hpcna, ''), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)),
            REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id,
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant,
            -- The fund's authorisation number for the line (claim field 31), as sync_invoice_to_batch carries it
            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), ''),
            -- Who referred the patient (fields 25, 43, 44), a hospital case (30) and the place of service (42)
            btrim(left(btrim(regexp_replace(upper(COALESCE(NULLIF(btrim(v_ref_practice), ''), v_ref_name, '')), '[[:space:],"]+', ' ', 'g')), 15)),
            left(COALESCE(v_ref_hpcna, ''), 15), left(COALESCE(v_ref_number, ''), 15),
            CASE WHEN v_claim.in_hospital THEN 'H' ELSE '' END, COALESCE(v_claim.place_of_service, '')
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Link the invoice to the batch
    UPDATE public.invoices_enhanced SET batch_id = p_batch_id WHERE id = p_invoice_id;
END;
$function$;

-- claim_line_correct: the practitioner statement as it was (the one statement the proposal changed)
DO $undo$
DECLARE
  v_def text;
  v_now text := $n$  -- The practitioner the line was claimed under, by the claim builder's rule (claim_invoice_into_batch): the invoice
  -- line's own, else the invoice's treating practitioner (2026-10-13-claims-consistency.sql)
  v_pract := COALESCE(CASE WHEN v_has_line THEN v_line.practitioner_id END, v_invoice.practitioner_id);
$n$;
  v_was text := $o$  v_pract := COALESCE(CASE WHEN v_has_line THEN v_line.practitioner_id END, v_visit.doctor_id);
$o$;
BEGIN
  SELECT pg_get_functiondef('public.claim_line_correct(uuid, jsonb, text)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_now, ''))) / length(v_now) <> 1 THEN
    RAISE EXCEPTION 'claim_line_correct: the statement of 2026-10-13-claims-consistency.sql was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_now, v_was);
END $undo$;

DROP FUNCTION public.claim_invoice_into_batch(uuid, uuid);

DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure) <> '9a22f0aaec87e1e0a8f0dbbca0e926aa'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.add_invoice_to_batch(uuid,uuid)'::regprocedure) <> '9959083d0bf47f2158b4453fffc75530'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure) <> '20361ebc2ead14f9a6516fa9d440e17d' THEN
    RAISE EXCEPTION 'Check failed: a function is not exactly as it was before proposals/2026-10-13-claims-consistency.sql';
  END IF;
END $$;

ROLLBACK;
