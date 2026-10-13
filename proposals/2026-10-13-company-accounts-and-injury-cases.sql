-- Applied 2026-10-13 as migration company_accounts_and_injury_cases_2026_10_13 (version 20261013012855; stored statement md5 fd0b438174f501f2d796e690bca4ef38 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins and invented data (rolled back; twice, the second with the exact bodies): reception
-- made AC-0001 (name tidied, email lower-cased, postal address kept on two lines); the same name, an old region, a bad
-- email, an unknown kind, a changed kind (22023/23505) and a direct insert (42501) were refused. An employee was linked
-- (number changed on a second link, unlinked and linked again). Visit 1 billed to the company: every line the account's,
-- fund 0, out of the open NMC1 batch (0 claim lines); a line added later was the account's too; billed back to the
-- patient: 400/100, 300/0 as before and the later line split by the database's rule, claimed again (3 lines); a one-line
-- invoice there and back was claimed again. An IOD case made the compensation fund's account (AC-0002), an MVA case the
-- MVA Fund's; a future date, no employer and a bad claim number were refused (22023); a closed case and the fund
-- without a case were refused; changing the case's payer to the employer and to the patient moved its visit. The
-- company paid N$300 (receipt "other", linked, invoice owing 700); a payment to another invoice was refused; the visit
-- then stayed billed to the company (55000). Reception could not close (42501), the administrator not while it owed
-- (55000); an unused account closed and ended its links. Another practice's staff: 42501 on every function, 0 rows;
-- anon 42501; a patient-app login 0 rows and 42501. The payer history cannot be changed. Sent claim lines unchanged.
-- =============================================================================================
-- PROPOSAL: company (employer) accounts and the other accounts that pay for patients (the Employees' Compensation
--           Fund, the MVA Fund, an insurer); injury on duty, occupational disease and motor vehicle accident cases on
--           the patient's file; who pays for a visit (parity A14, A19; the lists of R29)
-- File:   proposals/2026-10-13-company-accounts-and-injury-cases.sql     Drafted: 2026-10-13
-- Code:   src/utils/accounts/payerAccounts.ts and injuryCases.ts (the rules below, the account's age bands and
--         statement; tested), src/services/payerAccountService.ts and injuryCaseService.ts ("not set up yet" before
--         this file), src/components/accounts/* (Finance > Debtors > Companies, the patient file's Billing tab, the
--         visit's Billing tab), src/components/patientLists/specialLists/* (Messages > Lists > Injury and accident cases)
--
-- Why
--   A14: an employer pays for its employees' visits (pre-employment and occupational medicals, staff clinics). The
--        practice had nowhere to keep the employer as a payer: its invoices were the patient's, its money could not
--        be matched to them, and it had no statement or age analysis of its own. Eminance keeps company accounts.
--   A19: an injury on duty or an occupational disease is paid by the Employees' Compensation Fund of the Social
--        Security Commission, a road accident by the MVA Fund. The details (employer, employee number, date of
--        injury, the fund's claim number) were typed nowhere and every visit of the case started again. Eminance keeps
--        them once (WCA) and reuses them.
--
-- What it does (additive; the policies of the protected tables, invoice_services and invoices_enhanced among them,
-- are not touched; no row is rewritten now)
--   1. payer_accounts: an account that pays for patients: an employer (company account), the Employees' Compensation
--      Fund, the MVA Fund or another payer (an insurer). Numbered per practice (AC-0001). One compensation fund
--      account and one MVA Fund account per practice, made when the first case needs it.
--   2. payer_account_members: the employees (patients) of an employer account, with their employee number.
--   3. patient_injury_cases: a case on the patient's file: injury on duty, occupational disease or motor vehicle
--      accident, the date, the employer (an account or a typed name) and employee number, the fund's claim number,
--      notes, who pays (the fund, the employer, another account or the patient), open or closed.
--   4. visit_payers: who pays for a visit when it is not the patient: an account, and the case it belongs to. A visit
--      without a row is billed to the patient (and their medical aid) as before. visit_payer_changes keeps every
--      change with each invoice line as it was (append-only).
--   5. The line rule: every line of an invoice whose visit is billed to an account is the account's (paid_by
--      'patient', so the patient's medical aid is never claimed for it: the claim builder leaves the invoice out, and
--      takes it out of a batch not sent yet). A BEFORE trigger on invoice_services named to run before
--      invoice_services_fill_split. The account pays the invoice's patient portion: the ar_* ledger is unchanged and
--      a company's balance, statement and age analysis are its invoices' balances (no second ledger).
--   6. payer_account_receipts: which receipts an account paid (post_payer_account_receipt records the receipt
--      through ar_post_receipt as "someone else" paid, allocated only to that account's invoices).
--   7. Writes only through SECURITY DEFINER functions for staff of the practice: save_payer_account,
--      close_payer_account (administrators and practitioners; only when it owes nothing), link_payer_account_patient,
--      unlink_payer_account_patient, save_injury_case, remove_injury_case, set_visit_payer,
--      post_payer_account_receipt. Who pays for a visit changes for every invoice of the visit or for none: an invoice
--      already sent to a medical aid (claims already sent are never touched), with money received, a credit note,
--      write-off, discount or correction, or dated in a closed month keeps its payer, and the function says why.
--      Billed back to the patient, each line is split as it was before (else by the database's rule) and the claim
--      builder claims it again.
--   8. Staff of the practice read the tables; the patient app's logins read nothing (portal_staff_only); anon has
--      nothing.
--   No claim file is made for the Employees' Compensation Fund or the MVA Fund: their invoices and statements are
--   printed or emailed. Claim fields 50-53 (injury on duty) are not filled: those visits are not claimed from a
--   medical aid (see the report: the funds' claim formats are for the owner to confirm).
--   Patient merges move cases and memberships with the file (patient_merge_columns finds every column with a foreign
--   key to patients). Needs 2026-10-07-receipts-and-allocations.sql, 2026-10-07-debtors-and-controls.sql,
--   2026-10-07-practice-isolation.sql (rls_my_practice_id), 2026-10-09-line-portions.sql (paid_by) and
--   2026-10-13-patient-town.sql (namibian_region).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the screens say company accounts and cases are not set up yet; billing works as before.
-- Undo (no invoice depends on these tables: bill every visit back to the patient first, then):
--   DROP TRIGGER IF EXISTS invoice_services_a_payer_account ON public.invoice_services;
--   DROP FUNCTION IF EXISTS public.post_payer_account_receipt(uuid, jsonb), public.set_visit_payer(uuid, jsonb),
--     public.remove_injury_case(uuid, text), public.save_injury_case(uuid, uuid, uuid, jsonb),
--     public.unlink_payer_account_patient(uuid, uuid, text), public.link_payer_account_patient(uuid, uuid, text),
--     public.close_payer_account(uuid, text), public.save_payer_account(uuid, uuid, jsonb),
--     public.pa_apply_payer(uuid, uuid, uuid, text), public.pa_invoice_problem(uuid), public.pa_standard_account(uuid, text),
--     public.pa_next_account_number(uuid), public.pa_field(text, text, integer, boolean), public.pa_line_billed_to_account();
--   DROP TABLE IF EXISTS public.payer_account_receipts, public.visit_payer_changes, public.visit_payers,
--     public.patient_injury_cases, public.payer_account_members, public.payer_accounts;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.receipts'), ('public.receipt_allocations'), ('public.invoice_adjustments'), ('public.ar_invoice_balances'),
                 ('public.batch_headers'), ('public.batch_details'), ('public.period_closes')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: % (receipts and debtors proposals)', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.ar_post_receipt(jsonb)'), ('public.ar_is_cancelled(text)'), ('public.ar_today()'), ('public.ar_format_nad(numeric)'),
                 ('public.dc_assert_member(uuid)'), ('public.dc_assert_role(uuid,text[],text)'), ('public.dc_assert_patient(uuid,uuid)'),
                 ('public.dc_assert_open(uuid,date,text)'), ('public.dc_invoice_date(date,timestamp with time zone)'),
                 ('public.dc_no_truncate()'), ('public.ar_audit_append_only()'), ('public.rls_my_practice_id()'),
                 ('public.invoice_services_fill_split()'), ('public.sync_invoice_to_batch(uuid)')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  IF to_regtype('public.namibian_region') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-13-patient-town.sql first (namibian_region)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'invoice_services' AND column_name = 'paid_by') THEN
    RAISE EXCEPTION 'Stopped: invoice_services.paid_by is missing (2026-10-09-line-portions.sql)';
  END IF;
  -- The policies of the protected tables, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN (
       'automation_definitions', 'automation_queue', 'invoice_services', 'invoices_enhanced', 'lab_requests', 'lab_results',
       'medical_aid_providers', 'medical_aid_schemes', 'medical_aid_service_prices_retired', 'message_templates', 'messages',
       'oauth_callback_tokens', 'patient_documents', 'patients', 'practice_email_subscriptions', 'practice_features',
       'practice_inventory', 'practice_service_subscriptions', 'practice_sms_subscriptions', 'practice_tariffs', 'practice_types',
       'practices', 'sms_logs', 'sms_plans', 'system_notifications', 'user_practice_assignments', 'user_profiles', 'users', 'visits')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Accounts that pay for patients
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payer_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id         uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- employer: a company account; compensation_fund: the Employees' Compensation Fund (Social Security Commission);
  -- mva_fund: the Motor Vehicle Accident Fund; other: an insurer or another organisation
  kind                text NOT NULL CHECK (kind IN ('employer', 'compensation_fund', 'mva_fund', 'other')),
  name                text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  -- The practice's number for the account (AC-0001), the reference a payment quotes
  account_number      text NOT NULL,
  registration_number text CHECK (registration_number IS NULL OR char_length(registration_number) <= 40),
  vat_number          text CHECK (vat_number IS NULL OR char_length(vat_number) <= 30),
  contact_name        text CHECK (contact_name IS NULL OR char_length(contact_name) <= 100),
  phone               text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email               text CHECK (email IS NULL OR (char_length(email) <= 200 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  postal_address      text CHECK (postal_address IS NULL OR char_length(postal_address) <= 300),
  town                text CHECK (town IS NULL OR char_length(btrim(town)) BETWEEN 1 AND 80),
  region              public.namibian_region,
  notes               text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  closed_by           uuid,
  close_reason        text,
  CONSTRAINT payer_accounts_number_unique UNIQUE (practice_id, account_number),
  CONSTRAINT payer_accounts_close_complete CHECK (
    (closed_at IS NULL AND closed_by IS NULL AND close_reason IS NULL)
    OR (closed_at IS NOT NULL AND char_length(btrim(COALESCE(close_reason, ''))) >= 3)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS payer_accounts_open_name ON public.payer_accounts (practice_id, lower(btrim(name))) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payer_accounts_one_fund ON public.payer_accounts (practice_id, kind)
  WHERE closed_at IS NULL AND kind IN ('compensation_fund', 'mva_fund');
COMMENT ON TABLE public.payer_accounts IS
  'Accounts that pay for patients (parity A14): employers (company accounts), the Employees'' Compensation Fund, the MVA Fund and other payers. Their invoices are the invoices of visits billed to them (visit_payers); their balances come from the ar_* ledger. Changed only through save_payer_account and close_payer_account.';

-- ---------------------------------------------------------------------------------------------
-- 2. The employees of an employer account
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payer_account_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  payer_account_id uuid NOT NULL REFERENCES public.payer_accounts(id) ON DELETE RESTRICT,
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  employee_number  text CHECK (employee_number IS NULL OR employee_number ~ '^[A-Za-z0-9/. -]{1,30}$'),
  linked_by        uuid,
  linked_at        timestamptz NOT NULL DEFAULT now(),
  unlinked_at      timestamptz,
  unlinked_by      uuid,
  unlink_reason    text,
  CONSTRAINT payer_account_members_unlink_complete CHECK (
    (unlinked_at IS NULL AND unlinked_by IS NULL AND unlink_reason IS NULL)
    OR (unlinked_at IS NOT NULL AND char_length(btrim(COALESCE(unlink_reason, ''))) >= 3)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS payer_account_members_open ON public.payer_account_members (payer_account_id, patient_id) WHERE unlinked_at IS NULL;
CREATE INDEX IF NOT EXISTS payer_account_members_patient_idx ON public.payer_account_members (patient_id) WHERE unlinked_at IS NULL;
COMMENT ON TABLE public.payer_account_members IS
  'The patients an employer (or other) account pays for, with their employee number. Ended links (unlinked_at) are history. Changed only through link_payer_account_patient and unlink_payer_account_patient.';

-- ---------------------------------------------------------------------------------------------
-- 3. Injury on duty, occupational disease and motor vehicle accident cases
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_injury_cases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id         uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  patient_id          uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_type           text NOT NULL CHECK (case_type IN ('injury_on_duty', 'occupational_disease', 'motor_vehicle_accident')),
  -- The day of the injury or accident; for an occupational disease, the day it was diagnosed
  injury_date         date NOT NULL,
  -- The employer: one of the practice's accounts, or a name typed
  employer_account_id uuid REFERENCES public.payer_accounts(id) ON DELETE RESTRICT,
  employer_name       text CHECK (employer_name IS NULL OR char_length(btrim(employer_name)) BETWEEN 2 AND 120),
  employee_number     text CHECK (employee_number IS NULL OR employee_number ~ '^[A-Za-z0-9/. -]{1,30}$'),
  -- The fund's claim or case number (often only known weeks later)
  claim_number        text CHECK (claim_number IS NULL OR claim_number ~ '^[A-Za-z0-9/. -]{1,30}$'),
  -- Who pays the case's visits; NULL: the patient (and their medical aid), e.g. after the fund refused the claim
  payer_account_id    uuid REFERENCES public.payer_accounts(id) ON DELETE RESTRICT,
  notes               text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  closed_at           timestamptz,
  closed_by           uuid,
  removed_at          timestamptz,
  removed_by          uuid,
  remove_reason       text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_injury_cases_employer_check CHECK (
    case_type = 'motor_vehicle_accident' OR employer_account_id IS NOT NULL OR employer_name IS NOT NULL
  ),
  CONSTRAINT patient_injury_cases_remove_complete CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND remove_reason IS NULL)
    OR (removed_at IS NOT NULL AND char_length(btrim(COALESCE(remove_reason, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS patient_injury_cases_patient_idx ON public.patient_injury_cases (patient_id, injury_date DESC);
CREATE INDEX IF NOT EXISTS patient_injury_cases_practice_idx ON public.patient_injury_cases (practice_id, case_type, injury_date DESC) WHERE removed_at IS NULL;
COMMENT ON TABLE public.patient_injury_cases IS
  'Injury on duty, occupational disease and motor vehicle accident cases on a patient''s file (parity A19), entered once and reused by every visit of the case. Changed only through save_injury_case and remove_injury_case; a removed case stays for the record.';

-- ---------------------------------------------------------------------------------------------
-- 4. Who pays for a visit, and every change of it
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visit_payers (
  visit_id         uuid PRIMARY KEY REFERENCES public.visits(id) ON DELETE CASCADE,
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- The account billed for the visit; NULL with a case: the case is the patient's to pay
  payer_account_id uuid REFERENCES public.payer_accounts(id) ON DELETE RESTRICT,
  injury_case_id   uuid REFERENCES public.patient_injury_cases(id) ON DELETE RESTRICT,
  set_by           uuid,
  set_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_payers_something CHECK (payer_account_id IS NOT NULL OR injury_case_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS visit_payers_account_idx ON public.visit_payers (payer_account_id) WHERE payer_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visit_payers_case_idx ON public.visit_payers (injury_case_id) WHERE injury_case_id IS NOT NULL;
COMMENT ON TABLE public.visit_payers IS
  'Who pays for a visit when it is not the patient: an account, and the injury or accident case the visit belongs to. Every invoice of the visit is billed to that account and never claimed from the patient''s medical aid. Changed only through set_visit_payer and save_injury_case.';

CREATE TABLE IF NOT EXISTS public.visit_payer_changes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id     uuid NOT NULL,
  visit_id        uuid NOT NULL,
  from_account_id uuid,
  to_account_id   uuid,
  from_case_id    uuid,
  to_case_id      uuid,
  reason          text,
  -- Each invoice that changed payer with its lines as they were: [{ id, number, lines: [{ id, paid_by, medical_aid_covered, patient_portion, total_price }] }]
  invoices        jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_by      uuid,
  changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visit_payer_changes_visit_idx ON public.visit_payer_changes (visit_id, id DESC);
COMMENT ON TABLE public.visit_payer_changes IS
  'Every change of who pays for a visit, with each invoice line as it was before (to split it again when the visit is billed back to the patient). Never changed or deleted.';

DROP TRIGGER IF EXISTS visit_payer_changes_append_only ON public.visit_payer_changes;
CREATE TRIGGER visit_payer_changes_append_only BEFORE UPDATE OR DELETE ON public.visit_payer_changes
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit_append_only();
DROP TRIGGER IF EXISTS visit_payer_changes_no_truncate ON public.visit_payer_changes;
CREATE TRIGGER visit_payer_changes_no_truncate BEFORE TRUNCATE ON public.visit_payer_changes
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 5. The line rule: a visit billed to an account is never claimed from the patient's medical aid
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pa_line_billed_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The account pays every line (invoice_services_fill_split, which runs next, then makes it all the patient portion,
  -- the portion the account is billed for)
  IF NEW.paid_by IS DISTINCT FROM 'patient' AND EXISTS (
    SELECT 1 FROM invoices_enhanced i JOIN visit_payers vp ON vp.visit_id = i.visit_id
     WHERE i.id = NEW.invoice_id AND vp.payer_account_id IS NOT NULL
  ) THEN
    NEW.paid_by := 'patient';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.pa_line_billed_to_account() IS
  'BEFORE INSERT or UPDATE of the amounts or paid_by of an invoice line: a line of a visit billed to an account (visit_payers) is the account''s to pay (paid_by patient), so the claim builder never claims it from the patient''s medical aid.';

-- Named to run before invoice_services_fill_split (triggers of one kind run in name order)
DROP TRIGGER IF EXISTS invoice_services_a_payer_account ON public.invoice_services;
CREATE TRIGGER invoice_services_a_payer_account
  BEFORE INSERT OR UPDATE OF total_price, medical_aid_covered, patient_portion, paid_by ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.pa_line_billed_to_account();

-- ---------------------------------------------------------------------------------------------
-- 6. Receipts an account paid
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payer_account_receipts (
  receipt_id       uuid PRIMARY KEY REFERENCES public.receipts(id) ON DELETE RESTRICT,
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  payer_account_id uuid NOT NULL REFERENCES public.payer_accounts(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payer_account_receipts_account_idx ON public.payer_account_receipts (payer_account_id);
COMMENT ON TABLE public.payer_account_receipts IS
  'Which account paid a receipt (recorded by post_payer_account_receipt): the account''s payments and the credit it holds.';

-- ---------------------------------------------------------------------------------------------
-- 7. Helpers (not callable by the app)
-- ---------------------------------------------------------------------------------------------

-- A text field as stored: trimmed (spaces collapsed for one-line fields), NULL when empty, refused when too long
CREATE OR REPLACE FUNCTION public.pa_field(p_value text, p_label text, p_max integer, p_one_line boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text := btrim(COALESCE(p_value, ''));
BEGIN
  IF p_one_line THEN
    v_text := regexp_replace(v_text, '[[:space:]]+', ' ', 'g');
  END IF;
  v_text := NULLIF(v_text, '');
  IF v_text IS NOT NULL AND char_length(v_text) > p_max THEN
    RAISE EXCEPTION '% is too long (at most % characters)', p_label, p_max USING ERRCODE = '22023';
  END IF;
  RETURN v_text;
END $$;

-- The practice's next account number: AC-0001, AC-0002, ... (one at a time per practice: two new accounts saved at
-- once wait for each other, so no number is given twice)
CREATE OR REPLACE FUNCTION public.pa_next_account_number(p_practice_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('payer_account_number:' || p_practice_id::text, 0));
  SELECT COALESCE(max(substring(account_number FROM '^AC-([0-9]+)$')::bigint), 0) + 1 INTO v_next
    FROM payer_accounts WHERE practice_id = p_practice_id;
  RETURN 'AC-' || lpad(v_next::text, 4, '0');
END $$;

-- The practice's account for the Employees' Compensation Fund or the MVA Fund, made the first time a case needs it
CREATE OR REPLACE FUNCTION public.pa_standard_account(p_practice_id uuid, p_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_kind NOT IN ('compensation_fund', 'mva_fund') THEN
    RAISE EXCEPTION 'Only the compensation fund and the MVA Fund have a standard account';
  END IF;
  -- Two cases saved at once make one account, not two
  PERFORM pg_advisory_xact_lock(hashtextextended('payer_accounts:' || p_practice_id::text || ':' || p_kind, 0));
  SELECT id INTO v_id FROM payer_accounts WHERE practice_id = p_practice_id AND kind = p_kind AND closed_at IS NULL;
  IF FOUND THEN
    RETURN v_id;
  END IF;
  INSERT INTO payer_accounts (practice_id, kind, name, account_number, created_by, updated_by)
  VALUES (p_practice_id, p_kind,
          CASE p_kind WHEN 'compensation_fund' THEN 'Employees'' Compensation Fund (Social Security Commission)'
                      ELSE 'Motor Vehicle Accident Fund (MVA Fund)' END,
          pa_next_account_number(p_practice_id), auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

/*
  Why an invoice's payer cannot change now (NULL: it can). A cancelled invoice has no payer to change.
  Claims already sent are never touched; money received, a credit note, write-off, discount or correction, or a
  closed month keep the invoice as it is.
*/
CREATE OR REPLACE FUNCTION public.pa_invoice_problem(p_invoice_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice invoices_enhanced%ROWTYPE;
BEGIN
  SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = p_invoice_id;
  IF NOT FOUND OR ar_is_cancelled(v_invoice.payment_status) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM batch_headers b
              WHERE b.id = v_invoice.batch_id
                AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready')))
     OR EXISTS (SELECT 1 FROM batch_details d JOIN batch_headers b ON b.id = d.batch_header_id
                 WHERE d.invoice_id = v_invoice.id
                   AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))) THEN
    RETURN format('Invoice %s was already sent to the medical aid, and a claim already sent is never changed. Credit it and invoice again.', v_invoice.invoice_number);
  END IF;
  IF EXISTS (SELECT 1 FROM receipt_allocations a WHERE a.invoice_id = v_invoice.id AND a.reversed_at IS NULL) THEN
    RETURN format('Money was already received on invoice %s, so who pays it cannot change. Reverse the payment first, or credit the invoice and invoice again.', v_invoice.invoice_number);
  END IF;
  IF EXISTS (SELECT 1 FROM invoice_adjustments j WHERE j.invoice_id = v_invoice.id AND j.reversed_at IS NULL) THEN
    RETURN format('Invoice %s has a credit note, write-off, discount or correction, so who pays it cannot change. Reverse it first, or credit the invoice and invoice again.', v_invoice.invoice_number);
  END IF;
  BEGIN
    PERFORM dc_assert_open(v_invoice.practice_id, dc_invoice_date(v_invoice.issue_date, v_invoice.created_at), 'an invoice');
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLERRM;
  END;
  RETURN NULL;
