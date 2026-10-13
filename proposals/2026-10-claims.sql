-- =============================================================================================
-- PROPOSAL, NOT APPLIED: medical aid claims - ICD-10, fund rules, claim responses, auto-submit
-- File:   proposals/2026-10-claims.sql                    Drafted: 2026-10-06
-- Plain-language companion: proposals/2026-10-claims.md
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind. To turn it into a migration: review,
-- test on a Supabase branch, then change the final ROLLBACK to COMMIT.
--
-- Contents
--   0. Access helpers (RLS without recursion through users' own policies)
--   1. ICD-10 on invoice lines and batch lines (1 primary + up to 9 secondary codes)
--   2. visit_diagnoses: the diagnoses of a visit, confirmed by a doctor
--   3. (Superseded) medical_aid_fund_rules: now proposals/2026-10-12-fund-master.sql, applied 2026-10-12
--   4. claim_line_responses: fund responses per claim line (paid, rejected, rejection code)
--   5. practice_claim_settings + batch_headers.auto_submit_error: automatic submission
--   6. Indexes for the claims screens
--   7. RLS policies
--   8. (Commented out) corrections to add_invoice_to_batch() - compare with the live function first
--   9. remove_invoice_from_batch(): atomic removal of one invoice from an unsent batch
--
-- Code formats match src/utils/billing/icd10.ts: a letter, two digits, optional dot + 1-2 digits.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Access helpers. Same rule as existing policies: a user's practice comes from public.users
--    (super admins may see every practice). SECURITY DEFINER avoids recursion through users' RLS.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claims_can_read(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.practice_id = p_practice_id OR COALESCE(u.is_super_admin, false))
  )
$$;
COMMENT ON FUNCTION public.claims_can_read(uuid) IS
  'True when the signed-in user belongs to the practice (or is a super admin).';

CREATE OR REPLACE FUNCTION public.claims_can_manage(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND ((u.practice_id = p_practice_id AND u.role IN ('admin', 'doctor')) OR COALESCE(u.is_super_admin, false))
  )
$$;
COMMENT ON FUNCTION public.claims_can_manage(uuid) IS
  'True for the practice''s admins and doctors (and super admins): they confirm diagnoses and change claim settings.';

