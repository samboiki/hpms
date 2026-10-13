-- Applied 2026-10-13 as migration claims_consistency_2026_10_13 (version 20261012222302; stored statement md5 06b2dfd6f0584a4765586c8bef47f099 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: claim_invoice_into_batch b254e45e5fc2310cea809634ceccdab5, sync_invoice_to_batch
-- 059c5c8a8b90e3a99749f45885f580f3, add_invoice_to_batch fa4850a1e3d75fc70e79c6b9f2441ac8, claim_line_correct
-- 365e28602cd86ecfdb995f4c133ab972 (before: 9a22f0aaec87e1e0a8f0dbbca0e926aa, 9959083d0bf47f2158b4453fffc75530,
-- 20361ebc2ead14f9a6516fa9d440e17d). Rehearsed with simulated logins (rolled back): the migration changed no batch, line or
-- invoice link; all 20 invoices of every open batch rebuilt by the old and the new sync gave byte-identical lines, headers
-- and trailers; an invoice set up with ICD-10 codes and a medicine from stock was claimed identically by the old and new
-- sync, and add_invoice_to_batch (by an administrator, twice: 6 lines, not 12; by a receptionist) now gave exactly the
-- sync's lines (the old add differed in code, type, NAPPI, ICD-10 and description: 8104/T/none became GMED/M/NAPPI, ICD-10
-- J06.9/I10 was missing). add refused, in words (22023) and with nothing changed: a sent batch, a credit file, an invoice
-- already sent, "Do not claim", only the patient's own lines, no fund code, another fund's batch; another practice's staff
-- (both ways), our administrator on another practice's batch, a patient-app login and anon were refused (42501); staff and
-- anon cannot run the sync or the shared function (42501). The old claim_line_correct took the practitioner already on a
-- sent line as a change ("before: no practitioner"); the new one answers "Nothing was changed", and a real change records
-- the invoice's practitioner and the line's HPCNA number as before (the copy differs only in its HPCNA, flag R, batch, line
-- number, id and times). The sent batch stayed byte for byte unchanged after its 18 invoices were synced, added (refused)
-- and a line corrected. The undo file, run after the migration, put back all three md5s and privileges.
-- =============================================================================================
-- PROPOSAL: one set of claim rules for every claim line (add_invoice_to_batch builds lines through the same function
--           as sync_invoice_to_batch), and a corrected claim line names the practitioner it was claimed under
-- File:   proposals/2026-10-13-claims-consistency.sql          Drafted: 2026-10-13
-- Code:   src/components/finance/claims/claimsService.ts, types.ts and BatchReview.tsx ("Correct and send again"
--         starts from the practitioner the line was claimed under, as claim_line_correct now does)
--
-- Why
--   Two functions build claim lines from an invoice: sync_invoice_to_batch (run on every change to an invoice line,
--   into the fund's open batch) and add_invoice_to_batch (Finance > Batches > Not yet batched, into the batch staff
--   chose). The claim rules added since 7 October went into the first and only partly into the second. Read live on
--   13 October (prosrc md5 in section 0), add_invoice_to_batch, unlike sync_invoice_to_batch:
--     - claimed a medicine under its own code with type T and no NAPPI code (the sync: GMED, type M, R or D, and the
--       NAPPI code) and a material billed from stock under a code that is not 4 digits (the sync: 0201);
--     - left each line's ICD-10 codes out (claim field 33), so claim review asked again for codes the invoice had;
--     - claimed a patient whose file is marked "Do not claim", and an invoice with nothing for the medical aid to pay
--       (it linked the invoice to the batch with no lines in it);
--     - wrote into a batch already sent, or into a credit file, and claimed an invoice already sent to the fund;
--     - inserted every line again when called twice (the sync first takes the invoice's lines out of open batches);
--     - took another fund's batch (the sync claims from the patient's own fund only);
--     - took commas out of the description after cutting it to 30 characters (the sync takes them out first).
--   Already the same in both: lines the patient pays all of are left out; each line's practitioner (the line's, else
--   the invoice's) with their own HPCNA number; their own practice number, else the batch's; the authorisation number
--   up to 21 characters; teeth, surfaces and quadrant; the referral, hospital case and place of service.
--   claim_line_correct took the practitioner a sent line was claimed under from the visit's doctor, while the line was
--   built with the invoice's practitioner. On every sent claim line today (41) the visit has no doctor and the invoice
--   has one: a correction recorded "no practitioner" as what the fund received, and choosing the practitioner already
--   on the claim counted as a change.
--
-- What it does
--   1. claim_invoice_into_batch(invoice, batch): the claim rules in one place. Its body is sync_invoice_to_batch's,
--      statement for statement (one unused read of the invoice practitioner's number dropped). Given a batch, it
--      first checks that batch (open, a claim batch and not a credit file, of the invoice's practice) and, once the
--      patient's fund is known, that the batch is that fund's. It returns NULL when the invoice was claimed, else why
--      not, in words. Internal: only the two builders below call it; no app login can run it.
--   2. sync_invoice_to_batch(invoice) calls it without a batch (the fund's open batch, made if there is none). What
--      it produces is unchanged (rehearsed: every open batch rebuilt by the old and the new function is identical).
--   3. add_invoice_to_batch(batch, invoice) keeps its practice check, then calls it with the chosen batch. A reason
--      not to claim is raised as an error in words (SQLSTATE 22023), so "Not yet batched" shows why and nothing changes.
--   4. claim_line_correct: the practitioner a line was claimed under is the invoice line's, else the invoice's (the
--      builder's rule), so a correction's "before" and the line the fund received agree. Nothing else in it changes.
--   5. Checks: every guard is in the shared function, both builders call it, nobody gained a way in.
--   No table, column or policy changes. CREATE OR REPLACE keeps owners and privileges: sync_invoice_to_batch stays
--   closed to PUBLIC, anon and authenticated; add_invoice_to_batch and claim_line_correct stay for signed-in staff.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. The app works before and after: "Not yet batched" lists the database's message
-- for an invoice it did not add.
-- Undo: proposals/2026-10-13-claims-consistency-undo.sql puts back the three functions exactly as they were (their
--       prosrc md5 returns to the values in section 0) and drops claim_invoice_into_batch.
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure) <> '9a22f0aaec87e1e0a8f0dbbca0e926aa' THEN
    RAISE EXCEPTION 'Stopped: sync_invoice_to_batch is not the version proposals/2026-10-12-referrals-and-authorisations.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.add_invoice_to_batch(uuid,uuid)'::regprocedure) <> '9959083d0bf47f2158b4453fffc75530' THEN
    RAISE EXCEPTION 'Stopped: add_invoice_to_batch is not the version proposals/2026-10-12-referrals-and-authorisations.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure) <> '20361ebc2ead14f9a6516fa9d440e17d' THEN
    RAISE EXCEPTION 'Stopped: claim_line_correct is not the version proposals/2026-10-12-referrals-and-authorisations.sql left; merge by hand';
  END IF;
  IF to_regclass('public.visit_claim_details') IS NULL OR to_regclass('public.patient_referrals') IS NULL
     OR to_regclass('public.practitioner_billing') IS NULL OR to_regclass('public.account_flags') IS NULL
     OR to_regclass('public.stock_dispensings') IS NULL OR to_regprocedure('public.rls_assert_my_practice(uuid,boolean)') IS NULL
     OR to_regprocedure('public.get_or_create_active_batch_id(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply practice isolation, debtors-and-controls, dispensing-and-stock, line-teeth and referrals first';
  END IF;
  -- The policies of the tables the claim builders read and write, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'visits', 'users', 'medical_aid_details')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. claim_invoice_into_batch: the claim rules in one place (sync_invoice_to_batch's body, plus a chosen batch's checks)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_invoice_into_batch(p_invoice_id uuid, p_batch_id uuid DEFAULT NULL)
 RETURNS text
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
    v_transaction_number INTEGER;
    v_member_initials TEXT;
    v_formatted_diagnosis TEXT;
    v_medical_aid_ref TEXT;
    v_batch_id UUID;
    -- The batch staff chose (add_invoice_to_batch); without one, the fund's open batch (sync_invoice_to_batch)
    v_target public.batch_headers%ROWTYPE;
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

    -- A batch staff chose is an open claim batch of the invoice's own practice: never a batch already sent, and never
    -- a credit file (its lines take back claims the fund already has)
    IF p_batch_id IS NOT NULL THEN
        SELECT * INTO v_target FROM public.batch_headers WHERE id = p_batch_id;
        IF v_target.id IS NULL OR v_invoice.id IS NULL OR v_target.practice_id IS DISTINCT FROM
           COALESCE(v_invoice.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = v_invoice.patient_id)) THEN
            RETURN 'The batch or the invoice was not found in this practice';
        END IF;
        IF v_target.sent_at IS NOT NULL OR lower(COALESCE(v_target.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready') THEN
            RETURN format('Batch %s was already sent to the fund: invoices go into the fund''s open batch', v_target.batch_number);
        END IF;
        IF upper(COALESCE(v_target.transaction_type, 'D')) <> 'D' THEN
            RETURN format('Batch %s is a credit file (reversals): invoices are claimed in a claim batch', v_target.batch_number);
        END IF;
    END IF;

    -- An invoice in a batch that was already sent keeps its claim lines exactly as the fund received them: a later
    -- change is corrected through the fund's response (rejection queue, resubmission) or a credit note, never by
    -- rewriting the sent batch or claiming the invoice again in a new one
    IF v_invoice.batch_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.batch_headers b
         WHERE b.id = v_invoice.batch_id
           AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
    ) THEN
        RETURN 'This invoice was already sent to the fund: a change goes through Unpaid lines (correct and send again) or a credit note';
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
        RETURN 'Nothing on this invoice is for the medical aid to pay (no medical aid portion, or every line is the patient''s own)';
    END IF;

    -- A patient whose file is marked "Do not claim" is never claimed (account_flags, 2026-10-07-debtors-and-controls.sql)
    IF EXISTS (
        SELECT 1 FROM public.account_flags f
         WHERE f.practice_id = v_invoice.practice_id AND f.patient_id = v_invoice.patient_id
           AND f.flag = 'no_claims' AND f.cleared_at IS NULL
    ) THEN
        UPDATE public.invoices_enhanced SET batch_id = NULL WHERE id = p_invoice_id;
        RETURN 'The patient''s file is marked "Do not claim"';
    END IF;

    -- It's eligible, so let's get the required data
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM public.medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;

    -- Find the medical aid reference
    SELECT map.medical_aid_reference INTO v_medical_aid_ref
    FROM public.medical_aid_details mad
    JOIN public.medical_aid_providers map ON mad.medical_aid_provider_id = map.id
    WHERE mad.patient_id = v_invoice.patient_id LIMIT 1;

    IF v_medical_aid_ref IS NULL THEN
        RETURN 'The patient''s medical aid details are not linked to a fund with a claim code: choose the fund on the patient''s file first';
    END IF;

    IF p_batch_id IS NULL THEN
        -- The fund's open batch, made if there is none (the automatic batching)
        v_batch_id := get_or_create_active_batch_id(v_invoice.practice_id, v_medical_aid_ref);
    ELSIF v_target.medical_aid_reference IS DISTINCT FROM v_medical_aid_ref THEN
        -- Claimed from the patient's own fund only, as the automatic batching does
        RETURN format('The patient''s fund is %s, not %s: add the invoice to the %s batch', v_medical_aid_ref, v_target.medical_aid_reference, v_medical_aid_ref);
    ELSE
        v_batch_id := p_batch_id;
    END IF;

    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id;

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
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_invoice_into_batch(uuid, uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.claim_invoice_into_batch(uuid, uuid) IS
  'Internal: builds an invoice''s claim lines by the claim rules (open batches only, "Do not claim", lines the patient pays left out, GMED/M/R/D and NAPPI, 0201, ICD-10 per line, each line''s practitioner, HPCNA and practice number, authorisation, teeth, referral, hospital and place of service). No batch: the fund''s open batch (sync_invoice_to_batch); a batch: that batch, checked (add_invoice_to_batch). Returns NULL when claimed, else why not.';

-- ---------------------------------------------------------------------------------------------
-- 2. sync_invoice_to_batch: the fund's open batch, by the shared rules (what it produces is unchanged)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_invoice_to_batch(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- The invoice's claim lines in its fund's open batch (made if there is none), by the claim rules of
    -- claim_invoice_into_batch, which "Not yet batched" (add_invoice_to_batch) uses too. Why an invoice was not claimed
    -- is no error here: the invoice line is saved either way, and claim review and "Not yet batched" show what is missing
    PERFORM public.claim_invoice_into_batch(p_invoice_id, NULL);
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 3. add_invoice_to_batch: the batch staff chose, by the same rules; a reason not to claim is an error in words
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_invoice_to_batch(p_batch_id uuid, p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_batch RECORD;
    v_invoice RECORD;
    v_patient RECORD;
    v_refused TEXT;
BEGIN
    -- Get all the necessary records
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = p_batch_id;
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;

    -- practice check: the batch and the invoice belong to the caller's practice
    PERFORM public.rls_assert_my_practice(v_batch.practice_id);
    PERFORM public.rls_assert_my_practice(COALESCE(v_invoice.practice_id, v_patient.practice_id));

    -- The claim lines are built exactly as the automatic batching builds them (claim_invoice_into_batch): a reason not
    -- to claim the invoice in this batch stops here, with nothing changed
    v_refused := public.claim_invoice_into_batch(p_invoice_id, p_batch_id);
    IF v_refused IS NOT NULL THEN
        RAISE EXCEPTION '%', v_refused USING ERRCODE = '22023';
    END IF;
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 4. claim_line_correct: the practitioner a sent line was claimed under, by the claim builder's rule
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old text := $o$  v_pract := COALESCE(CASE WHEN v_has_line THEN v_line.practitioner_id END, v_visit.doctor_id);
$o$;
  v_new text := $n$  -- The practitioner the line was claimed under, by the claim builder's rule (claim_invoice_into_batch): the invoice
  -- line's own, else the invoice's treating practitioner (2026-10-13-claims-consistency.sql)
  v_pract := COALESCE(CASE WHEN v_has_line THEN v_line.practitioner_id END, v_invoice.practitioner_id);
$n$;
BEGIN
  SELECT pg_get_functiondef('public.claim_line_correct(uuid, jsonb, text)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'claim_line_correct: the practitioner statement was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_rules text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.claim_invoice_into_batch(uuid, uuid)'::regprocedure);
  v_sync text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure);
  v_add text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.add_invoice_to_batch(uuid, uuid)'::regprocedure);
  v_correct text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.claim_line_correct(uuid, jsonb, text)'::regprocedure);
  v_count text := 'paid_by IS DISTINCT FROM ''patient''';
  v_fn text;
BEGIN
  -- Every guard of the claim builder lives in the shared function
  IF (length(v_rules) - length(replace(v_rules, 'b.sent_at IS NOT NULL', ''))) / length('b.sent_at IS NOT NULL') <> 2
     OR position('AND NOT EXISTS (' in v_rules) = 0 OR position('no_claims' in v_rules) = 0
     OR position('GMED' in v_rules) = 0 OR position('''0201''' in v_rules) = 0 OR position('v_service.nappi_code' in v_rules) = 0
     OR position('icd10_primary' in v_rules) = 0 OR position('left(NULLIF(btrim(v_service.authorisation_number), ''''), 21)' in v_rules) = 0
     OR position('v_line_hpcna' in v_rules) = 0 OR position('practitioner_billing' in v_rules) = 0 OR position('v_surfaces, v_quadrant' in v_rules) = 0
     OR position('visit_claim_details' in v_rules) = 0 OR position('patient_referrals' in v_rules) = 0 OR position('place_of_service' in v_rules) = 0
     OR position('get_or_create_active_batch_id' in v_rules) = 0 OR position('v_target.transaction_type' in v_rules) = 0
     OR position('v_target.sent_at IS NOT NULL' in v_rules) = 0 OR position('v_target.medical_aid_reference IS DISTINCT FROM' in v_rules) = 0
     OR (length(v_rules) - length(replace(v_rules, v_count, ''))) / length(v_count) <> 2 THEN
    RAISE EXCEPTION 'Check failed: a guard of the claim builder is missing from claim_invoice_into_batch';
  END IF;
  -- Both builders use it; add_invoice_to_batch keeps its practice check
  IF position('claim_invoice_into_batch(p_invoice_id, NULL)' in v_sync) = 0 OR position('INSERT' in v_sync) > 0
     OR position('claim_invoice_into_batch(p_invoice_id, p_batch_id)' in v_add) = 0 OR position('INSERT' in v_add) > 0
     OR (length(v_add) - length(replace(v_add, 'rls_assert_my_practice', ''))) / length('rls_assert_my_practice') <> 2 THEN
    RAISE EXCEPTION 'Check failed: a claim builder does not use claim_invoice_into_batch, or add_invoice_to_batch lost its practice check';
  END IF;
  -- A correction names the practitioner the line was claimed under; every guard of it stays
  IF position('v_line.practitioner_id END, v_invoice.practitioner_id)' in v_correct) = 0 OR position('v_visit.doctor_id' in v_correct) > 0
     OR position('claim_line_resend_blocker' in v_correct) = 0 OR position('claim_assert_staff' in v_correct) = 0
     OR position('''practice_number'', v_number' in v_correct) = 0 THEN
    RAISE EXCEPTION 'Check failed: claim_line_correct does not take the invoice''s practitioner, or lost a guard';
  END IF;
  -- Nobody gained a way in: the shared function and the sync only for the database itself, the other two for signed-in staff
  FOREACH v_fn IN ARRAY ARRAY['public.claim_invoice_into_batch(uuid, uuid)', 'public.sync_invoice_to_batch(uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = v_fn::regprocedure AND a.grantee = 0) THEN
      RAISE EXCEPTION 'Check failed: % can be run by an app login or the public key', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.add_invoice_to_batch(uuid, uuid)', 'public.claim_line_correct(uuid, jsonb, text)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = v_fn::regprocedure AND a.grantee = 0) THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in staff only', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.claim_invoice_into_batch(uuid, uuid)', 'public.sync_invoice_to_batch(uuid)',
                              'public.add_invoice_to_batch(uuid, uuid)', 'public.claim_line_correct(uuid, jsonb, text)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'Check failed: % must run as its owner with search_path public', v_fn;
    END IF;
  END LOOP;
  -- The policies of the tables read and written here are as they were
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'visits', 'users', 'medical_aid_details')) THEN
    RAISE EXCEPTION 'Check failed: a policy of invoice_services, invoices_enhanced, patients, batch_details, batch_headers, visits, users or medical_aid_details changed';
  END IF;
END $$;

ROLLBACK;