END $$;

/*
  Bills a visit to an account and case (both NULL: the patient). Every invoice of the visit changes payer or none
  does (the first reason it cannot is raised). Lines move to the account's portion; billed back to the patient, each
  line is split again as it was before the visit was billed to an account, else by the database's rule. The change and
  the lines as they were are kept in visit_payer_changes. Membership is checked by the callers.
*/
CREATE OR REPLACE FUNCTION public.pa_apply_payer(p_visit_id uuid, p_account_id uuid, p_case_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit    visits%ROWTYPE;
  v_current  visit_payers%ROWTYPE;
  v_invoice  record;
  v_problem  text;
  v_lines    jsonb;
  v_snapshot jsonb := '[]'::jsonb;
  v_restore  jsonb;
  v_line     record;
  v_count    integer := 0;
BEGIN
  SELECT * INTO v_visit FROM visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_current FROM visit_payers WHERE visit_id = p_visit_id FOR UPDATE;
  IF v_current.payer_account_id IS NOT DISTINCT FROM p_account_id AND v_current.injury_case_id IS NOT DISTINCT FROM p_case_id THEN
    RETURN jsonb_build_object('changed', false, 'invoices', 0);
  END IF;

  -- Every invoice of the visit changes payer, or none does
  IF v_current.payer_account_id IS DISTINCT FROM p_account_id THEN
    FOR v_invoice IN
      SELECT i.id, i.invoice_number FROM invoices_enhanced i
       WHERE i.visit_id = p_visit_id AND NOT ar_is_cancelled(i.payment_status)
       ORDER BY i.created_at, i.id
         FOR UPDATE
    LOOP
      v_problem := pa_invoice_problem(v_invoice.id);
      IF v_problem IS NOT NULL THEN
        RAISE EXCEPTION '%', v_problem USING ERRCODE = '55000';
      END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'paid_by', s.paid_by, 'medical_aid_covered', s.medical_aid_covered,
                                                   'patient_portion', s.patient_portion, 'total_price', s.total_price) ORDER BY s.id), '[]'::jsonb)
        INTO v_lines FROM invoice_services s WHERE s.invoice_id = v_invoice.id;
      v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('id', v_invoice.id, 'number', v_invoice.invoice_number, 'lines', v_lines));
      v_count := v_count + 1;
    END LOOP;
  END IF;

  -- The visit's payer first, so the line rule (pa_line_billed_to_account) sees it
  IF p_account_id IS NULL AND p_case_id IS NULL THEN
    DELETE FROM visit_payers WHERE visit_id = p_visit_id;
  ELSE
    INSERT INTO visit_payers (visit_id, practice_id, payer_account_id, injury_case_id, set_by, set_at)
    VALUES (p_visit_id, v_visit.practice_id, p_account_id, p_case_id, auth.uid(), now())
    ON CONFLICT (visit_id) DO UPDATE
      SET payer_account_id = EXCLUDED.payer_account_id, injury_case_id = EXCLUDED.injury_case_id,
          set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at;
  END IF;

  IF v_current.payer_account_id IS DISTINCT FROM p_account_id THEN
    IF p_account_id IS NOT NULL THEN
      -- The account pays every line; the claim builder takes the invoice out of a batch not sent yet
      UPDATE invoice_services s SET paid_by = 'patient'
       WHERE s.invoice_id IN (SELECT (e.item->>'id')::uuid FROM jsonb_array_elements(v_snapshot) AS e(item))
         AND s.paid_by IS DISTINCT FROM 'patient';
    ELSE
      -- Back to the patient: each line as it was when the visit left the patient, else split by the database's rule
      SELECT c.invoices INTO v_restore FROM visit_payer_changes c
       WHERE c.visit_id = p_visit_id AND c.from_account_id IS NULL AND c.to_account_id IS NOT NULL
       ORDER BY c.id DESC LIMIT 1;
      FOR v_line IN
        SELECT s.id, s.total_price,
               (SELECT l.line FROM jsonb_array_elements(COALESCE(v_restore, '[]'::jsonb)) AS inv(item),
                                   jsonb_array_elements(inv.item->'lines') AS l(line)
                 WHERE l.line->>'id' = s.id::text LIMIT 1) AS saved
          FROM invoice_services s
         WHERE s.invoice_id IN (SELECT (e.item->>'id')::uuid FROM jsonb_array_elements(v_snapshot) AS e(item))
      LOOP
        IF v_line.saved IS NOT NULL AND (v_line.saved->>'total_price')::numeric IS NOT DISTINCT FROM v_line.total_price THEN
          UPDATE invoice_services
             SET paid_by = v_line.saved->>'paid_by',
                 medical_aid_covered = (v_line.saved->>'medical_aid_covered')::numeric,
                 patient_portion = (v_line.saved->>'patient_portion')::numeric
           WHERE id = v_line.id;
        ELSE
          UPDATE invoice_services SET paid_by = NULL, medical_aid_covered = NULL, patient_portion = NULL WHERE id = v_line.id;
        END IF;
      END LOOP;
    END IF;
    -- The claim builder once more per invoice, now that its totals are final (on each line change it runs before the
    -- invoice's totals are updated, so a one-line invoice billed back to the patient would stay unclaimed)
    FOR v_invoice IN SELECT (e.item->>'id')::uuid AS id FROM jsonb_array_elements(v_snapshot) AS e(item) LOOP
      PERFORM sync_invoice_to_batch(v_invoice.id);
    END LOOP;
  END IF;

  INSERT INTO visit_payer_changes (practice_id, visit_id, from_account_id, to_account_id, from_case_id, to_case_id, reason, invoices, changed_by)
  VALUES (v_visit.practice_id, p_visit_id, v_current.payer_account_id, p_account_id, v_current.injury_case_id, p_case_id,
          NULLIF(btrim(COALESCE(p_reason, '')), ''), v_snapshot, auth.uid());
  RETURN jsonb_build_object('changed', true, 'invoices', v_count);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. What the app calls
-- ---------------------------------------------------------------------------------------------

/*
  save_payer_account(practice, id (NULL: a new account), { kind, name, registration_number, vat_number, contact_name,
  phone, email, postal_address, town, region, notes }). Any staff member of the practice. The kind of an account never
  changes; a closed account cannot be changed.
*/
CREATE OR REPLACE FUNCTION public.save_payer_account(p_practice_id uuid, p_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     payer_accounts%ROWTYPE;
  v_kind    text := NULLIF(btrim(COALESCE(p_payload->>'kind', '')), '');
  v_name    text := pa_field(p_payload->>'name', 'The name', 120);
  v_reg     text := pa_field(p_payload->>'registration_number', 'The registration number', 40);
  v_vat     text := pa_field(p_payload->>'vat_number', 'The VAT number', 30);
  v_contact text := pa_field(p_payload->>'contact_name', 'The contact person', 100);
  v_phone   text := pa_field(p_payload->>'phone', 'The phone number', 30);
  v_email   text := lower(pa_field(p_payload->>'email', 'The email address', 200));
  v_postal  text := pa_field(p_payload->>'postal_address', 'The postal address', 300, false);
  v_town    text := pa_field(p_payload->>'town', 'The town', 80);
  v_region  text := pa_field(p_payload->>'region', 'The region', 20);
  v_notes   text := pa_field(p_payload->>'notes', 'The notes', 1000, false);
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Give the account its name' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'The email address is not valid' USING ERRCODE = '22023';
  END IF;
  IF v_region IS NOT NULL THEN
    BEGIN
      PERFORM v_region::public.namibian_region;
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'Choose the region from the list' USING ERRCODE = '22023';
    END;
  END IF;

  IF p_id IS NULL THEN
    IF v_kind IS NULL OR v_kind NOT IN ('employer', 'compensation_fund', 'mva_fund', 'other') THEN
      RAISE EXCEPTION 'Choose what kind of account it is' USING ERRCODE = '22023';
    END IF;
    IF v_kind IN ('compensation_fund', 'mva_fund')
       AND EXISTS (SELECT 1 FROM payer_accounts WHERE practice_id = p_practice_id AND kind = v_kind AND closed_at IS NULL) THEN
      RAISE EXCEPTION 'The practice already has an account for the %', CASE v_kind WHEN 'mva_fund' THEN 'MVA Fund' ELSE 'Employees'' Compensation Fund' END
        USING ERRCODE = '23505';
    END IF;
  ELSE
    SELECT * INTO v_row FROM payer_accounts WHERE id = p_id AND practice_id = p_practice_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_row.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'This account is closed and cannot be changed' USING ERRCODE = '22023';
    END IF;
    IF v_kind IS NOT NULL AND v_kind <> v_row.kind THEN
      RAISE EXCEPTION 'The kind of an account cannot change: close it and open a new one' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM payer_accounts
              WHERE practice_id = p_practice_id AND closed_at IS NULL AND lower(btrim(name)) = lower(v_name) AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'An open account is already called %', v_name USING ERRCODE = '23505';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO payer_accounts (practice_id, kind, name, account_number, registration_number, vat_number, contact_name, phone, email,
                                postal_address, town, region, notes, created_by, updated_by)
    VALUES (p_practice_id, v_kind, v_name, pa_next_account_number(p_practice_id), v_reg, v_vat, v_contact, v_phone, v_email,
            v_postal, v_town, v_region, v_notes, auth.uid(), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE payer_accounts
       SET name = v_name, registration_number = v_reg, vat_number = v_vat, contact_name = v_contact, phone = v_phone,
           email = v_email, postal_address = v_postal, town = v_town, region = v_region, notes = v_notes,
           updated_by = auth.uid(), updated_at = now()
     WHERE id = p_id
    RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row);
END $$;

/*
  close_payer_account(account, reason): practice administrators and practitioners (who also approve write-offs). Only
  an account that owes nothing and that no open case uses; its employees' links end with it.
*/
CREATE OR REPLACE FUNCTION public.close_payer_account(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  payer_accounts%ROWTYPE;
  v_owed numeric;
BEGIN
  SELECT * INTO v_row FROM payer_accounts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_role(v_row.practice_id, ARRAY['admin', 'doctor'], 'close an account');
  IF v_row.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is already closed' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the account closes (it is kept with the account)' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(sum(b.outstanding), 0) INTO v_owed
    FROM visit_payers vp
    JOIN invoices_enhanced i ON i.visit_id = vp.visit_id
    JOIN ar_invoice_balances b ON b.invoice_id = i.id
   WHERE vp.payer_account_id = p_id AND NOT b.is_cancelled;
  IF v_owed > 0 THEN
    RAISE EXCEPTION 'The account still owes %: it closes once its invoices are paid, credited or billed to someone else', ar_format_nad(v_owed)
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM patient_injury_cases c
              WHERE (c.payer_account_id = p_id OR c.employer_account_id = p_id) AND c.removed_at IS NULL AND c.closed_at IS NULL) THEN
    RAISE EXCEPTION 'Open injury or accident cases use this account: close them or change who pays first' USING ERRCODE = '55000';
  END IF;
  UPDATE payer_account_members SET unlinked_at = now(), unlinked_by = auth.uid(), unlink_reason = 'The account was closed'
   WHERE payer_account_id = p_id AND unlinked_at IS NULL;
  UPDATE payer_accounts SET closed_at = now(), closed_by = auth.uid(), close_reason = btrim(p_reason), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

-- link_payer_account_patient(account, patient, employee number): a patient the account pays for (again: the number changes)
CREATE OR REPLACE FUNCTION public.link_payer_account_patient(p_account_id uuid, p_patient_id uuid, p_employee_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account payer_accounts%ROWTYPE;
  v_row     payer_account_members%ROWTYPE;
  v_number  text := pa_field(p_employee_number, 'The employee number', 30);
BEGIN
  SELECT * INTO v_account FROM payer_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_member(v_account.practice_id);
  PERFORM dc_assert_patient(v_account.practice_id, p_patient_id);
  IF v_account.closed_at IS NOT NULL THEN
    RAISE EXCEPTION '% is closed', v_account.name USING ERRCODE = '22023';
  END IF;
  IF v_account.kind NOT IN ('employer', 'other') THEN
    RAISE EXCEPTION 'Patients are linked to employer accounts only: the funds are billed through a case' USING ERRCODE = '22023';
  END IF;
  IF v_number IS NOT NULL AND v_number !~ '^[A-Za-z0-9/. -]{1,30}$' THEN
    RAISE EXCEPTION 'An employee number has letters, digits, spaces, / . or - only' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM payer_account_members
   WHERE payer_account_id = p_account_id AND patient_id = p_patient_id AND unlinked_at IS NULL FOR UPDATE;
  IF FOUND THEN
    UPDATE payer_account_members SET employee_number = v_number WHERE id = v_row.id RETURNING * INTO v_row;
  ELSE
    INSERT INTO payer_account_members (practice_id, payer_account_id, patient_id, employee_number, linked_by)
    VALUES (v_account.practice_id, p_account_id, p_patient_id, v_number, auth.uid())
    RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.unlink_payer_account_patient(p_account_id uuid, p_patient_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account payer_accounts%ROWTYPE;
  v_id      uuid;
BEGIN
  SELECT * INTO v_account FROM payer_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_member(v_account.practice_id);
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the patient leaves the account (it is kept with the account)' USING ERRCODE = '22023';
  END IF;
  UPDATE payer_account_members SET unlinked_at = now(), unlinked_by = auth.uid(), unlink_reason = btrim(p_reason)
   WHERE payer_account_id = p_account_id AND patient_id = p_patient_id AND unlinked_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This patient is not on the account' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('id', v_id, 'unlinked', true);
END $$;

/*
  save_injury_case(practice, patient, id (NULL: a new case), { case_type, injury_date, employer_account_id,
  employer_name, employee_number, claim_number, payer: 'standard' | 'employer' | 'account' | 'patient',
  payer_account_id (with 'account'), notes, closed }). Any staff member of the practice. 'standard' bills the
  Employees' Compensation Fund (injury on duty, occupational disease) or the MVA Fund (motor vehicle accident),
  making the practice's account for it the first time. A new payer moves the case's visits with it (every invoice
  of every visit, or nothing: the first reason one cannot move is raised).
*/
CREATE OR REPLACE FUNCTION public.save_injury_case(p_practice_id uuid, p_patient_id uuid, p_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          patient_injury_cases%ROWTYPE;
  v_type         text := NULLIF(btrim(COALESCE(p_payload->>'case_type', '')), '');
  v_date         date;
  v_employer_id  uuid;
  v_employer     payer_accounts%ROWTYPE;
  v_employer_name text := pa_field(p_payload->>'employer_name', 'The employer''s name', 120);
  v_employee     text := pa_field(p_payload->>'employee_number', 'The employee number', 30);
  v_claim        text := pa_field(p_payload->>'claim_number', 'The claim number', 30);
  v_notes        text := pa_field(p_payload->>'notes', 'The notes', 1000, false);
  v_payer_choice text := COALESCE(NULLIF(btrim(COALESCE(p_payload->>'payer', '')), ''), 'standard');
  v_payer_id     uuid;
  v_closed       boolean := COALESCE((p_payload->>'closed')::boolean, false);
  v_visit        record;
  v_moved        integer := 0;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  IF v_type IS NULL OR v_type NOT IN ('injury_on_duty', 'occupational_disease', 'motor_vehicle_accident') THEN
    RAISE EXCEPTION 'Choose what kind of case it is' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_date := NULLIF(btrim(COALESCE(p_payload->>'injury_date', '')), '')::date;
  EXCEPTION WHEN OTHERS THEN
    v_date := NULL;
  END;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'Enter the date of the injury, the accident or the diagnosis' USING ERRCODE = '22023';
  END IF;
  IF v_date > ar_today() OR v_date < date '1900-01-01' THEN
    RAISE EXCEPTION 'The date cannot be in the future' USING ERRCODE = '22023';
  END IF;

  -- The employer: one of the practice's employer (or other) accounts, else a name
  IF NULLIF(btrim(COALESCE(p_payload->>'employer_account_id', '')), '') IS NOT NULL THEN
    SELECT * INTO v_employer FROM payer_accounts
     WHERE id = (p_payload->>'employer_account_id')::uuid AND practice_id = p_practice_id AND kind IN ('employer', 'other');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose the employer from the practice''s company accounts' USING ERRCODE = '22023';
    END IF;
    v_employer_id := v_employer.id;
    v_employer_name := NULL;
  END IF;
  IF v_type IN ('injury_on_duty', 'occupational_disease') AND v_employer_id IS NULL AND v_employer_name IS NULL THEN
    RAISE EXCEPTION 'Name the employer: the Employees'' Compensation Fund pays a case with the employer''s report' USING ERRCODE = '22023';
  END IF;
  IF v_employee IS NOT NULL AND v_employee !~ '^[A-Za-z0-9/. -]{1,30}$' THEN
    RAISE EXCEPTION 'An employee number has letters, digits, spaces, / . or - only' USING ERRCODE = '22023';
  END IF;
  IF v_claim IS NOT NULL AND v_claim !~ '^[A-Za-z0-9/. -]{1,30}$' THEN
    RAISE EXCEPTION 'A claim number has letters, digits, spaces, / . or - only' USING ERRCODE = '22023';
  END IF;

  -- Who pays
  IF v_payer_choice = 'standard' THEN
    v_payer_id := pa_standard_account(p_practice_id, CASE WHEN v_type = 'motor_vehicle_accident' THEN 'mva_fund' ELSE 'compensation_fund' END);
  ELSIF v_payer_choice = 'employer' THEN
    IF v_employer_id IS NULL THEN
      RAISE EXCEPTION 'The employer pays only when it is one of the practice''s company accounts: choose it as the employer' USING ERRCODE = '22023';
    END IF;
    IF v_employer.closed_at IS NOT NULL THEN
      RAISE EXCEPTION '% is closed', v_employer.name USING ERRCODE = '22023';
    END IF;
    v_payer_id := v_employer_id;
  ELSIF v_payer_choice = 'account' THEN
    SELECT id INTO v_payer_id FROM payer_accounts
     WHERE id = NULLIF(btrim(COALESCE(p_payload->>'payer_account_id', '')), '')::uuid AND practice_id = p_practice_id AND closed_at IS NULL;
    IF v_payer_id IS NULL THEN
      RAISE EXCEPTION 'Choose an open account of the practice to pay for the case' USING ERRCODE = '22023';
    END IF;
  ELSIF v_payer_choice = 'patient' THEN
    v_payer_id := NULL;
  ELSE
    RAISE EXCEPTION 'Say who pays for the case' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO patient_injury_cases (practice_id, patient_id, case_type, injury_date, employer_account_id, employer_name, employee_number,
                                      claim_number, payer_account_id, notes, closed_at, closed_by, created_by, updated_by)
    VALUES (p_practice_id, p_patient_id, v_type, v_date, v_employer_id, v_employer_name, v_employee,
            v_claim, v_payer_id, v_notes, CASE WHEN v_closed THEN now() END, CASE WHEN v_closed THEN auth.uid() END, auth.uid(), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM patient_injury_cases WHERE id = p_id AND practice_id = p_practice_id AND patient_id = p_patient_id FOR UPDATE;
    IF NOT FOUND OR v_row.removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002';
    END IF;
    -- A new payer: the case's visits move with it
    IF v_row.payer_account_id IS DISTINCT FROM v_payer_id THEN
      FOR v_visit IN SELECT vp.visit_id FROM visit_payers vp WHERE vp.injury_case_id = v_row.id ORDER BY vp.visit_id LOOP
        PERFORM pa_apply_payer(v_visit.visit_id, v_payer_id, v_row.id, 'The case''s payer changed');
        v_moved := v_moved + 1;
      END LOOP;
    END IF;
    UPDATE patient_injury_cases
       SET case_type = v_type, injury_date = v_date, employer_account_id = v_employer_id, employer_name = v_employer_name,
           employee_number = v_employee, claim_number = v_claim, payer_account_id = v_payer_id, notes = v_notes,
           closed_at = CASE WHEN v_closed THEN COALESCE(closed_at, now()) END,
           closed_by = CASE WHEN v_closed THEN COALESCE(closed_by, auth.uid()) END,
           updated_by = auth.uid(), updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row) || jsonb_build_object('visits_moved', v_moved);
END $$;

-- remove_injury_case(case, reason): a case entered by mistake, while no visit is billed under it (it stays for the record)
CREATE OR REPLACE FUNCTION public.remove_injury_case(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row patient_injury_cases%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM patient_injury_cases WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_member(v_row.practice_id);
  IF EXISTS (SELECT 1 FROM visit_payers WHERE injury_case_id = p_id) THEN
    RAISE EXCEPTION 'Visits belong to this case: bill them to someone else first, or close the case instead' USING ERRCODE = '55000';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the case is removed (it is kept for the record)' USING ERRCODE = '22023';
  END IF;
  UPDATE patient_injury_cases SET removed_at = now(), removed_by = auth.uid(), remove_reason = btrim(p_reason), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'removed', true);
END $$;

/*
  set_visit_payer(visit, { mode: 'patient' | 'account' | 'case', account_id, case_id, reason }): who pays for the visit.
  Any staff member of the visit's practice. 'account': an open employer (or other) account; the funds are billed
  through a case. 'case': an open case of the visit's patient, billed to whoever pays for the case.
*/
CREATE OR REPLACE FUNCTION public.set_visit_payer(p_visit_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practice uuid;
  v_patient  uuid;
  v_mode     text := COALESCE(p_payload->>'mode', '');
  v_account  payer_accounts%ROWTYPE;
  v_case     patient_injury_cases%ROWTYPE;
BEGIN
  SELECT practice_id, patient_id INTO v_practice, v_patient FROM visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_member(v_practice);
  IF v_mode = 'patient' THEN
    RETURN pa_apply_payer(p_visit_id, NULL, NULL, p_payload->>'reason');
  ELSIF v_mode = 'account' THEN
    SELECT * INTO v_account FROM payer_accounts
     WHERE id = NULLIF(btrim(COALESCE(p_payload->>'account_id', '')), '')::uuid AND practice_id = v_practice;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose one of the practice''s accounts' USING ERRCODE = '22023';
    END IF;
    IF v_account.closed_at IS NOT NULL THEN
      RAISE EXCEPTION '% is closed: visits can no longer be billed to it', v_account.name USING ERRCODE = '22023';
    END IF;
    IF v_account.kind NOT IN ('employer', 'other') THEN
      RAISE EXCEPTION 'Visits are billed to % through an injury or accident case: add the case on the patient''s file and choose it', v_account.name
        USING ERRCODE = '22023';
    END IF;
    RETURN pa_apply_payer(p_visit_id, v_account.id, NULL, p_payload->>'reason');
  ELSIF v_mode = 'case' THEN
    SELECT * INTO v_case FROM patient_injury_cases
     WHERE id = NULLIF(btrim(COALESCE(p_payload->>'case_id', '')), '')::uuid AND practice_id = v_practice AND patient_id = v_patient;
    IF NOT FOUND OR v_case.removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Choose one of this patient''s cases' USING ERRCODE = '22023';
    END IF;
    IF v_case.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'This case is closed. Open it again on the patient''s file to add visits to it.' USING ERRCODE = '22023';
    END IF;
    RETURN pa_apply_payer(p_visit_id, v_case.payer_account_id, v_case.id, p_payload->>'reason');
  END IF;
  RAISE EXCEPTION 'Say who pays: the patient, an account or a case' USING ERRCODE = '22023';
END $$;

/*
  post_payer_account_receipt(account, { method, amount, received_on, reference, notes, allocations: [{ invoice_id, amount }] }):
  money an account paid, recorded through ar_post_receipt as paid by someone else (the account's name), allocated only
  to invoices billed to the account; what is not allocated stays on the receipt as the account's credit.
*/
CREATE OR REPLACE FUNCTION public.post_payer_account_receipt(p_account_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account     payer_accounts%ROWTYPE;
  v_allocations jsonb := '[]'::jsonb;
  v_line        jsonb;
  v_invoice     uuid;
  v_result      jsonb;
BEGIN
  SELECT * INTO v_account FROM payer_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM dc_assert_member(v_account.practice_id);
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) LOOP
    v_invoice := NULLIF(btrim(COALESCE(v_line->>'invoice_id', '')), '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM invoices_enhanced i JOIN visit_payers vp ON vp.visit_id = i.visit_id
                    WHERE i.id = v_invoice AND vp.payer_account_id = p_account_id) THEN
      RAISE EXCEPTION 'A payment from % pays only invoices billed to it', v_account.name USING ERRCODE = '22023';
    END IF;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('invoice_id', v_invoice, 'portion', 'patient', 'amount', v_line->'amount'));
  END LOOP;
  v_result := ar_post_receipt(jsonb_build_object(
    'practice_id', v_account.practice_id, 'source', 'manual', 'payer_type', 'other', 'payer_name', v_account.name,
    'method', p_payload->>'method', 'amount', p_payload->'amount', 'received_on', p_payload->>'received_on',
    'reference', p_payload->>'reference', 'notes', p_payload->>'notes', 'allocations', v_allocations));
  INSERT INTO payer_account_receipts (receipt_id, practice_id, payer_account_id)
  VALUES ((v_result->>'receipt_id')::uuid, v_account.practice_id, p_account_id);
  RETURN v_result || jsonb_build_object('payer_account_id', p_account_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Reading (staff of the practice), writing (the functions above only)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.payer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_injury_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_payer_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_account_receipts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['payer_accounts', 'payer_account_members', 'patient_injury_cases', 'visit_payers',
                                 'visit_payer_changes', 'payer_account_receipts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_read', v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (practice_id = (SELECT public.rls_my_practice_id()))',
                   v_table || '_read', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    -- The patient app's logins read nothing here (as on every OneHealth table)
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.pa_line_billed_to_account(), public.pa_field(text, text, integer, boolean),
  public.pa_next_account_number(uuid), public.pa_standard_account(uuid, text), public.pa_invoice_problem(uuid),
  public.pa_apply_payer(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_payer_account(uuid, uuid, jsonb), public.close_payer_account(uuid, text),
  public.link_payer_account_patient(uuid, uuid, text), public.unlink_payer_account_patient(uuid, uuid, text),
  public.save_injury_case(uuid, uuid, uuid, jsonb), public.remove_injury_case(uuid, text),
  public.set_visit_payer(uuid, jsonb), public.post_payer_account_receipt(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payer_account(uuid, uuid, jsonb), public.close_payer_account(uuid, text),
  public.link_payer_account_patient(uuid, uuid, text), public.unlink_payer_account_patient(uuid, uuid, text),
  public.save_injury_case(uuid, uuid, uuid, jsonb), public.remove_injury_case(uuid, text),
  public.set_visit_payer(uuid, jsonb), public.post_payer_account_receipt(uuid, jsonb)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 10. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF (SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN (
         'automation_definitions', 'automation_queue', 'invoice_services', 'invoices_enhanced', 'lab_requests', 'lab_results',
         'medical_aid_providers', 'medical_aid_schemes', 'medical_aid_service_prices_retired', 'message_templates', 'messages',
         'oauth_callback_tokens', 'patient_documents', 'patients', 'practice_email_subscriptions', 'practice_features',
         'practice_inventory', 'practice_service_subscriptions', 'practice_sms_subscriptions', 'practice_tariffs', 'practice_types',
         'practices', 'sms_logs', 'sms_plans', 'system_notifications', 'user_practice_assignments', 'user_profiles', 'users', 'visits'))
     IS DISTINCT FROM current_setting('onehealth.policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of a protected table changed';
  END IF;
  -- The line rule runs before invoice_services_fill_split
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.invoice_services'::regclass AND t.tgname = 'invoice_services_a_payer_account'
                  AND NOT t.tgisinternal AND t.tgenabled = 'O')
     OR 'invoice_services_a_payer_account' COLLATE "C" >= 'invoice_services_fill_split' COLLATE "C" THEN
    RAISE EXCEPTION 'Check failed: the line rule is missing or would run after invoice_services_fill_split';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.save_payer_account(uuid,uuid,jsonb)', 'public.close_payer_account(uuid,text)',
                              'public.link_payer_account_patient(uuid,uuid,text)', 'public.unlink_payer_account_patient(uuid,uuid,text)',
                              'public.save_injury_case(uuid,uuid,uuid,jsonb)', 'public.remove_injury_case(uuid,text)',
                              'public.set_visit_payer(uuid,jsonb)', 'public.post_payer_account_receipt(uuid,jsonb)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is not for staff only', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.pa_line_billed_to_account()', 'public.pa_field(text,text,integer,boolean)',
                              'public.pa_next_account_number(uuid)', 'public.pa_standard_account(uuid,text)',
                              'public.pa_invoice_problem(uuid)', 'public.pa_apply_payer(uuid,uuid,uuid,text)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: the helper % can be called by the app', v_fn;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.payer_accounts', 'SELECT') OR has_table_privilege('authenticated', 'public.payer_accounts', 'INSERT')
     OR has_table_privilege('authenticated', 'public.visit_payers', 'UPDATE') THEN
    RAISE EXCEPTION 'Check failed: the new tables can be written by the app or read by anon';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