CREATE OR REPLACE FUNCTION public.is_icd10_code(p_code text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$'
$$;

CREATE OR REPLACE FUNCTION public.are_icd10_codes(p_codes text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(bool_and(public.is_icd10_code(code)), true) FROM unnest(p_codes) AS code
$$;

-- ---------------------------------------------------------------------------------------------
-- 1. ICD-10 on invoice lines and batch lines. NAMAF: no ICD-10, no payment; one primary code and
--    up to 9 secondary codes per line; an external cause code (V01-Y98) is never the primary.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services
  ADD COLUMN IF NOT EXISTS icd10_primary text,
  ADD COLUMN IF NOT EXISTS icd10_secondary text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.batch_details
  ADD COLUMN IF NOT EXISTS diagnostic_codes_secondary text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_icd10_valid') THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_icd10_valid CHECK (
      (icd10_primary IS NULL OR (public.is_icd10_code(icd10_primary) AND icd10_primary !~ '^[VWXY]'))
      AND cardinality(icd10_secondary) <= 9
      AND public.are_icd10_codes(icd10_secondary)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batch_details_secondary_icd10_valid') THEN
    ALTER TABLE public.batch_details ADD CONSTRAINT batch_details_secondary_icd10_valid CHECK (
      cardinality(diagnostic_codes_secondary) <= 9 AND public.are_icd10_codes(diagnostic_codes_secondary)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.invoice_services.icd10_primary IS 'Primary ICD-10 diagnosis for this line (e.g. J06.9).';
COMMENT ON COLUMN public.invoice_services.icd10_secondary IS 'Up to 9 secondary ICD-10 codes for this line.';
COMMENT ON COLUMN public.batch_details.diagnostic_codes_secondary IS 'Secondary ICD-10 codes; the primary stays in diagnostic_code.';

-- ---------------------------------------------------------------------------------------------
-- 2. Visit diagnoses: what the doctor diagnosed, independent of billing. The billing screen copies
--    them onto the invoice lines; the claims screen reads them as confirmed codes.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.visit_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  icd10_code text NOT NULL CHECK (public.is_icd10_code(icd10_code)),
  is_primary boolean NOT NULL DEFAULT false,
  sequence smallint NOT NULL DEFAULT 1 CHECK (sequence BETWEEN 1 AND 10),
  description text,
  confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_diagnoses_unique_code UNIQUE (visit_id, icd10_code),
  CONSTRAINT visit_diagnoses_primary_not_external_cause CHECK (NOT (is_primary AND icd10_code ~ '^[VWXY]'))
);
CREATE UNIQUE INDEX IF NOT EXISTS visit_diagnoses_one_primary ON public.visit_diagnoses (visit_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS visit_diagnoses_practice_idx ON public.visit_diagnoses (practice_id, visit_id);
COMMENT ON TABLE public.visit_diagnoses IS 'ICD-10 diagnoses of a visit: one primary, up to 9 secondary.';

-- ---------------------------------------------------------------------------------------------
-- 3. Fund rules: superseded. medical_aid_fund_rules (deadline and whether it is confirmed, claims portal,
--    membership-number lengths, dependant code, payment terms), its change history and the save_fund_rule
--    function are in proposals/2026-10-12-fund-master.sql (applied 2026-10-12); the claims email stays
--    medical_aid_providers.email. Nothing for that table is created or granted here any more.
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 4. Claim line responses: what the fund did with each line. Rejected or short-paid lines that are
--    not yet resubmitted form the "to resubmit" worklist (resubmission_flag on the new batch line).
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.claim_line_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  batch_header_id uuid NOT NULL REFERENCES public.batch_headers(id) ON DELETE CASCADE,
  batch_detail_id uuid REFERENCES public.batch_details(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  system_transaction_number integer,
  response_status text NOT NULL CHECK (response_status IN ('accepted', 'paid', 'partially_paid', 'rejected', 'pended', 'reversed')),
  amount_claimed numeric(12,2) CHECK (amount_claimed IS NULL OR amount_claimed >= 0),
  amount_paid numeric(12,2) CHECK (amount_paid IS NULL OR amount_paid >= 0),
  rejection_code text,
  rejection_reason text,
  remittance_reference text,
  response_date date NOT NULL DEFAULT current_date,
  resubmitted_in_batch_id uuid REFERENCES public.batch_headers(id) ON DELETE SET NULL,
  resubmitted_at timestamptz,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_line_responses_rejection_has_code CHECK (response_status <> 'rejected' OR rejection_code IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS claim_line_responses_batch_idx ON public.claim_line_responses (batch_header_id);
CREATE INDEX IF NOT EXISTS claim_line_responses_invoice_idx ON public.claim_line_responses (invoice_id);
CREATE INDEX IF NOT EXISTS claim_line_responses_to_resubmit_idx ON public.claim_line_responses (practice_id, response_date)
  WHERE response_status IN ('rejected', 'partially_paid') AND resubmitted_in_batch_id IS NULL;
COMMENT ON TABLE public.claim_line_responses IS
  'Fund response per claim line, with the NAMAF/fund rejection code, for follow-up and resubmission.';

-- ---------------------------------------------------------------------------------------------
-- 5. Automatic submission (supabase/functions-proposals/auto-submit-claims). Off by default.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practice_claim_settings (
  practice_id uuid PRIMARY KEY REFERENCES public.practices(id) ON DELETE CASCADE,
  auto_submit_enabled boolean NOT NULL DEFAULT false,
  min_days_open integer NOT NULL DEFAULT 7 CHECK (min_days_open >= 0),
  notify_email text,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.practice_claim_settings IS
  'Per-practice switch for automatic claim submission; min_days_open lets lines collect before sending.';

ALTER TABLE public.batch_headers ADD COLUMN IF NOT EXISTS auto_submit_error text;
COMMENT ON COLUMN public.batch_headers.auto_submit_error IS
  'Why automatic submission held this batch (validation errors, missing claims address, repeated email failure).';

-- The auto-submit function moves a batch active -> sending -> sent. If batch_headers.status has a
-- CHECK constraint, it must allow 'sending'. Inspect it with:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.batch_headers'::regclass;

-- ---------------------------------------------------------------------------------------------
-- 6. Indexes for the claims screens (use CREATE INDEX CONCURRENTLY outside a transaction on a
--    busy database).
-- ---------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS invoices_enhanced_unbatched_idx
  ON public.invoices_enhanced (practice_id, issue_date DESC) WHERE batch_id IS NULL;
CREATE INDEX IF NOT EXISTS batch_details_header_line_idx
  ON public.batch_details (batch_header_id, transaction_number_in_batch);
CREATE INDEX IF NOT EXISTS batch_submissions_header_idx
  ON public.batch_submissions (batch_header_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS batch_headers_practice_status_idx
  ON public.batch_headers (practice_id, status, batch_date DESC);

-- ---------------------------------------------------------------------------------------------
-- 7. RLS. Practice members read their practice's rows; admins and doctors change them. The
--    service role (edge functions) bypasses RLS. Fund rules: see proposals/2026-10-12-fund-master.sql.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.visit_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_line_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_claim_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visit_diagnoses_read ON public.visit_diagnoses;
CREATE POLICY visit_diagnoses_read ON public.visit_diagnoses
  FOR SELECT TO authenticated USING (public.claims_can_read(practice_id));
DROP POLICY IF EXISTS visit_diagnoses_write ON public.visit_diagnoses;
CREATE POLICY visit_diagnoses_write ON public.visit_diagnoses
  FOR ALL TO authenticated
  USING (public.claims_can_manage(practice_id))
  WITH CHECK (
    public.claims_can_manage(practice_id)
    AND EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.practice_id = visit_diagnoses.practice_id)
  );

DROP POLICY IF EXISTS claim_line_responses_read ON public.claim_line_responses;
CREATE POLICY claim_line_responses_read ON public.claim_line_responses
  FOR SELECT TO authenticated USING (public.claims_can_read(practice_id));
DROP POLICY IF EXISTS claim_line_responses_write ON public.claim_line_responses;
CREATE POLICY claim_line_responses_write ON public.claim_line_responses
  FOR ALL TO authenticated
  USING (public.claims_can_read(practice_id))
  WITH CHECK (
    public.claims_can_read(practice_id)
    AND EXISTS (SELECT 1 FROM public.batch_headers b WHERE b.id = batch_header_id AND b.practice_id = claim_line_responses.practice_id)
  );

DROP POLICY IF EXISTS practice_claim_settings_read ON public.practice_claim_settings;
CREATE POLICY practice_claim_settings_read ON public.practice_claim_settings
  FOR SELECT TO authenticated USING (public.claims_can_read(practice_id));
DROP POLICY IF EXISTS practice_claim_settings_write ON public.practice_claim_settings;
CREATE POLICY practice_claim_settings_write ON public.practice_claim_settings
  FOR ALL TO authenticated
  USING (public.claims_can_manage(practice_id))
  WITH CHECK (public.claims_can_manage(practice_id));

-- ---------------------------------------------------------------------------------------------
-- 8. (Commented out on purpose) add_invoice_to_batch() corrections.
--    The version in UPDATE_BATCH_SYSTEM_FOR_EXISTING_TABLES.sql fills batch_details with:
--      treating_doctor_hpcsa_number = 'DEN00417' for every line   -> must be the treating doctor's number
--      system_patient_reference_number = patient UUID             -> must be patients.system_patient_reference_number
--      service_date = invoice issue date                          -> must be the visit (service) date
--      member_initials = first letter of the first name only      -> all initials of the main member
--      no diagnostic_code                                         -> invoice_services.icd10_primary
--    The claims screen already corrects these when it builds the file
--    (src/components/finance/claims/buildClaimLines.ts). Compare with the live function
--    (\sf public.add_invoice_to_batch) before replacing it; the column list to change is:
--
--    INSERT INTO batch_details (..., system_patient_reference_number, service_date,
--                               treating_doctor_hpcsa_number, diagnostic_code, diagnostic_code_type,
--                               diagnostic_codes_secondary, tooth_numbers, system_transaction_number, ...)
--    VALUES (..., LPAD(v_patient.system_patient_reference_number::text, 7, '0'),
--            TO_CHAR(COALESCE(v_visit.visit_date, v_invoice.issue_date), 'YYYY-MM-DD'),
--            COALESCE(v_doctor.hpcsa_number, ''), v_service.icd10_primary, 'D',
--            v_service.icd10_secondary, COALESCE(v_service.tooth_number, ''),
--            v_service.system_transaction_number, ...);
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 9. Atomic "remove an invoice from an UNSENT batch". The Finance screen does the same today in
--    separate calls (claimsService.removeInvoiceFromBatch); this does it in one transaction with
--    the batch row locked, so an automatic submission cannot start half-way. Header totals and
--    the trailer follow from the batch_details trigger. SECURITY INVOKER: RLS still applies.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_invoice_from_batch(p_batch_id uuid, p_invoice_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_batch record;
  v_removed integer;
BEGIN
  SELECT id, status, sent_at INTO v_batch FROM public.batch_headers WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  IF v_batch.sent_at IS NOT NULL OR lower(COALESCE(v_batch.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready') THEN
    RAISE EXCEPTION 'Batch % has already been submitted; its lines cannot change', p_batch_id;
  END IF;
  DELETE FROM public.batch_details WHERE batch_header_id = p_batch_id AND invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  UPDATE public.invoices_enhanced SET batch_id = NULL, updated_at = now()
  WHERE id = p_invoice_id AND batch_id = p_batch_id;
  RETURN v_removed;
END;
$$;
COMMENT ON FUNCTION public.remove_invoice_from_batch(uuid, uuid) IS
  'Takes one invoice out of an unsent claim batch (deletes its batch lines, clears its batch link); returns lines removed.';

ROLLBACK;  -- change to COMMIT after review and a successful test on a branch database

-- Rollback of a committed version (run in this order):
--   DROP TABLE IF EXISTS public.claim_line_responses, public.visit_diagnoses,
--                        public.practice_claim_settings;
--   ALTER TABLE public.batch_headers DROP COLUMN IF EXISTS auto_submit_error;
--   ALTER TABLE public.batch_details DROP CONSTRAINT IF EXISTS batch_details_secondary_icd10_valid,
--                                    DROP COLUMN IF EXISTS diagnostic_codes_secondary;
--   ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_icd10_valid,
--                                       DROP COLUMN IF EXISTS icd10_primary, DROP COLUMN IF EXISTS icd10_secondary;
--   DROP INDEX IF EXISTS public.invoices_enhanced_unbatched_idx, public.batch_details_header_line_idx,
--                        public.batch_submissions_header_idx, public.batch_headers_practice_status_idx;
--   DROP FUNCTION IF EXISTS public.remove_invoice_from_batch(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.are_icd10_codes(text[]), public.is_icd10_code(text),
--                           public.claims_can_manage(uuid), public.claims_can_read(uuid);
