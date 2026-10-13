-- Applied 2026-10-12 as migration referrals_and_authorisations_2026_10_12 (version 20261012192733; stored statement md5 760c2c9c6951c00a70a479b63df344c2 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: sync_invoice_to_batch 9a22f0aaec87e1e0a8f0dbbca0e926aa, add_invoice_to_batch 9959083d0bf47f2158b4453fffc75530,
-- claim_line_correct 20361ebc2ead14f9a6516fa9d440e17d.
-- Rehearsed with simulated logins (rolled back; twice, the second right before applying): reception saved two referrals
-- ("  Dr  Test   Referrer ", "012 3456", "mp 12345" stored tidied) and read 2; a letter dated tomorrow, a last day before
-- the letter, no name, letters as a practice number and a letter path in another practice's folder were refused (22023);
-- direct inserts into the three tables were refused (42501); another practice read 0 and could not save, remove, set
-- visit details or authorisations (42501); anon read and ran nothing (42501). The visit's details (referral from the
-- register, in hospital, place 41) reached the claim lines: 8368 [0123456|MP12345|REF-1|H|41] under the practice's
-- number; 8109 with its own referral [DR SECOND LONGN|||H|41] under the partner's own number; the patient's own line was
-- not claimed; place 11 rebuilt the open lines. An authorisation (8368, one visit) numbered 1 line already billed (not the
-- patient's own line), its claim line carried it, the line's history recorded it; the same number again was refused
-- (23505), a number with a space, a window back to front, no codes and another file's quote (22023); a second visit was
-- not numbered until two visits were allowed. With the batch sent: new details, an all-codes authorisation (0 lines) and
-- a removed referral left the sent lines unchanged. add_invoice_to_batch carried a typed 21-character number and the
-- visit's referral and place. A sent line corrected from the partner (own number) to a doctor without one went again
-- under the practice's number, one corrected to a doctor with an own number under that number (R; history recorded the
-- number). sync_invoice_to_batch stayed closed to staff, anon and PUBLIC; patient merges move both registers; every
-- batch sent before the file was unchanged.
-- =============================================================================================
-- PROPOSAL: incoming referrals and fund authorisations on the patient's file, a visit's referral and hospital
--           details, and the people on an invoice line, all carried to the claim (parity C10, D7, D15, F18, F19);
--           a corrected claim line bills under its new practitioner's practice number
-- File:   proposals/2026-10-12-referrals-and-authorisations.sql          Drafted: 2026-10-12
-- Code:   src/utils/billing/referrals.ts, authorisations.ts and visitClaimDetails.ts (the rules below, tested),
--         src/services/claimRegistersService.ts (reads and saves; "not set up yet" before this file),
--         src/components/patients/registers/* (Billing tab of the patient file: Referrals, Authorisations),
--         src/components/visits/VisitClaimDetailsCard.tsx (the visit's Billing tab), BillingLineDetails.tsx (the line's
--         people and the number it takes from the register), src/components/quotes/QuoteViewer.tsx (a quote's
--         pre-authorisation number into the register), src/components/finance/claims/claimCorrections.ts
--
-- Why
--   C10/F19: specialists are paid only with the referring practitioner on the claim (fields 25, 43, 44), and hospital
--   work needs field 30 ("H") and the place of service (field 42). batch_details had those columns, but nothing ever
--   filled them, and there was nowhere to record a referral letter, its validity or why the patient was referred.
--   D15/F18: a fund pays an authorised service only with the authorisation number on the line (field 31). Numbers
--   could be typed line by line, but there was no register: no validity window, no codes, no visit count, and a quote's
--   pre-authorisation number never reached a claim.
--   D7: theatre cases name an assistant and an anaesthetist per line, and each line can name its own referring
--   practitioner.
--   Correction fix: correcting a sent line's practitioner (claim_line_correct) changed the HPCNA number but kept the
--   practice number of the line as sent, so a line moved from a partner with an own number went to the fund under the
--   partner's number. The rule of sync_invoice_to_batch now applies: the new practitioner's own number, else the
--   practice's.
--
-- What it does
--   1. patient_referrals: the practice's register of referral letters per patient (referring practitioner, practice
--      number, HPCNA number, referral number, date, last day, reason, the letter in the private records bucket).
--   2. patient_authorisations: the register of fund authorisations per patient (fund, number, first and last day,
--      codes or all codes, visits allowed, the quote it came from).
--   3. visit_claim_details: per visit, the referral (filled from the register or typed), "in hospital", the admission
--      and discharge dates and the place of service.
--   4. invoice_services.referral_id (a line's own referral), assistant_id and anaesthetist_id (staff). Additive; the
--      policies of invoice_services are not touched.
--   5. Writes only through SECURITY DEFINER functions for staff of the patient's practice (any role: reception records
--      letters and authorisations): save_patient_referral, remove_patient_referral, save_patient_authorisation,
--      remove_patient_authorisation, save_visit_claim_details. Nothing is deleted from the registers: a mistake is
--      removed (removed_at), so what a claim carried can still be traced. Saving an authorisation also puts its number
--      on the patient's lines already billed in its window that have none (not on lines a fund was sent, not on lines
--      the patient pays, within the visits allowed); the line change rebuilds the open claim batch as any line change
--      does. Saving a visit's details or changing a referral rebuilds the visit's open claim lines; a sent batch never
--      changes.
--   6. sync_invoice_to_batch and add_invoice_to_batch, edited in their LIVE definitions (each changed statement found
--      exactly once or nothing changes): each claim line carries the line's referral, else the visit's (fields 25, 43,
--      44: the practice number, else the name; 15 characters each), "H" for a hospital case (30) and the place of
--      service (42). add_invoice_to_batch also carries the line's authorisation number (31), as sync does. Every guard
--      stays: sent batches kept, "Do not claim", GMED/M/R/D and the NAPPI code, 0201, ICD-10 per line, lines the
--      patient pays never claimed, teeth, surfaces, quadrant, each line's practitioner and practice number, the
--      authorisation up to 21 characters, add_invoice_to_batch's practice check. CREATE OR REPLACE keeps owners and
--      privileges: sync_invoice_to_batch stays closed to PUBLIC, anon and authenticated.
--   7. claim_line_correct (edited in its live definition): a new practitioner also sets the copy's practice number.
--   8. The patient app's logins get nothing here, as on every OneHealth table.
--   9. Checks, including that the policies of the practice-isolation tables did not change.
--
-- How to apply: rehearse (scripts/db/rehearsal.ts, or the part between BEGIN; and ROLLBACK; followed by tests that end
-- in RAISE EXCEPTION), then apply that part as one migration. The app probes the tables and columns
-- (claimRegistersService.ts, invoicingSetup.ts) and says "not set up yet" until they exist.
-- Undo: restore sync_invoice_to_batch, add_invoice_to_batch and claim_line_correct from the prosrc md5s in section 0
--       (proposals/2026-10-12-line-teeth-and-billing-practitioners.sql and 2026-10-12-claim-correction-authorisation.sql),
--       then DROP FUNCTION public.save_visit_claim_details(uuid, jsonb), public.remove_patient_authorisation(uuid),
--       public.save_patient_authorisation(uuid, uuid, jsonb), public.remove_patient_referral(uuid),
--       public.save_patient_referral(uuid, uuid, jsonb), public.claim_authorisation_apply(uuid),
--       public.claim_register_practice(uuid);
--       ALTER TABLE public.invoice_services DROP COLUMN referral_id, DROP COLUMN assistant_id, DROP COLUMN anaesthetist_id;
--       DROP TABLE public.visit_claim_details, public.patient_authorisations, public.patient_referrals;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure) <> '41239df0c0a2c7b4403ce4a569ba905c' THEN
    RAISE EXCEPTION 'Stopped: sync_invoice_to_batch is not the version proposals/2026-10-12-line-teeth-and-billing-practitioners.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.add_invoice_to_batch(uuid,uuid)'::regprocedure) <> '831d7dcb94dc973800eb784a57bf9b4c' THEN
    RAISE EXCEPTION 'Stopped: add_invoice_to_batch is not the version proposals/2026-10-12-line-teeth-and-billing-practitioners.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure) <> '780a89a51a953f2eb7c735ecdeda1ae9' THEN
    RAISE EXCEPTION 'Stopped: claim_line_correct is not the version proposals/2026-10-12-claim-correction-authorisation.sql left; merge by hand';
  END IF;
  IF to_regprocedure('public.rls_my_practice_id()') IS NULL OR to_regprocedure('public.ar_today()') IS NULL
     OR to_regprocedure('public.ar_is_cancelled(text)') IS NULL OR to_regclass('public.practitioner_billing') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply practice isolation, receipts and proposals/2026-10-12-line-teeth-and-billing-practitioners.sql first';
  END IF;
  -- The policies of the tables this file reads or extends, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'visits', 'quotes', 'users')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The referral register
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_referrals (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id               uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id                uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Who referred the patient, as the claim carries them (fields 25, 43, 44; referrals.ts)
  referring_name            text NOT NULL CHECK (char_length(btrim(referring_name)) BETWEEN 1 AND 100),
  referring_practice_number text CHECK (referring_practice_number IS NULL OR referring_practice_number ~ '^[0-9]{7,15}$'),
  referring_hpcna           text CHECK (referring_hpcna IS NULL OR referring_hpcna ~ '^[A-Z0-9]{2,15}$'),
  referral_number           text CHECK (referral_number IS NULL OR referral_number ~ '^[A-Za-z0-9/.-]{1,15}$'),
  referral_date             date NOT NULL,
  -- The last day the referral is valid; NULL: no end date
  valid_until               date,
  reason                    text CHECK (reason IS NULL OR char_length(reason) <= 500),
  -- The letter in the private records bucket, under the practice's own folder (src/services/recordPaths.ts)
  letter_path               text,
  letter_name               text CHECK (letter_name IS NULL OR char_length(letter_name) <= 200),
  created_by                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  removed_by                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  removed_at                timestamptz,
  CONSTRAINT patient_referrals_valid_until_check CHECK (valid_until IS NULL OR valid_until >= referral_date),
  CONSTRAINT patient_referrals_letter_check CHECK (
    letter_path IS NULL OR (char_length(letter_path) <= 500 AND split_part(letter_path, '/', 1) = practice_id::text
                            AND split_part(letter_path, '/', 2) = 'patient-documents'))
);

COMMENT ON TABLE public.patient_referrals IS
  'Referral letters a patient brought from another practitioner (parity C10). Changed only through save_patient_referral and remove_patient_referral; a removed referral stays for the record.';

CREATE INDEX IF NOT EXISTS patient_referrals_patient_idx ON public.patient_referrals (patient_id, referral_date DESC);

-- ---------------------------------------------------------------------------------------------
-- 2. The authorisation register
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_authorisations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id          uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id           uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The fund's claim code (medical_aid_providers.medical_aid_reference: MAG1, NMC1, NHPM, NAMM, PROS)
  fund_reference       text NOT NULL CHECK (fund_reference ~ '^[A-Z0-9]{2,10}$'),
  -- What a claim line carries in field 31 (invoice_services_authorisation_check)
  authorisation_number text NOT NULL CHECK (authorisation_number ~ '^[A-Za-z0-9/.-]{1,21}$'),
  valid_from           date NOT NULL,
  valid_to             date NOT NULL,
  -- Every code, or the codes listed (in capitals)
  all_codes            boolean NOT NULL DEFAULT false,
  codes                text[] NOT NULL DEFAULT '{}',
  -- NULL: no limit
  visits_allowed       integer CHECK (visits_allowed IS NULL OR visits_allowed BETWEEN 1 AND 999),
  note                 text CHECK (note IS NULL OR char_length(note) <= 200),
  -- The quote whose pre-authorisation number it records
  quote_id             uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  removed_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  removed_at           timestamptz,
  CONSTRAINT patient_authorisations_window_check CHECK (valid_to >= valid_from),
  CONSTRAINT patient_authorisations_codes_check CHECK (
    cardinality(codes) <= 50 AND array_position(codes, NULL) IS NULL
    AND (cardinality(codes) = 0 OR array_to_string(codes, ',') ~ '^[0-9A-Z]{1,10}(,[0-9A-Z]{1,10})*$')
    AND all_codes = (cardinality(codes) = 0))
);

COMMENT ON TABLE public.patient_authorisations IS
  'Fund pre-authorisations per patient (parity D15, F18): lines billed to the fund in the window for a covered code carry the number (claim field 31). Changed only through save_patient_authorisation and remove_patient_authorisation.';

CREATE INDEX IF NOT EXISTS patient_authorisations_patient_idx ON public.patient_authorisations (patient_id, valid_to DESC);

-- ---------------------------------------------------------------------------------------------
-- 3. A visit's claim details
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.visit_claim_details (
  visit_id                  uuid PRIMARY KEY REFERENCES public.visits(id) ON DELETE CASCADE,
  practice_id               uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- The register entry the referral was filled from; the values below are what the claim carries
  referral_id               uuid REFERENCES public.patient_referrals(id) ON DELETE SET NULL,
  referring_name            text CHECK (referring_name IS NULL OR char_length(btrim(referring_name)) BETWEEN 1 AND 100),
  referring_practice_number text CHECK (referring_practice_number IS NULL OR referring_practice_number ~ '^[0-9]{7,15}$'),
  referring_hpcna           text CHECK (referring_hpcna IS NULL OR referring_hpcna ~ '^[A-Z0-9]{2,15}$'),
  referral_number           text CHECK (referral_number IS NULL OR referral_number ~ '^[A-Za-z0-9/.-]{1,15}$'),
  -- Claim field 30: "H"
  in_hospital               boolean NOT NULL DEFAULT false,
  admission_date            date,
  discharge_date            date,
  -- Claim field 42: a PHISC place-of-service code (the eight groups of the specification's list)
  place_of_service          text CHECK (place_of_service IS NULL OR place_of_service ~ '^(1[0-4]|2[0-4]|3[0-2]|4[0-6]|5[0-2]|6[0-6]|7[0-2]|8[0-3])$'),
  updated_by                uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_claim_details_stay_check CHECK (in_hospital OR (admission_date IS NULL AND discharge_date IS NULL)),
  CONSTRAINT visit_claim_details_discharge_check CHECK (discharge_date IS NULL OR (admission_date IS NOT NULL AND discharge_date >= admission_date))
);

COMMENT ON TABLE public.visit_claim_details IS
  'Per visit: who referred the patient, a hospital stay and the place of service, carried to every claim line of the visit (fields 25, 30, 42-44; parity F19). Changed only through save_visit_claim_details.';

-- ---------------------------------------------------------------------------------------------
-- 4. The people on an invoice line
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.patient_referrals(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS assistant_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS anaesthetist_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invoice_services.referral_id IS
  'The line''s own referral from the patient''s register (claim fields 25, 43, 44); NULL: the visit''s referral.';
COMMENT ON COLUMN public.invoice_services.assistant_id IS 'The assistant on this line (theatre cases), from the practice''s staff.';
COMMENT ON COLUMN public.invoice_services.anaesthetist_id IS 'The anaesthetist on this line, from the practice''s staff.';

CREATE INDEX IF NOT EXISTS invoice_services_referral_idx ON public.invoice_services (referral_id) WHERE referral_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 5. Reading (staff of the practice) and writing (through the functions below)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_authorisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_claim_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_referrals_read ON public.patient_referrals;
CREATE POLICY patient_referrals_read ON public.patient_referrals FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));
DROP POLICY IF EXISTS patient_authorisations_read ON public.patient_authorisations;
CREATE POLICY patient_authorisations_read ON public.patient_authorisations FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));
DROP POLICY IF EXISTS visit_claim_details_read ON public.visit_claim_details;
CREATE POLICY visit_claim_details_read ON public.visit_claim_details FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));

REVOKE ALL ON public.patient_referrals, public.patient_authorisations, public.visit_claim_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_referrals, public.patient_authorisations, public.visit_claim_details TO authenticated;

-- The practice of a patient the signed-in staff member may change records of (their own practice's patients only)
CREATE OR REPLACE FUNCTION public.claim_register_practice(p_patient_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_practice uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT p.practice_id INTO v_practice FROM patients p WHERE p.id = p_patient_id;
  IF v_practice IS NULL OR v_practice IS DISTINCT FROM rls_my_practice_id() THEN
    RAISE EXCEPTION 'You can only change the records of your own practice''s patients' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_patient_referral(p_id uuid, p_patient_id uuid, p_referral jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_practice uuid := claim_register_practice(p_patient_id);
  v_name     text := NULLIF(regexp_replace(btrim(COALESCE(p_referral->>'referring_name', '')), '\s+', ' ', 'g'), '');
  v_number   text := NULLIF(regexp_replace(COALESCE(p_referral->>'referring_practice_number', ''), '\s', '', 'g'), '');
  v_hpcna    text := NULLIF(upper(regexp_replace(COALESCE(p_referral->>'referring_hpcna', ''), '\s', '', 'g')), '');
  v_ref      text := NULLIF(btrim(COALESCE(p_referral->>'referral_number', '')), '');
  v_reason   text := NULLIF(btrim(COALESCE(p_referral->>'reason', '')), '');
  v_path     text := NULLIF(btrim(COALESCE(p_referral->>'letter_path', '')), '');
  v_file     text := left(NULLIF(btrim(COALESCE(p_referral->>'letter_name', '')), ''), 200);
  v_date     date;
  v_until    date;
  v_id       uuid;
BEGIN
  BEGIN
    v_date := NULLIF(p_referral->>'referral_date', '')::date;
    v_until := NULLIF(p_referral->>'valid_until', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A date of the referral is not a valid date' USING ERRCODE = '22023';
  END;
  IF v_name IS NULL OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Say who referred the patient (at most 100 characters)' USING ERRCODE = '22023';
  END IF;
  IF v_number IS NOT NULL AND v_number !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'A practice number has 7 to 15 digits' USING ERRCODE = '22023';
  END IF;
  IF v_hpcna IS NOT NULL AND v_hpcna !~ '^[A-Z0-9]{2,15}$' THEN
    RAISE EXCEPTION 'An HPCNA number has letters and digits only, at most 15' USING ERRCODE = '22023';
  END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Za-z0-9/.-]{1,15}$' THEN
    RAISE EXCEPTION 'A referral number has at most 15 letters or digits (no spaces or commas)' USING ERRCODE = '22023';
  END IF;
  IF v_date IS NULL OR v_date > ar_today() THEN
    RAISE EXCEPTION 'The referral letter needs its date, and it cannot be in the future' USING ERRCODE = '22023';
  END IF;
  IF v_until IS NOT NULL AND v_until < v_date THEN
    RAISE EXCEPTION 'The last day cannot be before the date of the letter' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Keep the reason to 500 characters' USING ERRCODE = '22023';
  END IF;
  IF v_path IS NOT NULL AND (char_length(v_path) > 500 OR split_part(v_path, '/', 1) <> v_practice::text
                             OR split_part(v_path, '/', 2) <> 'patient-documents') THEN
    RAISE EXCEPTION 'The letter must be stored in this practice''s patient records' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO patient_referrals (practice_id, patient_id, referring_name, referring_practice_number, referring_hpcna,
                                   referral_number, referral_date, valid_until, reason, letter_path, letter_name,
                                   created_by, updated_by)
    VALUES (v_practice, p_patient_id, v_name, v_number, v_hpcna, v_ref, v_date, v_until, v_reason, v_path, v_file,
            auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE patient_referrals
       SET referring_name = v_name, referring_practice_number = v_number, referring_hpcna = v_hpcna,
           referral_number = v_ref, referral_date = v_date, valid_until = v_until, reason = v_reason,
           letter_path = v_path, letter_name = v_file, updated_by = auth.uid(), updated_at = now()
     WHERE id = p_id AND patient_id = p_patient_id AND practice_id = v_practice AND removed_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'The referral was not found on this patient''s file' USING ERRCODE = 'P0002';
    END IF;
    -- Lines that name this referral, in an open claim batch, are claimed with its new details (a sent batch never changes)
    PERFORM sync_invoice_to_batch(i.id)
       FROM invoices_enhanced i
      WHERE i.batch_id IS NOT NULL AND i.id IN (SELECT s.invoice_id FROM invoice_services s WHERE s.referral_id = v_id);
  END IF;
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.remove_patient_referral(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_patient uuid;
BEGIN
  SELECT patient_id INTO v_patient FROM patient_referrals WHERE id = p_id;
  PERFORM claim_register_practice(v_patient);
  UPDATE patient_referrals SET removed_at = now(), removed_by = auth.uid() WHERE id = p_id AND removed_at IS NULL;
  -- Lines that named it are claimed with the visit's referral again (open claim batches only)
  PERFORM sync_invoice_to_batch(i.id)
     FROM invoices_enhanced i
    WHERE i.batch_id IS NOT NULL AND i.id IN (SELECT s.invoice_id FROM invoice_services s WHERE s.referral_id = p_id);
END
$function$;

-- Puts an authorisation's number on the patient's lines billed in its window that have none: claimed from its fund (as
-- sync_invoice_to_batch reads the patient's fund), its codes, not cancelled, not paid by the patient, not in a batch
-- the fund was sent, oldest first and within the visits allowed (a visit already carrying the number counts once).
-- Returns how many lines it numbered; each change rebuilds the open claim lines (handle_invoice_service_change).
CREATE OR REPLACE FUNCTION public.claim_authorisation_apply(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth    patient_authorisations%ROWTYPE;
  v_fund    text;
  v_visits  uuid[];
  v_line    record;
  v_applied integer := 0;
BEGIN
  SELECT * INTO v_auth FROM patient_authorisations WHERE id = p_id AND removed_at IS NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  SELECT upper(btrim(map.medical_aid_reference)) INTO v_fund
    FROM medical_aid_details mad JOIN medical_aid_providers map ON mad.medical_aid_provider_id = map.id
   WHERE mad.patient_id = v_auth.patient_id LIMIT 1;
  IF v_fund IS DISTINCT FROM v_auth.fund_reference THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT i.visit_id), '{}') INTO v_visits
    FROM invoice_services s JOIN invoices_enhanced i ON i.id = s.invoice_id
   WHERE i.patient_id = v_auth.patient_id AND i.practice_id = v_auth.practice_id
     AND upper(btrim(s.authorisation_number)) = upper(v_auth.authorisation_number)
     AND NOT ar_is_cancelled(i.payment_status);
  FOR v_line IN
    SELECT s.id, i.visit_id
      FROM invoice_services s
      JOIN invoices_enhanced i ON i.id = s.invoice_id
      LEFT JOIN visits v ON v.id = i.visit_id
     WHERE i.patient_id = v_auth.patient_id AND i.practice_id = v_auth.practice_id
       AND NULLIF(btrim(s.authorisation_number), '') IS NULL
       AND s.paid_by IS DISTINCT FROM 'patient'
       AND COALESCE(i.medical_aid_total, 0) > 0
       AND NOT ar_is_cancelled(i.payment_status)
       AND COALESCE(s.service_date, v.visit_date, i.issue_date) BETWEEN v_auth.valid_from AND v_auth.valid_to
       AND (v_auth.all_codes OR upper(btrim(s.code)) = ANY (v_auth.codes))
       AND NOT EXISTS (SELECT 1 FROM batch_headers b WHERE b.id = i.batch_id
                         AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready')))
     ORDER BY COALESCE(s.service_date, v.visit_date, i.issue_date), i.created_at, s.system_transaction_number
  LOOP
    IF v_auth.visits_allowed IS NOT NULL AND NOT (v_line.visit_id = ANY (v_visits)) THEN
      CONTINUE WHEN cardinality(v_visits) >= v_auth.visits_allowed;
      v_visits := array_append(v_visits, v_line.visit_id);
    END IF;
    UPDATE invoice_services SET authorisation_number = v_auth.authorisation_number, updated_at = now() WHERE id = v_line.id;
    v_applied := v_applied + 1;
  END LOOP;
  RETURN v_applied;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_patient_authorisation(p_id uuid, p_patient_id uuid, p_authorisation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_practice uuid := claim_register_practice(p_patient_id);
  v_fund     text := upper(btrim(COALESCE(p_authorisation->>'fund_reference', '')));
  v_number   text := btrim(COALESCE(p_authorisation->>'authorisation_number', ''));
  v_note     text := NULLIF(btrim(COALESCE(p_authorisation->>'note', '')), '');
  v_codes    text[] := '{}';
  v_from     date;
  v_to       date;
  v_all      boolean;
  v_visits   integer;
  v_quote    uuid;
  v_id       uuid;
BEGIN
  BEGIN
    v_from := NULLIF(p_authorisation->>'valid_from', '')::date;
    v_to := NULLIF(p_authorisation->>'valid_to', '')::date;
    v_all := COALESCE(NULLIF(p_authorisation->>'all_codes', '')::boolean, false);
    v_visits := NULLIF(p_authorisation->>'visits_allowed', '')::integer;
    v_quote := NULLIF(p_authorisation->>'quote_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A value of the authorisation is not valid' USING ERRCODE = '22023';
  END;
  -- The codes in capitals, each once, in the order given
  IF NOT v_all AND jsonb_typeof(p_authorisation->'codes') = 'array' THEN
    SELECT COALESCE(array_agg(c.code ORDER BY c.first_pos), '{}') INTO v_codes
      FROM (SELECT upper(btrim(e.value)) AS code, min(e.ordinality) AS first_pos
              FROM jsonb_array_elements_text(p_authorisation->'codes') WITH ORDINALITY AS e(value, ordinality)
             WHERE NULLIF(btrim(e.value), '') IS NOT NULL
             GROUP BY upper(btrim(e.value))) c;
  END IF;
  IF v_fund !~ '^[A-Z0-9]{2,10}$' THEN
    RAISE EXCEPTION 'Choose the fund that gave the authorisation' USING ERRCODE = '22023';
  END IF;
  IF v_number !~ '^[A-Za-z0-9/.-]{1,21}$' THEN
    RAISE EXCEPTION 'An authorisation number has at most 21 letters or digits (no spaces or commas)' USING ERRCODE = '22023';
  END IF;
  IF v_from IS NULL OR v_to IS NULL OR v_to < v_from THEN
    RAISE EXCEPTION 'The authorisation needs its first and last day, the last not before the first' USING ERRCODE = '22023';
  END IF;
  IF NOT v_all AND (cardinality(v_codes) = 0 OR cardinality(v_codes) > 50
                    OR array_to_string(v_codes, ',') !~ '^[0-9A-Z]{1,10}(,[0-9A-Z]{1,10})*$') THEN
    RAISE EXCEPTION 'List the tariff codes it covers (at most 50), or choose all codes' USING ERRCODE = '22023';
  END IF;
  IF v_visits IS NOT NULL AND (v_visits < 1 OR v_visits > 999) THEN
    RAISE EXCEPTION 'Visits allowed is a whole number from 1 to 999, or none for no limit' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 200 THEN
    RAISE EXCEPTION 'Keep the note to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF v_quote IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.id = v_quote AND q.patient_id = p_patient_id AND q.practice_id = v_practice) THEN
    RAISE EXCEPTION 'That quote is not on this patient''s file' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM patient_authorisations a
              WHERE a.patient_id = p_patient_id AND a.fund_reference = v_fund AND upper(a.authorisation_number) = upper(v_number)
                AND a.removed_at IS NULL AND a.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Authorisation % is already on this patient''s file', v_number USING ERRCODE = '23505';
  END IF;
  IF v_quote IS NOT NULL AND EXISTS (SELECT 1 FROM patient_authorisations a
              WHERE a.quote_id = v_quote AND a.removed_at IS NULL AND a.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'This quote''s authorisation is already on the patient''s file' USING ERRCODE = '23505';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO patient_authorisations (practice_id, patient_id, fund_reference, authorisation_number, valid_from, valid_to,
                                        all_codes, codes, visits_allowed, note, quote_id, created_by, updated_by)
    VALUES (v_practice, p_patient_id, v_fund, v_number, v_from, v_to, v_all, CASE WHEN v_all THEN '{}' ELSE v_codes END,
            v_visits, v_note, v_quote, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE patient_authorisations
       SET fund_reference = v_fund, authorisation_number = v_number, valid_from = v_from, valid_to = v_to,
           all_codes = v_all, codes = CASE WHEN v_all THEN '{}' ELSE v_codes END, visits_allowed = v_visits, note = v_note,
           quote_id = v_quote, updated_by = auth.uid(), updated_at = now()
     WHERE id = p_id AND patient_id = p_patient_id AND practice_id = v_practice AND removed_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'The authorisation was not found on this patient''s file' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'applied', claim_authorisation_apply(v_id));
END
$function$;

CREATE OR REPLACE FUNCTION public.remove_patient_authorisation(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_patient uuid;
BEGIN
  SELECT patient_id INTO v_patient FROM patient_authorisations WHERE id = p_id;
  PERFORM claim_register_practice(v_patient);
  -- Lines that carry the number keep it: the number is the line's, and staff change it there
  UPDATE patient_authorisations SET removed_at = now(), removed_by = auth.uid() WHERE id = p_id AND removed_at IS NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_visit_claim_details(p_visit_id uuid, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_practice  uuid;
  v_patient   uuid;
  v_referral  uuid;
  v_name      text := NULLIF(regexp_replace(btrim(COALESCE(p_details->>'referring_name', '')), '\s+', ' ', 'g'), '');
  v_number    text := NULLIF(regexp_replace(COALESCE(p_details->>'referring_practice_number', ''), '\s', '', 'g'), '');
  v_hpcna     text := NULLIF(upper(regexp_replace(COALESCE(p_details->>'referring_hpcna', ''), '\s', '', 'g')), '');
  v_ref       text := NULLIF(btrim(COALESCE(p_details->>'referral_number', '')), '');
  v_place     text := NULLIF(regexp_replace(COALESCE(p_details->>'place_of_service', ''), '\s', '', 'g'), '');
  v_hospital  boolean;
  v_admission date;
  v_discharge date;
  v_empty     boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(v.practice_id, p.practice_id), v.patient_id INTO v_practice, v_patient
    FROM visits v LEFT JOIN patients p ON p.id = v.patient_id WHERE v.id = p_visit_id;
  IF v_practice IS NULL OR v_practice IS DISTINCT FROM rls_my_practice_id() THEN
    RAISE EXCEPTION 'You can only change the visits of your own practice' USING ERRCODE = '42501';
  END IF;
  BEGIN
    v_referral := NULLIF(p_details->>'referral_id', '')::uuid;
    v_hospital := COALESCE(NULLIF(p_details->>'in_hospital', '')::boolean, false);
    v_admission := CASE WHEN v_hospital THEN NULLIF(p_details->>'admission_date', '')::date END;
    v_discharge := CASE WHEN v_hospital THEN NULLIF(p_details->>'discharge_date', '')::date END;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A value of the claim details is not valid' USING ERRCODE = '22023';
  END;
  IF v_referral IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patient_referrals r WHERE r.id = v_referral AND r.patient_id = v_patient
                                               AND r.practice_id = v_practice AND r.removed_at IS NULL) THEN
    RAISE EXCEPTION 'That referral is not on this patient''s file' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NOT NULL AND char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Keep the referring practitioner''s name to 100 characters' USING ERRCODE = '22023';
  END IF;
  IF v_number IS NOT NULL AND v_number !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'A practice number has 7 to 15 digits' USING ERRCODE = '22023';
  END IF;
  IF v_hpcna IS NOT NULL AND v_hpcna !~ '^[A-Z0-9]{2,15}$' THEN
    RAISE EXCEPTION 'An HPCNA number has letters and digits only, at most 15' USING ERRCODE = '22023';
  END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Za-z0-9/.-]{1,15}$' THEN
    RAISE EXCEPTION 'A referral number has at most 15 letters or digits (no spaces or commas)' USING ERRCODE = '22023';
  END IF;
  IF v_place IS NOT NULL AND v_place !~ '^(1[0-4]|2[0-4]|3[0-2]|4[0-6]|5[0-2]|6[0-6]|7[0-2]|8[0-3])$' THEN
    RAISE EXCEPTION 'A place of service is a two-digit code from the fund list' USING ERRCODE = '22023';
  END IF;
  IF v_discharge IS NOT NULL AND (v_admission IS NULL OR v_discharge < v_admission) THEN
    RAISE EXCEPTION 'The discharge needs the admission date and cannot be before it' USING ERRCODE = '22023';
  END IF;

  v_empty := v_referral IS NULL AND v_name IS NULL AND v_number IS NULL AND v_hpcna IS NULL AND v_ref IS NULL
             AND NOT v_hospital AND v_place IS NULL;
  IF v_empty THEN
    DELETE FROM visit_claim_details WHERE visit_id = p_visit_id;
  ELSE
    INSERT INTO visit_claim_details (visit_id, practice_id, referral_id, referring_name, referring_practice_number, referring_hpcna,
                                     referral_number, in_hospital, admission_date, discharge_date, place_of_service, updated_by, updated_at)
    VALUES (p_visit_id, v_practice, v_referral, v_name, v_number, v_hpcna, v_ref, v_hospital, v_admission, v_discharge, v_place,
            auth.uid(), now())
    ON CONFLICT (visit_id) DO UPDATE
      SET referral_id = EXCLUDED.referral_id, referring_name = EXCLUDED.referring_name,
          referring_practice_number = EXCLUDED.referring_practice_number, referring_hpcna = EXCLUDED.referring_hpcna,
          referral_number = EXCLUDED.referral_number, in_hospital = EXCLUDED.in_hospital,
          admission_date = EXCLUDED.admission_date, discharge_date = EXCLUDED.discharge_date,
          place_of_service = EXCLUDED.place_of_service, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  -- The visit's invoices in an open claim batch are claimed with the new details (a sent batch never changes)
  PERFORM sync_invoice_to_batch(i.id) FROM invoices_enhanced i WHERE i.visit_id = p_visit_id AND i.batch_id IS NOT NULL;
  RETURN jsonb_build_object('saved', NOT v_empty);
END
$function$;

REVOKE ALL ON FUNCTION public.claim_register_practice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_authorisation_apply(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_patient_referral(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_patient_referral(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_patient_authorisation(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_patient_authorisation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_visit_claim_details(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_patient_referral(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_patient_referral(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_patient_authorisation(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_patient_authorisation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_visit_claim_details(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. The claim builders: the referral, the hospital indicator and the place of service on every claim line
-- ---------------------------------------------------------------------------------------------

DO $migration$
DECLARE
  v_def text;
  -- New variables, in both functions
  v_vars text := $v$
    -- The visit's claim details and each line's referral (2026-10-12-referrals-and-authorisations.sql)
    v_claim public.visit_claim_details%ROWTYPE;
    v_ref_found BOOLEAN;
    v_ref_name TEXT;
    v_ref_practice TEXT;
    v_ref_hpcna TEXT;
    v_ref_number TEXT;
BEGIN$v$;
  -- Read once per invoice, before its lines
  v_read_claim text := $r$    -- The visit's referral, hospital stay and place of service (claim fields 25, 30, 42-44)
    SELECT * INTO v_claim FROM public.visit_claim_details WHERE visit_id = v_invoice.visit_id;

$r$;
  -- Per line: its own referral from the patient's register (not removed), else the visit's
  v_line_referral text := $l$        -- The referring practitioner: the line's own referral from the patient's register, else the visit's
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

$l$;
  -- Field 25: the practice number, else the name in capitals; 43 the council number; 44 the referral number (15 each,
  -- referralClaimFields in src/utils/billing/referrals.ts); 30 "H" for a hospital case; 42 the place of service
  v_values text := $x$
            btrim(left(btrim(regexp_replace(upper(COALESCE(NULLIF(btrim(v_ref_practice), ''), v_ref_name, '')), '[[:space:],"]+', ' ', 'g')), 15)),
            left(COALESCE(v_ref_hpcna, ''), 15), left(COALESCE(v_ref_number, ''), 15),
            CASE WHEN v_claim.in_hospital THEN 'H' ELSE '' END, COALESCE(v_claim.place_of_service, '')$x$;
  v_columns text := 'referring_doctor, referring_doctor_2, tracking_number, hospital_indicator, place_of_service';
  v_sync text[][] := ARRAY[
    ARRAY[$o$
    v_quadrant SMALLINT;
BEGIN$o$, $n$
    v_quadrant SMALLINT;$n$ || v_vars],
    ARRAY[$o$    -- Rebuild the batch details from scratch
$o$, v_read_claim || $n$    -- Rebuild the batch details from scratch
$n$],
    ARRAY[$o$        -- Insert the fresh, up-to-date record
$o$, v_line_referral || $n$        -- Insert the fresh, up-to-date record
$n$],
    ARRAY[$o$            diagnostic_code, authorisation_number, tooth_numbers, tooth_surfaces, tooth_quadrant
        ) VALUES ($o$, $n$            diagnostic_code, authorisation_number, tooth_numbers, tooth_surfaces, tooth_quadrant,
            $n$ || v_columns || $n$
        ) VALUES ($n$],
    ARRAY[$o$            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant
        );$o$, $n$            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant,
            -- Who referred the patient (fields 25, 43, 44), a hospital case (30) and the place of service (42)$n$ || v_values || $n$
        );$n$]
  ];
  v_add text[][] := ARRAY[
    ARRAY[$o$
    v_quadrant SMALLINT;
BEGIN$o$, $n$
    v_quadrant SMALLINT;$n$ || v_vars],
    ARRAY[$o$    -- Loop through each service on the invoice
$o$, v_read_claim || $n$    -- Loop through each service on the invoice
$n$],
    ARRAY[$o$        -- Insert into batch_details
$o$, v_line_referral || $n$        -- Insert into batch_details
$n$],
    ARRAY[$o$            gender, patient_id_number, patient_id, visit_id, tooth_numbers, tooth_surfaces, tooth_quadrant
        ) VALUES ($o$, $n$            gender, patient_id_number, patient_id, visit_id, tooth_numbers, tooth_surfaces, tooth_quadrant,
            authorisation_number, $n$ || v_columns || $n$
        ) VALUES ($n$],
    ARRAY[$o$            v_patient.id, v_invoice.visit_id,
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant
        );$o$, $n$            v_patient.id, v_invoice.visit_id,
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant,
            -- The fund's authorisation number for the line (claim field 31), as sync_invoice_to_batch carries it
            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), ''),
            -- Who referred the patient (fields 25, 43, 44), a hospital case (30) and the place of service (42)$n$ || v_values || $n$
        );$n$]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.sync_invoice_to_batch(uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_sync, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_sync[v_i][1], ''))) / length(v_sync[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'sync_invoice_to_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_sync[v_i][1], v_sync[v_i][2]);
  END LOOP;
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.add_invoice_to_batch(uuid, uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_add, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_add[v_i][1], ''))) / length(v_add[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'add_invoice_to_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_add[v_i][1], v_add[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 7. A corrected line bills under its new practitioner's practice number (the partner-billing rule)
-- ---------------------------------------------------------------------------------------------

DO $migration$
DECLARE
  v_def text;
  v_edits text[][] := ARRAY[
    ARRAY[$o$
  v_block    text;
BEGIN$o$, $n$
  v_block    text;
  -- The practice number the corrected line bills under (2026-10-12-referrals-and-authorisations.sql)
  v_number   text;
BEGIN$n$],
    ARRAY[$o$    'authorisation_number', COALESCE(v_detail.authorisation_number, ''));$o$,
          $n$    'authorisation_number', COALESCE(v_detail.authorisation_number, ''), 'practice_number', v_detail.practice_number);$n$],
    ARRAY[$o$      v_after := v_after || jsonb_build_object('practitioner_id', v_new_pract.id, 'hpcna', btrim(v_new_pract.hpcsa_number));
$o$, $n$      v_after := v_after || jsonb_build_object('practitioner_id', v_new_pract.id, 'hpcna', btrim(v_new_pract.hpcsa_number));
      -- Field 29: the new practitioner's own practice number when they have one, else the practice's, as
      -- sync_invoice_to_batch bills a line (src/utils/billing/practitionerBilling.ts, billingPracticeNumber)
      SELECT NULLIF(btrim(pb.practice_number), '') INTO v_number FROM practitioner_billing pb
       WHERE pb.practice_id = v_batch.practice_id AND pb.user_id = v_new_pract.id;
      v_number := COALESCE(v_number, (SELECT NULLIF(btrim(p.practice_number), '') FROM practices p WHERE p.id = v_batch.practice_id),
                           v_batch.practice_number);
      IF v_number IS DISTINCT FROM v_detail.practice_number THEN
        v_copy := v_copy || jsonb_build_object('practice_number', v_number);
        v_after := v_after || jsonb_build_object('practice_number', v_number);
      END IF;
$n$]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.claim_line_correct(uuid, jsonb, text)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_edits, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_edits[v_i][1], ''))) / length(v_edits[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'claim_line_correct: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_edits[v_i][1], v_edits[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 8. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['patient_referrals', 'patient_authorisations', 'visit_claim_details'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_sync text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure);
  v_add text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.add_invoice_to_batch(uuid, uuid)'::regprocedure);
  v_correct text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.claim_line_correct(uuid, jsonb, text)'::regprocedure);
  v_count text := 'paid_by IS DISTINCT FROM ''patient''';
  v_fn text;
BEGIN
  -- The referral, hospital and place-of-service fields, in both claim builders
  IF position('visit_claim_details' in v_sync) = 0 OR position('patient_referrals' in v_sync) = 0 OR position('place_of_service' in v_sync) = 0
     OR position('visit_claim_details' in v_add) = 0 OR position('patient_referrals' in v_add) = 0 OR position('place_of_service' in v_add) = 0
     OR position('v_service.authorisation_number' in v_add) = 0 THEN
    RAISE EXCEPTION 'Check failed: a claim builder does not carry the referral, hospital and place-of-service fields';
  END IF;
  -- Every earlier guard of the claim builder is still there
  IF (length(v_sync) - length(replace(v_sync, 'b.sent_at IS NOT NULL', ''))) / length('b.sent_at IS NOT NULL') <> 2
     OR position('AND NOT EXISTS (' in v_sync) = 0 OR position('no_claims' in v_sync) = 0
     OR position('GMED' in v_sync) = 0 OR position('''0201''' in v_sync) = 0 OR position('v_service.nappi_code' in v_sync) = 0
     OR position('icd10_primary' in v_sync) = 0 OR position('left(NULLIF(btrim(v_service.authorisation_number), ''''), 21)' in v_sync) = 0
     OR position('v_line_hpcna' in v_sync) = 0 OR position('practitioner_billing' in v_sync) = 0 OR position('v_surfaces, v_quadrant' in v_sync) = 0
     OR (length(v_sync) - length(replace(v_sync, v_count, ''))) / length(v_count) <> 2 THEN
    RAISE EXCEPTION 'Check failed: a guard of sync_invoice_to_batch is missing';
  END IF;
  IF position(v_count in v_add) = 0 OR position('rls_assert_my_practice' in v_add) = 0 OR position('v_line_hpcna' in v_add) = 0 THEN
    RAISE EXCEPTION 'Check failed: add_invoice_to_batch lost its practice check, claims the patient''s own lines or lost the line''s practitioner';
  END IF;
  IF position('practitioner_billing' in v_correct) = 0 OR position('''practice_number'', v_number' in v_correct) = 0
     OR position('claim_line_resend_blocker' in v_correct) = 0 OR position('claim_assert_staff' in v_correct) = 0 THEN
    RAISE EXCEPTION 'Check failed: claim_line_correct does not bill a new practitioner under their practice number, or lost a guard';
  END IF;
  -- Nobody gained a way in
  IF has_function_privilege('authenticated', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure AND a.grantee = 0)
     OR has_function_privilege('anon', 'public.add_invoice_to_batch(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_line_correct(uuid, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: a claim function can be run by the public key or app users';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.save_patient_referral(uuid, uuid, jsonb)', 'public.remove_patient_referral(uuid)',
                              'public.save_patient_authorisation(uuid, uuid, jsonb)', 'public.remove_patient_authorisation(uuid)',
                              'public.save_visit_claim_details(uuid, jsonb)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in staff only, running as its owner', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.claim_register_practice(uuid)', 'public.claim_authorisation_apply(uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is for the functions above only', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.patient_referrals', 'public.patient_authorisations', 'public.visit_claim_details'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_fn::regclass)
       OR has_table_privilege('anon', v_fn, 'SELECT')
       OR has_table_privilege('authenticated', v_fn, 'INSERT') OR has_table_privilege('authenticated', v_fn, 'UPDATE')
       OR has_table_privilege('authenticated', v_fn, 'DELETE') OR NOT has_table_privilege('authenticated', v_fn, 'SELECT') THEN
      RAISE EXCEPTION 'Check failed: % must be read by staff and changed only through its functions', v_fn;
    END IF;
  END LOOP;
  -- The policies of the practice-isolation tables (and the others read here) are as they were
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'visits', 'quotes', 'users')) THEN
    RAISE EXCEPTION 'Check failed: a policy of invoice_services, invoices_enhanced, patients, batch_details, batch_headers, visits, quotes or users changed';
  END IF;
END $$;

ROLLBACK;
