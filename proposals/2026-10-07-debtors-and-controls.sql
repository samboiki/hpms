-- Applied 2026-10-07 as migration debtors_and_controls_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: debtors, credit control, family accounts, account flags, and the daily
-- and month-end controls (cash-up, deposit slips, daybook, month-end close and period lock)
-- File:   proposals/2026-10-07-debtors-and-controls.sql      Drafted: 2026-10-07
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- Apply order
--   AFTER proposals/2026-10-07-receipts-and-allocations.sql: it uses its tables, views and
--   functions (section 1 stops if they are missing). It is listed right after it in
--   DEFAULT_ORDER (scripts/db/rehearsal.ts). Optional: proposals/2026-10-07-two-way-sms.sql adds
--   patients.sms_opt_out, which the "No SMS" flag sets (dc_set_sms_opt_out says so until then).
--
-- How to apply
--   1. Run the whole file once as it is on a Supabase branch (or in the SQL editor): it must
--      finish without an error. Section 16 proves, for every practice, that the ledger movements
--      this script adds up (invoices, receipts, refunds, credit notes, write-offs, corrections and
--      their reversals) equal the account balances of the receipts views: that is what the
--      month-end control totals rely on. It prints one NOTICE with the number of practices checked.
--   2. Change the final ROLLBACK to COMMIT and run it again. It writes no rows of its own; it is
--      quick at any hour.
--   3. Nothing to deploy. Finance > Payments (Day end, Daybook), Finance > Reports (Month end, age
--      analysis), Finance > Overview, the Debtors screens and the patient file's Billing tab look
--      for these tables and show "not set up yet" until they exist.
--   Undo after a COMMIT: see the end of the file.
--
-- What it adds
--   account_holder_links  family (guarantor) accounts: who pays for whom. One level: a holder is
--                         never someone else's dependant. Statements, aging and credit control work
--                         per account holder.
--   account_flags         one model for every account flag: cash only, do not claim, dispute,
--                         handed over, credit limit (amount), no statements, statement language,
--                         and an alert shown on the patient file. Account flags are stored on the
--                         account holder and apply to the whole family. "No SMS" is
--                         patients.sms_opt_out (one store: the SMS gateway reads it).
--   credit_control_notes  what was said to an account and how (call, SMS, email, ...).
--   payment_promises      promises to pay (amount and date); kept or broken is worked out from the
--                         account's receipts, so it cannot be marked kept by hand.
--   cash_ups              the day-end close: the till count against the cash the ledger expects,
--                         with the day's figures kept as they were.
--   bank_deposits (+ items) deposit slips: the cash taken to the bank, "deposited" with the bank's
--                         reference. A receipt is on one slip at most.
--   daybook_entries       the numbered journal of every invoice, receipt, allocation, adjustment and
--                         reversal, written by triggers. Never changed or deleted. Numbers are
--                         gapless per practice, given when the daybook is read (dc_seal_daybook), so
--                         posting never waits on a counter.
--   daybook_prints        every print or export of a day's daybook: the first is the original, every
--                         later copy is printed as a reprint.
--   period_closes         month-end closes with the control totals and month-end pack as they were.
--                         A closed month is LOCKED: section 7's triggers refuse receipts,
--                         adjustments and invoice changes dated in it, until an admin reopens it
--                         with a reason (kept on the close).
--   debtor_settings, interest_runs (+ lines)   optional interest on overdue patient balances, off
--                         by default; posted as correction journals (reason code "interest").
--   statement_criteria, statement_runs   saved statement runs and what each run sent.
--
-- Decisions
--   * The daybook is a table, not a view over ar_audit_events: (1) invoices are not in
--     ar_audit_events; (2) a number that never changes cannot come from row_number() over an
--     identity column, because transactions commit out of order and a late commit would renumber
--     what was already printed. Entries get their number once, when the daybook is read, in the
--     order they were written, so a printed page can always be reproduced.
--   * Money moves on the day it happens. A reversal counts on the day it is made (never on the
--     day of the entry it reverses), so reversing a September receipt in October changes October,
--     never a closed September. An invoice counts on its invoice date at what it bills now; once
--     its month is closed it cannot be changed (credit it with a credit note in an open month).
--   * The lock is by the date an entry counts on (received_on, effective_on, the invoice date).
--     Reversals and allocations are dated "now", so they are never blocked by a closed month.
--     A late remittance for a closed month is posted in an open one: dc_first_open_day(practice,
--     date) gives the date to use (for the remittance import's received_on).
--   * Only practice admins close and reopen months (users.role = 'admin'). Credit limits and
--     hand-overs need an admin or doctor (the write-off approvers). Interest settings and runs need
--     an admin. Everything else is open to the practice's staff.
--   * Every write goes through a SECURITY DEFINER function that checks membership (and role); the
--     tables are read-only to the app (RLS: members of the practice read).
--   * Interest (when a practice turns it on) is simple monthly interest on what the patient owes,
--     never on medical aid portions unless the practice allows it, never on disputed or handed-over
--     accounts, and never more in total than the capital still owed (in duplum). The same rules
--     are in src/services/ledger/creditControl.ts.
--
-- Money is numeric(14,2) in NAD. Business dates are Africa/Windhoek calendar dates.
-- Used by: src/services/ledger/{accountFlags,familyAccounts,ageAnalysis,ledgerMovements,cashUp,
--          daybook,periodClose,creditControl,statementRuns}.ts (rules, tested) and
--          src/components/finance/{controls,debtors}/* (screens).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Preconditions: the receipts proposal and the columns this script relies on
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.receipts'), ('public.receipt_allocations'), ('public.invoice_adjustments'), ('public.ar_audit_events'),
                 ('public.ar_invoice_balances'), ('public.ar_receipt_balances')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first (missing: %)', v_missing;
  END IF;

  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.ar_today()'), ('public.ar_is_cancelled(text)'), ('public.ar_amount(jsonb)'), ('public.ar_format_nad(numeric)'),
                 ('public.ar_insert_adjustment(uuid,text,jsonb,date)'), ('public.ar_reverse_adjustment(uuid,text)')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions of the receipts proposal are missing: %', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
    FROM (VALUES
      ('invoices_enhanced', 'id'), ('invoices_enhanced', 'practice_id'), ('invoices_enhanced', 'patient_id'), ('invoices_enhanced', 'invoice_number'),
      ('invoices_enhanced', 'issue_date'), ('invoices_enhanced', 'created_at'), ('invoices_enhanced', 'total'), ('invoices_enhanced', 'medical_aid_total'),
      ('invoices_enhanced', 'payment_status'), ('users', 'id'), ('users', 'practice_id'), ('users', 'role'), ('patients', 'id'), ('patients', 'practice_id')
    ) AS t(table_name, column_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %. Adjust this script before applying it.', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dc_local_date(p_at timestamptz)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (p_at AT TIME ZONE 'Africa/Windhoek')::date
$$;

CREATE OR REPLACE FUNCTION public.dc_day_label(p_date date)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(p_date, 'FMDD Mon YYYY')
$$;

CREATE OR REPLACE FUNCTION public.dc_month_label(p_date date)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(p_date, 'FMMonth YYYY')
$$;

-- The day an invoice counts on: its issue date, else the local day it was created
CREATE OR REPLACE FUNCTION public.dc_invoice_date(p_issue_date date, p_created_at timestamptz)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT COALESCE(p_issue_date, public.dc_local_date(p_created_at))
$$;

-- What an invoice bills (both portions): its total, nothing when cancelled. The same as
-- medical_aid_billed + patient_billed in ar_invoice_balances.
CREATE OR REPLACE FUNCTION public.dc_invoice_billed(p_total numeric, p_status text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public.ar_is_cancelled(p_status) THEN 0 ELSE round(COALESCE(p_total, 0)::numeric, 2) END
$$;

CREATE OR REPLACE FUNCTION public.dc_role(p_practice_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT users.role::text FROM users WHERE users.id = auth.uid() AND users.practice_id = p_practice_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.dc_assert_member(p_practice_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'You can only work on the accounts of your own practice' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dc_assert_role(p_practice_id uuid, p_roles text[], p_action text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF NOT (COALESCE(dc_role(p_practice_id), '') = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Only a practice % can %', array_to_string(p_roles, ' or '), p_action USING ERRCODE = '42501';
  END IF;
END $$;

-- A patient of the practice (as in the receipts proposal: older patients may have no practice_id
-- but invoices of the practice)
CREATE OR REPLACE FUNCTION public.dc_assert_patient(p_practice_id uuid, p_patient_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_patient_id IS NULL
     OR (NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = p_patient_id AND p.practice_id = p_practice_id)
         AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = p_patient_id AND p.practice_id IS NULL
                           AND EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.patient_id = p.id AND i.practice_id = p_practice_id))) THEN
    RAISE EXCEPTION 'This patient is not a patient of the practice';
  END IF;
END $$;

-- History tables: rows are never deleted (except with their patient, ON DELETE CASCADE) and only
-- the closing fields named in TG_ARGV[0] may be set, once. TG_ARGV[1]: the patient columns whose
-- deletion may take the row with it.
CREATE OR REPLACE FUNCTION public.dc_history_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_fields   text[] := string_to_array(COALESCE(TG_ARGV[0], ''), ',');
  v_marker   text := (string_to_array(COALESCE(TG_ARGV[0], ''), ','))[1];
  v_patients text[] := string_to_array(COALESCE(TG_ARGV[1], ''), ',');
  v_column   text;
  v_old      jsonb := to_jsonb(OLD);
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOREACH v_column IN ARRAY v_patients LOOP
      IF v_old ->> v_column IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patients WHERE id = (v_old ->> v_column)::uuid) THEN
        RETURN OLD;
      END IF;
    END LOOP;
    RAISE EXCEPTION 'This record is kept as history and cannot be deleted';
  END IF;
  IF v_marker IS NULL OR v_marker = '' THEN
    RAISE EXCEPTION 'This record is kept as history and cannot be changed';
  END IF;
  IF v_old ->> v_marker IS NOT NULL THEN
    RAISE EXCEPTION 'This record was already closed and cannot be changed';
  END IF;
  IF (to_jsonb(NEW) - v_fields) IS DISTINCT FROM (v_old - v_fields) THEN
    RAISE EXCEPTION 'Only % can be recorded on this record', array_to_string(v_fields, ', ');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dc_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'This table is kept as history and cannot be emptied';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Family (guarantor) accounts
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_holder_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id       uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- The patient who is paid for
  patient_id        uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The patient who pays (the account holder, e.g. the medical aid main member)
  holder_patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  relationship      text NOT NULL CHECK (relationship IN ('spouse', 'child', 'dependant', 'other')),
  linked_by         uuid,
  linked_at         timestamptz NOT NULL DEFAULT now(),
  unlinked_at       timestamptz,
  unlinked_by       uuid,
  unlink_reason     text,
  CONSTRAINT account_holder_links_not_self CHECK (patient_id <> holder_patient_id),
  CONSTRAINT account_holder_links_unlink_complete CHECK (
    (unlinked_at IS NULL AND unlinked_by IS NULL AND unlink_reason IS NULL)
    OR (unlinked_at IS NOT NULL AND char_length(btrim(COALESCE(unlink_reason, ''))) >= 3)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS account_holder_links_one_holder ON public.account_holder_links (practice_id, patient_id) WHERE unlinked_at IS NULL;
CREATE INDEX IF NOT EXISTS account_holder_links_holder_idx ON public.account_holder_links (practice_id, holder_patient_id) WHERE unlinked_at IS NULL;
COMMENT ON TABLE public.account_holder_links IS
  'Family accounts: holder_patient_id pays for patient_id. One holder per patient at a time; a holder is never someone else''s dependant. Ended links (unlinked_at) are history.';

-- Who pays for a patient: the account holder, else the patient
CREATE OR REPLACE FUNCTION public.dc_account_of(p_practice_id uuid, p_patient_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT l.holder_patient_id FROM account_holder_links l
      WHERE l.practice_id = p_practice_id AND l.patient_id = p_patient_id AND l.unlinked_at IS NULL LIMIT 1),
    p_patient_id)
$$;

CREATE OR REPLACE FUNCTION public.dc_links_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM account_holder_links WHERE practice_id = NEW.practice_id AND patient_id = NEW.holder_patient_id AND unlinked_at IS NULL) THEN
    RAISE EXCEPTION 'That person is paid for by someone else, so they cannot hold an account. Choose who pays for them.';
  END IF;
  IF EXISTS (SELECT 1 FROM account_holder_links WHERE practice_id = NEW.practice_id AND holder_patient_id = NEW.patient_id AND unlinked_at IS NULL) THEN
    RAISE EXCEPTION 'This patient pays for others. Move their family to the new account holder first.';
  END IF;
  NEW.linked_by := COALESCE(auth.uid(), NEW.linked_by);
  NEW.linked_at := now();
  NEW.unlinked_at := NULL;
  NEW.unlinked_by := NULL;
  NEW.unlink_reason := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dc_10_before_insert ON public.account_holder_links;
CREATE TRIGGER dc_10_before_insert BEFORE INSERT ON public.account_holder_links
  FOR EACH ROW EXECUTE FUNCTION public.dc_links_before_insert();
DROP TRIGGER IF EXISTS dc_20_history ON public.account_holder_links;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.account_holder_links
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('unlinked_at,unlinked_by,unlink_reason', 'patient_id,holder_patient_id');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.account_holder_links;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.account_holder_links
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

CREATE OR REPLACE FUNCTION public.dc_link_account_holder(p_practice_id uuid, p_patient_id uuid, p_holder_id uuid, p_relationship text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  PERFORM dc_assert_patient(p_practice_id, p_holder_id);
  IF p_patient_id = p_holder_id THEN
    RAISE EXCEPTION 'A patient cannot be their own account holder';
  END IF;
  IF COALESCE(p_relationship, '') NOT IN ('spouse', 'child', 'dependant', 'other') THEN
    RAISE EXCEPTION 'Choose how the patient is related to the account holder';
  END IF;
  IF EXISTS (SELECT 1 FROM account_holder_links WHERE practice_id = p_practice_id AND patient_id = p_patient_id AND unlinked_at IS NULL) THEN
    RAISE EXCEPTION 'This patient is on another account. Remove them from it first.';
  END IF;
  INSERT INTO account_holder_links (practice_id, patient_id, holder_patient_id, relationship)
  VALUES (p_practice_id, p_patient_id, p_holder_id, p_relationship)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'patient_id', p_patient_id, 'holder_patient_id', p_holder_id);
END $$;

CREATE OR REPLACE FUNCTION public.dc_unlink_account_holder(p_practice_id uuid, p_patient_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the patient leaves the account (it is kept with the account)';
  END IF;
  UPDATE account_holder_links SET unlinked_at = now(), unlinked_by = auth.uid(), unlink_reason = btrim(p_reason)
   WHERE practice_id = p_practice_id AND patient_id = p_patient_id AND unlinked_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This patient is not on a family account';
  END IF;
  RETURN jsonb_build_object('id', v_id, 'unlinked', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Account flags (one model for every screen)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- The file it is set on: the account holder's for account flags (they cover the family)
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  flag         text NOT NULL CHECK (flag IN ('cash_only', 'no_claims', 'dispute', 'handed_over', 'credit_limit', 'no_statement', 'statement_language', 'alert')),
  -- credit_limit
  amount       numeric(14,2),
  -- statement_language (en, af) or the alert text
  value        text,
  reason       text NOT NULL DEFAULT '',
  set_by       uuid,
  set_at       timestamptz NOT NULL DEFAULT now(),
  cleared_at   timestamptz,
  cleared_by   uuid,
  clear_reason text,
  CONSTRAINT account_flags_value CHECK (CASE flag
    WHEN 'credit_limit' THEN amount IS NOT NULL AND amount > 0 AND value IS NULL
    WHEN 'statement_language' THEN value IN ('en', 'af') AND amount IS NULL
    WHEN 'alert' THEN char_length(btrim(COALESCE(value, ''))) BETWEEN 3 AND 280 AND amount IS NULL
    ELSE amount IS NULL AND value IS NULL
  END),
  CONSTRAINT account_flags_clear_complete CHECK (
    (cleared_at IS NULL AND cleared_by IS NULL AND clear_reason IS NULL) OR cleared_at IS NOT NULL
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS account_flags_one_in_force ON public.account_flags (practice_id, patient_id, flag) WHERE cleared_at IS NULL;
COMMENT ON TABLE public.account_flags IS
  'Account flags. Account flags (cash_only, dispute, handed_over, credit_limit, no_statement, statement_language) are stored on whoever pays and cover the family; patient flags (no_claims, alert) on the patient. Cleared flags are history. No SMS is patients.sms_opt_out.';

DROP TRIGGER IF EXISTS dc_20_history ON public.account_flags;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.account_flags
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('cleared_at,cleared_by,clear_reason', 'patient_id');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.account_flags;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.account_flags
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- The same table of rules as FLAG_DEFINITIONS in src/services/ledger/accountFlags.ts
CREATE OR REPLACE FUNCTION public.dc_flag_rule(p_flag text)
RETURNS TABLE (label text, level text, needs_reason boolean, roles text[]) LANGUAGE sql IMMUTABLE AS $$
  SELECT r.label, r.level, r.needs_reason, r.roles
  FROM (VALUES
    ('alert', 'Account alert', 'patient', false, ARRAY[]::text[]),
    ('cash_only', 'Cash only', 'account', true, ARRAY[]::text[]),
    ('no_claims', 'Do not claim', 'patient', true, ARRAY[]::text[]),
    ('dispute', 'In dispute', 'account', true, ARRAY[]::text[]),
    ('handed_over', 'Handed over', 'account', true, ARRAY['admin', 'doctor']),
    ('credit_limit', 'Credit limit', 'account', false, ARRAY['admin', 'doctor']),
    ('no_statement', 'No statements', 'account', true, ARRAY[]::text[]),
    ('statement_language', 'Statement language', 'account', false, ARRAY[]::text[])
  ) AS r(flag, label, level, needs_reason, roles)
  WHERE r.flag = p_flag
$$;

/*
  dc_set_account_flag(practice, patient, flag, { "amount"?: 2000.00, "value"?: "af" | alert text, "reason"?: text })
  Sets (or changes the value of) a flag. Account flags go on whoever pays for the patient.
*/
CREATE OR REPLACE FUNCTION public.dc_set_account_flag(p_practice_id uuid, p_patient_id uuid, p_flag text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule    record;
  v_target  uuid;
  v_reason  text := btrim(COALESCE(p_payload->>'reason', ''));
  v_amount  numeric(14,2);
  v_value   text;
  v_current account_flags%ROWTYPE;
  v_id      uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  SELECT * INTO v_rule FROM dc_flag_rule(p_flag);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown account flag %', p_flag;
  END IF;
  IF cardinality(v_rule.roles) > 0 THEN
    PERFORM dc_assert_role(p_practice_id, v_rule.roles, 'set "' || v_rule.label || '"');
  END IF;
  IF v_rule.needs_reason AND char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Give a reason for "%": it is kept with the account', v_rule.label;
  END IF;
  v_target := CASE WHEN v_rule.level = 'account' THEN dc_account_of(p_practice_id, p_patient_id) ELSE p_patient_id END;
  IF p_flag = 'credit_limit' THEN
    v_amount := ar_amount(p_payload->'amount');
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Enter the credit limit in N$';
    END IF;
  ELSIF p_flag IN ('statement_language', 'alert') THEN
    v_value := NULLIF(btrim(COALESCE(p_payload->>'value', '')), '');
  END IF;

  SELECT * INTO v_current FROM account_flags
   WHERE practice_id = p_practice_id AND patient_id = v_target AND flag = p_flag AND cleared_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    IF p_flag NOT IN ('credit_limit', 'statement_language', 'alert') THEN
      RAISE EXCEPTION '"%" is already set on this account', v_rule.label;
    END IF;
    IF v_current.amount IS NOT DISTINCT FROM v_amount AND v_current.value IS NOT DISTINCT FROM v_value THEN
      RAISE EXCEPTION 'Nothing changed';
    END IF;
    UPDATE account_flags SET cleared_at = now(), cleared_by = auth.uid(), clear_reason = 'Replaced by a new value'
     WHERE id = v_current.id;
  END IF;

  INSERT INTO account_flags (practice_id, patient_id, flag, amount, value, reason, set_by, set_at)
  VALUES (p_practice_id, v_target, p_flag, v_amount, v_value, v_reason, auth.uid(), now())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'patient_id', v_target, 'flag', p_flag);
END $$;

CREATE OR REPLACE FUNCTION public.dc_clear_account_flag(p_practice_id uuid, p_patient_id uuid, p_flag text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule   record;
  v_target uuid;
  v_id     uuid;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  SELECT * INTO v_rule FROM dc_flag_rule(p_flag);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown account flag %', p_flag;
  END IF;
  IF cardinality(v_rule.roles) > 0 THEN
    PERFORM dc_assert_role(p_practice_id, v_rule.roles, 'clear "' || v_rule.label || '"');
  END IF;
  IF v_rule.needs_reason AND char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Give a reason for clearing "%": it is kept with the account', v_rule.label;
  END IF;
  v_target := CASE WHEN v_rule.level = 'account' THEN dc_account_of(p_practice_id, p_patient_id) ELSE p_patient_id END;
  UPDATE account_flags SET cleared_at = now(), cleared_by = auth.uid(), clear_reason = NULLIF(v_reason, '')
   WHERE practice_id = p_practice_id AND patient_id = v_target AND flag = p_flag AND cleared_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This account has no "%" flag', v_rule.label;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'cleared', true);
END $$;

-- "No SMS" is the patient's SMS opt-out (two-way SMS proposal): one store, read by the gateway
CREATE OR REPLACE FUNCTION public.dc_set_sms_opt_out(p_practice_id uuid, p_patient_id uuid, p_opt_out boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'sms_opt_out') THEN
    RAISE EXCEPTION 'SMS opt-out is not set up in this database yet (proposals/2026-10-07-two-way-sms.sql)';
  END IF;
  EXECUTE 'UPDATE public.patients SET sms_opt_out = $1, sms_opt_out_at = CASE WHEN $1 THEN now() END WHERE id = $2'
    USING COALESCE(p_opt_out, false), p_patient_id;
  RETURN jsonb_build_object('patient_id', p_patient_id, 'sms_opt_out', COALESCE(p_opt_out, false));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Credit control: contact notes and promises to pay (kept on the account: whoever pays)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_control_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  patient_id  uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('call', 'sms', 'email', 'in_person', 'letter', 'other')),
  note        text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 3 AND 2000),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_control_notes_account_idx ON public.credit_control_notes (practice_id, patient_id, created_at DESC);
COMMENT ON TABLE public.credit_control_notes IS 'What was said to an account (patient_id = whoever pays) and how. Never changed or deleted.';

DROP TRIGGER IF EXISTS dc_20_history ON public.credit_control_notes;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.credit_control_notes
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('', 'patient_id');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.credit_control_notes;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.credit_control_notes
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

CREATE TABLE IF NOT EXISTS public.payment_promises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  made_on       date NOT NULL,
  promised_on   date NOT NULL,
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  note          text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz,
  cancelled_by  uuid,
  cancel_reason text,
  CONSTRAINT payment_promises_dates CHECK (promised_on >= made_on),
  CONSTRAINT payment_promises_cancel_complete CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL)
    OR (cancelled_at IS NOT NULL AND NULLIF(btrim(cancel_reason), '') IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS payment_promises_account_idx ON public.payment_promises (practice_id, patient_id);
CREATE INDEX IF NOT EXISTS payment_promises_due_idx ON public.payment_promises (practice_id, promised_on) WHERE cancelled_at IS NULL;
COMMENT ON TABLE public.payment_promises IS
  'Promises to pay (patient_id = whoever pays). Kept or broken is worked out from the account''s receipts (src/services/ledger/creditControl.ts), never set by hand.';

DROP TRIGGER IF EXISTS dc_20_history ON public.payment_promises;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.payment_promises
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('cancelled_at,cancelled_by,cancel_reason', 'patient_id');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.payment_promises;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.payment_promises
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

CREATE OR REPLACE FUNCTION public.dc_add_contact_note(p_practice_id uuid, p_patient_id uuid, p_channel text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account uuid;
  v_id      uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  IF char_length(btrim(COALESCE(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Write what was said or agreed';
  END IF;
  v_account := dc_account_of(p_practice_id, p_patient_id);
  INSERT INTO credit_control_notes (practice_id, patient_id, channel, note, created_by)
  VALUES (p_practice_id, v_account,
          CASE WHEN p_channel IN ('call', 'sms', 'email', 'in_person', 'letter', 'other') THEN p_channel ELSE 'other' END,
          btrim(p_note), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'patient_id', v_account);
END $$;

/*
  dc_record_promise(practice, patient, { "amount": 500.00, "promised_on": "2026-10-15", "note"?: text })
  A new promise replaces the account's promises that are not due yet.
*/
CREATE OR REPLACE FUNCTION public.dc_record_promise(p_practice_id uuid, p_patient_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account  uuid;
  v_amount   numeric(14,2) := ar_amount(p_payload->'amount');
  v_due      date := NULLIF(p_payload->>'promised_on', '')::date;
  v_owed     numeric(14,2);
  v_id       uuid;
  v_replaced integer;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount promised';
  END IF;
  IF v_due IS NULL OR v_due < ar_today() THEN
    RAISE EXCEPTION 'The promised day cannot be in the past';
  END IF;
  v_account := dc_account_of(p_practice_id, p_patient_id);
  -- What the account owes: the holder's invoices and those of everyone they pay for
  SELECT COALESCE(SUM(GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0)), 0) INTO v_owed
    FROM ar_invoice_balances b
   WHERE b.practice_id = p_practice_id
     AND (b.patient_id = v_account
          OR b.patient_id IN (SELECT l.patient_id FROM account_holder_links l
                               WHERE l.practice_id = p_practice_id AND l.holder_patient_id = v_account AND l.unlinked_at IS NULL));
  IF v_amount > v_owed THEN
    RAISE EXCEPTION 'The account owes %; a promise cannot be for more', ar_format_nad(v_owed);
  END IF;
  UPDATE payment_promises
     SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = 'Replaced by a new promise made on ' || dc_day_label(ar_today())
   WHERE practice_id = p_practice_id AND patient_id = v_account AND cancelled_at IS NULL AND promised_on >= ar_today();
  GET DIAGNOSTICS v_replaced = ROW_COUNT;
  INSERT INTO payment_promises (practice_id, patient_id, made_on, promised_on, amount, note, created_by)
  VALUES (p_practice_id, v_account, ar_today(), v_due, v_amount, NULLIF(btrim(COALESCE(p_payload->>'note', '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'patient_id', v_account, 'replaced', v_replaced);
END $$;

CREATE OR REPLACE FUNCTION public.dc_cancel_promise(p_promise_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promise payment_promises%ROWTYPE;
BEGIN
  SELECT * INTO v_promise FROM payment_promises WHERE id = p_promise_id;
  PERFORM dc_assert_member(v_promise.practice_id);
  IF v_promise.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'This promise was already cancelled';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the promise is cancelled';
  END IF;
  UPDATE payment_promises SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason) WHERE id = p_promise_id;
  RETURN jsonb_build_object('id', p_promise_id, 'cancelled', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Month-end closes
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.period_closes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  period_month    date NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  -- What debtors owed (net of credit) when the month ended, as proven by the control totals
  closing_balance numeric(14,2) NOT NULL,
  -- The control totals and the month-end pack as they were at the close (amounts in cents)
  snapshot        jsonb NOT NULL,
  -- Why each receipt still holding unallocated money was fine to carry over (receipt id -> text)
  explanations    jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes           text,
  closed_by       uuid,
  closed_at       timestamptz NOT NULL DEFAULT now(),
  reopened_at     timestamptz,
  reopened_by     uuid,
  reopen_reason   text,
  CONSTRAINT period_closes_reopen_complete CHECK (
    (reopened_at IS NULL AND reopened_by IS NULL AND reopen_reason IS NULL)
    OR (reopened_at IS NOT NULL AND char_length(btrim(COALESCE(reopen_reason, ''))) >= 5)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS period_closes_in_force ON public.period_closes (practice_id, period_month) WHERE reopened_at IS NULL;
CREATE INDEX IF NOT EXISTS period_closes_practice_idx ON public.period_closes (practice_id, period_month);
COMMENT ON TABLE public.period_closes IS
  'Month-end closes. A close in force (reopened_at IS NULL) locks its month. Reopening keeps the close with who, when and why; closing again adds a new row.';

DROP TRIGGER IF EXISTS dc_20_history ON public.period_closes;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.period_closes
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('reopened_at,reopened_by,reopen_reason', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.period_closes;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.period_closes
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- The first day on or after p_date in an open month: where a late entry may be dated
CREATE OR REPLACE FUNCTION public.dc_first_open_day(p_practice_id uuid, p_date date)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day date := p_date;
  v_steps integer := 0;
BEGIN
  WHILE v_steps < 1200 AND EXISTS (
    SELECT 1 FROM period_closes
     WHERE practice_id = p_practice_id AND period_month = date_trunc('month', v_day)::date AND reopened_at IS NULL
  ) LOOP
    v_day := (date_trunc('month', v_day) + interval '1 month')::date;
    v_steps := v_steps + 1;
  END LOOP;
  RETURN v_day;
END $$;
COMMENT ON FUNCTION public.dc_first_open_day(uuid, date) IS
  'The date itself when its month is open, else the first day of the next open month. Use it to date a late entry (e.g. a remittance for a closed month).';

-- ---------------------------------------------------------------------------------------------
-- 7. The period lock: nothing dated in a closed month is added, changed or deleted
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dc_assert_open(p_practice_id uuid, p_date date, p_what text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date;
BEGIN
  IF p_practice_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;
  SELECT period_month INTO v_month FROM period_closes
   WHERE practice_id = p_practice_id AND period_month = date_trunc('month', p_date)::date AND reopened_at IS NULL
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '% is closed, so % dated % cannot be recorded or changed. Date it on or after % (an open month), or ask a practice admin to reopen % with a reason.',
      dc_month_label(v_month), p_what, dc_day_label(p_date), dc_day_label(dc_first_open_day(p_practice_id, p_date)), dc_month_label(v_month)
      USING HINT = 'period_closed';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dc_lock_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_open(NEW.practice_id, NEW.received_on, 'a receipt');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dc_lock_adjustments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_open(NEW.practice_id, NEW.effective_on,
    CASE NEW.kind WHEN 'credit_note' THEN 'a credit note' WHEN 'write_off' THEN 'a write-off' WHEN 'journal' THEN 'a correction'
                  WHEN 'refund' THEN 'a refund' ELSE 'a shortfall transfer' END);
  RETURN NEW;
END $$;

-- Invoices: a new invoice, a deletion, or a change to what an invoice bills, to whom or on which day.
-- Status changes that come from payments (paid, partial, pending, overdue) are never blocked.
CREATE OR REPLACE FUNCTION public.dc_lock_invoices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_date date;
  v_new_date date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM dc_assert_open(NEW.practice_id, dc_invoice_date(NEW.issue_date, COALESCE(NEW.created_at, now())), 'an invoice');
    RETURN NEW;
  END IF;
  v_old_date := dc_invoice_date(OLD.issue_date, OLD.created_at);
  IF TG_OP = 'DELETE' THEN
    PERFORM dc_assert_open(OLD.practice_id, v_old_date, 'an invoice');
    RETURN OLD;
  END IF;
  v_new_date := dc_invoice_date(NEW.issue_date, NEW.created_at);
  IF dc_invoice_billed(OLD.total, OLD.payment_status) IS DISTINCT FROM dc_invoice_billed(NEW.total, NEW.payment_status)
     OR round(COALESCE(OLD.medical_aid_total, 0)::numeric, 2) IS DISTINCT FROM round(COALESCE(NEW.medical_aid_total, 0)::numeric, 2)
     OR v_old_date IS DISTINCT FROM v_new_date
     OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
     OR OLD.practice_id IS DISTINCT FROM NEW.practice_id THEN
    PERFORM dc_assert_open(OLD.practice_id, v_old_date, 'an invoice');
    PERFORM dc_assert_open(NEW.practice_id, v_new_date, 'an invoice');
  END IF;
  RETURN NEW;
END $$;

-- Named zz_ so they run after the receipts proposal's own checks (a refused entry rolls back with
-- its statement, so no document number is used up)
DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.receipts;
CREATE TRIGGER zz_dc_period_lock BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.dc_lock_receipts();
DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.invoice_adjustments;
CREATE TRIGGER zz_dc_period_lock BEFORE INSERT ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.dc_lock_adjustments();
DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.invoices_enhanced;
CREATE TRIGGER zz_dc_period_lock BEFORE INSERT OR UPDATE OR DELETE ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.dc_lock_invoices();

-- ---------------------------------------------------------------------------------------------
-- 8. Daybook: every financial event, numbered without gaps, never changed
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dc_counters (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  series      text NOT NULL CHECK (series IN ('daybook', 'deposit')),
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (practice_id, series)
);
COMMENT ON TABLE public.dc_counters IS 'Last number used per practice: daybook entries and deposit slips. Written only by this script''s functions.';

CREATE TABLE IF NOT EXISTS public.daybook_entries (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- Gapless per practice, given once by dc_seal_daybook in the order the entries were written
  entry_number     bigint,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  -- The daybook day: the local day it was recorded
  recorded_on      date NOT NULL,
  -- The day it counts on in the books
  business_date    date NOT NULL,
  entry_type       text NOT NULL CHECK (entry_type IN (
                     'invoice_raised', 'invoice_amended', 'invoice_cancelled', 'invoice_reinstated', 'invoice_deleted',
                     'receipt', 'receipt_reversed', 'allocation', 'allocation_reversed',
                     'credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'adjustment_reversed')),
  adjustment_kind  text CHECK (adjustment_kind IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer')),
  document_number  text NOT NULL,
  -- The other document involved: the invoice an allocation or adjustment is on, the receipt a refund pays back
  related_document text,
  source_table     text NOT NULL CHECK (source_table IN ('invoices_enhanced', 'receipts', 'receipt_allocations', 'invoice_adjustments')),
  source_id        uuid NOT NULL,
  invoice_id       uuid,
  receipt_id       uuid,
  patient_id       uuid,
  portion          text CHECK (portion IN ('patient', 'medical_aid')),
  method           text,
  -- The document's amount, positive
  amount           numeric(14,2) NOT NULL,
  -- What it did to what debtors owe (positive = owe more); allocations and shortfall transfers 0
  debtors_effect   numeric(14,2) NOT NULL,
  actor            uuid,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS daybook_entries_number ON public.daybook_entries (practice_id, entry_number) WHERE entry_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS daybook_entries_unsealed ON public.daybook_entries (practice_id, id) WHERE entry_number IS NULL;
CREATE INDEX IF NOT EXISTS daybook_entries_day_idx ON public.daybook_entries (practice_id, recorded_on);
CREATE INDEX IF NOT EXISTS daybook_entries_business_idx ON public.daybook_entries (practice_id, business_date);
COMMENT ON TABLE public.daybook_entries IS
  'The daybook: one row per financial event, written by triggers on invoices_enhanced and ar_audit_events. Never changed or deleted; entry_number is given once (dc_seal_daybook). It starts when this script is applied.';

CREATE OR REPLACE FUNCTION public.dc_daybook_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'The daybook is never changed: entries cannot be deleted';
  END IF;
  IF OLD.entry_number IS NOT NULL OR NEW.entry_number IS NULL
     OR (to_jsonb(NEW) - 'entry_number') IS DISTINCT FROM (to_jsonb(OLD) - 'entry_number') THEN
    RAISE EXCEPTION 'The daybook is never changed: an entry only receives its number, once';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dc_20_guard ON public.daybook_entries;
CREATE TRIGGER dc_20_guard BEFORE UPDATE OR DELETE ON public.daybook_entries
  FOR EACH ROW EXECUTE FUNCTION public.dc_daybook_guard();
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.daybook_entries;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.daybook_entries
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

CREATE OR REPLACE FUNCTION public.dc_daybook_append(
  p_practice_id uuid, p_type text, p_adjustment_kind text, p_document text, p_related text,
  p_source_table text, p_source_id uuid, p_invoice_id uuid, p_receipt_id uuid, p_patient_id uuid,
  p_portion text, p_method text, p_amount numeric, p_effect numeric, p_business_date date, p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_practice_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO daybook_entries (
    practice_id, recorded_at, recorded_on, business_date, entry_type, adjustment_kind, document_number, related_document,
    source_table, source_id, invoice_id, receipt_id, patient_id, portion, method, amount, debtors_effect, actor, details
  ) VALUES (
    p_practice_id, now(), dc_local_date(now()), COALESCE(p_business_date, dc_local_date(now())), p_type, p_adjustment_kind,
    COALESCE(NULLIF(btrim(p_document), ''), '-'), NULLIF(btrim(p_related), ''), p_source_table, p_source_id, p_invoice_id, p_receipt_id,
    p_patient_id, p_portion, p_method, round(abs(COALESCE(p_amount, 0)), 2), round(COALESCE(p_effect, 0), 2), auth.uid(),
    COALESCE(p_details, '{}'::jsonb)
  );
END $$;

-- Receipts, allocations and adjustments: from their audit rows (receipts proposal, ar_audit_events)
CREATE OR REPLACE FUNCTION public.dc_daybook_from_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d           jsonb := NEW.details;
  v_reversed  boolean := NEW.action = 'reversed';
  v_amount    numeric := COALESCE(NULLIF(d->>'amount', '')::numeric, 0);
  v_day       date := CASE WHEN NEW.action = 'reversed'
                        THEN dc_local_date(COALESCE(NULLIF(d->>'reversed_at', '')::timestamptz, NEW.occurred_at)) END;
  v_kind      text := d->>'kind';
  v_effect    numeric;
  v_invoice   text;
  v_receipt   text;
  v_patient   uuid;
BEGIN
  IF NEW.entity = 'receipt' THEN
    PERFORM dc_daybook_append(NEW.practice_id,
      CASE WHEN v_reversed THEN 'receipt_reversed' ELSE 'receipt' END, NULL,
      d->>'receipt_number', NULL, 'receipts', NEW.entity_id, NULL, NEW.entity_id, NULLIF(d->>'patient_id', '')::uuid,
      NULL, d->>'method', v_amount, CASE WHEN v_reversed THEN v_amount ELSE -v_amount END,
      COALESCE(v_day, NULLIF(d->>'received_on', '')::date),
      jsonb_strip_nulls(jsonb_build_object('payer_type', d->>'payer_type', 'fund_name', d->>'fund_name', 'source', d->>'source', 'reason', d->>'reversal_reason')));
  ELSIF NEW.entity = 'allocation' THEN
    SELECT r.receipt_number INTO v_receipt FROM receipts r WHERE r.id = NULLIF(d->>'receipt_id', '')::uuid;
    SELECT i.invoice_number, i.patient_id INTO v_invoice, v_patient FROM invoices_enhanced i WHERE i.id = NULLIF(d->>'invoice_id', '')::uuid;
    PERFORM dc_daybook_append(NEW.practice_id,
      CASE WHEN v_reversed THEN 'allocation_reversed' ELSE 'allocation' END, NULL,
      COALESCE(v_receipt, 'Receipt'), v_invoice, 'receipt_allocations', NEW.entity_id,
      NULLIF(d->>'invoice_id', '')::uuid, NULLIF(d->>'receipt_id', '')::uuid, v_patient,
      d->>'portion', NULL, v_amount, 0,
      COALESCE(v_day, dc_local_date(COALESCE(NULLIF(d->>'created_at', '')::timestamptz, NEW.occurred_at))),
      jsonb_strip_nulls(jsonb_build_object('reason', d->>'reversal_reason')));
  ELSIF NEW.entity = 'adjustment' THEN
    v_effect := CASE v_kind WHEN 'credit_note' THEN -v_amount WHEN 'write_off' THEN -v_amount WHEN 'journal' THEN v_amount WHEN 'refund' THEN v_amount ELSE 0 END;
    IF NULLIF(d->>'invoice_id', '') IS NOT NULL THEN
      SELECT i.invoice_number INTO v_invoice FROM invoices_enhanced i WHERE i.id = (d->>'invoice_id')::uuid;
    END IF;
    IF NULLIF(d->>'receipt_id', '') IS NOT NULL THEN
      SELECT r.receipt_number INTO v_receipt FROM receipts r WHERE r.id = (d->>'receipt_id')::uuid;
    END IF;
    PERFORM dc_daybook_append(NEW.practice_id,
      CASE WHEN v_reversed THEN 'adjustment_reversed' ELSE v_kind END, v_kind,
      d->>'adjustment_number', COALESCE(v_invoice, v_receipt), 'invoice_adjustments', NEW.entity_id,
      NULLIF(d->>'invoice_id', '')::uuid, NULLIF(d->>'receipt_id', '')::uuid, NULLIF(d->>'patient_id', '')::uuid,
      d->>'portion', d->>'method', v_amount, CASE WHEN v_reversed THEN -v_effect ELSE v_effect END,
      COALESCE(v_day, NULLIF(d->>'effective_on', '')::date),
      jsonb_strip_nulls(jsonb_build_object('reason_code', d->>'reason_code', 'reason', d->>'reason', 'reversal_reason', d->>'reversal_reason')));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_dc_daybook ON public.ar_audit_events;
CREATE TRIGGER zz_dc_daybook AFTER INSERT ON public.ar_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.dc_daybook_from_audit();

-- Invoices: raised, changed (what it bills, its date or its patient), cancelled, reinstated, deleted
CREATE OR REPLACE FUNCTION public.dc_daybook_from_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_billed numeric;
  v_new_billed numeric;
  v_old_date   date;
  v_new_date   date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_billed := dc_invoice_billed(NEW.total, NEW.payment_status);
    IF v_new_billed <> 0 THEN
      PERFORM dc_daybook_append(NEW.practice_id, 'invoice_raised', NULL, NEW.invoice_number, NULL, 'invoices_enhanced', NEW.id, NEW.id, NULL,
        NEW.patient_id, NULL, NULL, v_new_billed, v_new_billed, dc_invoice_date(NEW.issue_date, NEW.created_at),
        jsonb_build_object('medical_aid_total', round(COALESCE(NEW.medical_aid_total, 0)::numeric, 2)));
    END IF;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_old_billed := dc_invoice_billed(OLD.total, OLD.payment_status);
    IF v_old_billed <> 0 THEN
      PERFORM dc_daybook_append(OLD.practice_id, 'invoice_deleted', NULL, OLD.invoice_number, NULL, 'invoices_enhanced', OLD.id, OLD.id, NULL,
        OLD.patient_id, NULL, NULL, v_old_billed, -v_old_billed, dc_invoice_date(OLD.issue_date, OLD.created_at), '{}'::jsonb);
    END IF;
    RETURN NULL;
  END IF;

  v_old_billed := dc_invoice_billed(OLD.total, OLD.payment_status);
  v_new_billed := dc_invoice_billed(NEW.total, NEW.payment_status);
  v_old_date := dc_invoice_date(OLD.issue_date, OLD.created_at);
  v_new_date := dc_invoice_date(NEW.issue_date, NEW.created_at);
  IF OLD.practice_id IS DISTINCT FROM NEW.practice_id OR OLD.patient_id IS DISTINCT FROM NEW.patient_id OR v_old_date IS DISTINCT FROM v_new_date THEN
    -- Moved to another day or account: off where it was, on where it is now
    IF v_old_billed <> 0 THEN
      PERFORM dc_daybook_append(OLD.practice_id, 'invoice_amended', NULL, OLD.invoice_number, NULL, 'invoices_enhanced', OLD.id, OLD.id, NULL,
        OLD.patient_id, NULL, NULL, v_old_billed, -v_old_billed, v_old_date, jsonb_build_object('change', 'moved_from'));
    END IF;
    IF v_new_billed <> 0 THEN
      PERFORM dc_daybook_append(NEW.practice_id, 'invoice_amended', NULL, NEW.invoice_number, NULL, 'invoices_enhanced', NEW.id, NEW.id, NULL,
        NEW.patient_id, NULL, NULL, v_new_billed, v_new_billed, v_new_date, jsonb_build_object('change', 'moved_to'));
    END IF;
  ELSIF NOT ar_is_cancelled(OLD.payment_status) AND ar_is_cancelled(NEW.payment_status) THEN
    IF v_old_billed <> 0 THEN
      PERFORM dc_daybook_append(NEW.practice_id, 'invoice_cancelled', NULL, NEW.invoice_number, NULL, 'invoices_enhanced', NEW.id, NEW.id, NULL,
        NEW.patient_id, NULL, NULL, v_old_billed, -v_old_billed, v_old_date, '{}'::jsonb);
    END IF;
  ELSIF ar_is_cancelled(OLD.payment_status) AND NOT ar_is_cancelled(NEW.payment_status) THEN
    IF v_new_billed <> 0 THEN
      PERFORM dc_daybook_append(NEW.practice_id, 'invoice_reinstated', NULL, NEW.invoice_number, NULL, 'invoices_enhanced', NEW.id, NEW.id, NULL,
        NEW.patient_id, NULL, NULL, v_new_billed, v_new_billed, v_new_date, '{}'::jsonb);
    END IF;
  ELSIF v_new_billed <> v_old_billed THEN
    PERFORM dc_daybook_append(NEW.practice_id, 'invoice_amended', NULL, NEW.invoice_number, NULL, 'invoices_enhanced', NEW.id, NEW.id, NULL,
      NEW.patient_id, NULL, NULL, abs(v_new_billed - v_old_billed), v_new_billed - v_old_billed, v_new_date,
      jsonb_build_object('old_total', v_old_billed, 'new_total', v_new_billed));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_dc_daybook ON public.invoices_enhanced;
CREATE TRIGGER zz_dc_daybook AFTER INSERT OR DELETE OR UPDATE OF total, payment_status, issue_date, patient_id, practice_id ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.dc_daybook_from_invoice();

-- Numbers the entries written since the last seal, in the order they were written. Inserts never
-- wait on this (only the seal locks the counter), so posting a payment is never held up.
CREATE OR REPLACE FUNCTION public.dc_seal_daybook_internal(p_practice_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last bigint;
  v_row  record;
BEGIN
  INSERT INTO dc_counters (practice_id, series, last_number) VALUES (p_practice_id, 'daybook', 0)
  ON CONFLICT (practice_id, series) DO NOTHING;
  SELECT last_number INTO v_last FROM dc_counters WHERE practice_id = p_practice_id AND series = 'daybook' FOR UPDATE;
  FOR v_row IN
    SELECT id FROM daybook_entries WHERE practice_id = p_practice_id AND entry_number IS NULL ORDER BY id FOR UPDATE
  LOOP
    v_last := v_last + 1;
    UPDATE daybook_entries SET entry_number = v_last WHERE id = v_row.id;
  END LOOP;
  UPDATE dc_counters SET last_number = v_last WHERE practice_id = p_practice_id AND series = 'daybook';
  RETURN v_last;
END $$;

CREATE OR REPLACE FUNCTION public.dc_seal_daybook(p_practice_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  RETURN dc_seal_daybook_internal(p_practice_id);
END $$;

CREATE TABLE IF NOT EXISTS public.daybook_prints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  day         date NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('print', 'export')),
  copy_number integer NOT NULL CHECK (copy_number >= 1),
  from_number bigint,
  to_number   bigint,
  entry_count integer NOT NULL DEFAULT 0,
  printed_by  uuid,
  printed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daybook_prints_copy_unique UNIQUE (practice_id, day, copy_number)
);
COMMENT ON TABLE public.daybook_prints IS 'Every print and export of a day''s daybook. Copy 1 is the original; later copies are printed as reprints.';

DROP TRIGGER IF EXISTS dc_20_history ON public.daybook_prints;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.daybook_prints
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.daybook_prints;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.daybook_prints
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- Records a print or export of a day's daybook; returns which copy it is and the numbers it covers
CREATE OR REPLACE FUNCTION public.dc_record_daybook_print(p_practice_id uuid, p_day date, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_copy  integer;
  v_from  bigint;
  v_to    bigint;
  v_count integer;
  v_row   daybook_prints%ROWTYPE;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF p_day IS NULL OR p_day > ar_today() THEN
    RAISE EXCEPTION 'Choose a day up to today';
  END IF;
  IF COALESCE(p_kind, '') NOT IN ('print', 'export') THEN
    RAISE EXCEPTION 'A daybook is printed or exported';
  END IF;
  -- Seals first (and holds the daybook counter, so two prints of the same day get different copies)
  PERFORM dc_seal_daybook_internal(p_practice_id);
  SELECT COALESCE(MAX(copy_number), 0) + 1 INTO v_copy FROM daybook_prints WHERE practice_id = p_practice_id AND day = p_day;
  SELECT MIN(entry_number), MAX(entry_number), COUNT(*) INTO v_from, v_to, v_count
    FROM daybook_entries WHERE practice_id = p_practice_id AND recorded_on = p_day;
  INSERT INTO daybook_prints (practice_id, day, kind, copy_number, from_number, to_number, entry_count, printed_by)
  VALUES (p_practice_id, p_day, p_kind, v_copy, v_from, v_to, v_count, auth.uid())
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'copy_number', v_row.copy_number, 'from_number', v_row.from_number, 'to_number', v_row.to_number,
                            'entry_count', v_row.entry_count, 'printed_at', v_row.printed_at);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Cash-ups (day end)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_ups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  business_date    date NOT NULL,
  -- Cash the ledger expects in the till: standing cash receipts of the day less standing cash refunds
  expected_cash    numeric(14,2) NOT NULL,
  counted_cash     numeric(14,2) NOT NULL CHECK (counted_cash >= 0),
  difference       numeric(14,2) GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  -- The day's figures as they were at the close (cents), to see later whether the day changed
  totals           jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes            text,
  -- The last daybook entry when the day was closed
  daybook_to       bigint,
  closed_by        uuid,
  closed_at        timestamptz NOT NULL DEFAULT now(),
  superseded_at    timestamptz,
  superseded_by    uuid,
  supersede_reason text,
  CONSTRAINT cash_ups_difference_explained CHECK (counted_cash = expected_cash OR NULLIF(btrim(notes), '') IS NOT NULL),
  CONSTRAINT cash_ups_supersede_complete CHECK (
    (superseded_at IS NULL AND superseded_by IS NULL AND supersede_reason IS NULL)
    OR (superseded_at IS NOT NULL AND NULLIF(btrim(supersede_reason), '') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_ups_in_force ON public.cash_ups (practice_id, business_date) WHERE superseded_at IS NULL;
COMMENT ON TABLE public.cash_ups IS 'Day-end closes. A later count of the same day supersedes the earlier one (with a reason); both are kept.';

DROP TRIGGER IF EXISTS dc_20_history ON public.cash_ups;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.cash_ups
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('superseded_at,superseded_by,supersede_reason', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.cash_ups;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.cash_ups
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- Cash expected in the till for a day (the same rule as controlSummary(...).cash in ledgerMovements.ts)
CREATE OR REPLACE FUNCTION public.dc_expected_cash(p_practice_id uuid, p_day date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT SUM(r.amount) FROM receipts r
                    WHERE r.practice_id = p_practice_id AND r.received_on = p_day AND r.method = 'cash' AND r.reversed_at IS NULL), 0)
       - COALESCE((SELECT SUM(a.amount) FROM invoice_adjustments a
                    WHERE a.practice_id = p_practice_id AND a.kind = 'refund' AND a.method = 'cash' AND a.effective_on = p_day AND a.reversed_at IS NULL), 0)
$$;

/*
  dc_record_cash_up(practice, day, { "counted": 1250.00, "notes"?: text, "totals"?: {...cents}, "replace_reason"?: text })
  Closes a day. Counting a day again needs a reason and keeps the earlier count.
*/
CREATE OR REPLACE FUNCTION public.dc_record_cash_up(p_practice_id uuid, p_day date, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected numeric(14,2);
  v_counted  numeric(14,2) := ar_amount(p_payload->'counted');
  v_notes    text := NULLIF(btrim(COALESCE(p_payload->>'notes', '')), '');
  v_reason   text := NULLIF(btrim(COALESCE(p_payload->>'replace_reason', '')), '');
  v_current  cash_ups%ROWTYPE;
  v_last     bigint;
  v_row      cash_ups%ROWTYPE;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF p_day IS NULL OR p_day > ar_today() THEN
    RAISE EXCEPTION 'A day can be cashed up from that day on, not before';
  END IF;
  PERFORM dc_assert_open(p_practice_id, p_day, 'a cash-up');
  IF v_counted < 0 THEN
    RAISE EXCEPTION 'Enter the cash counted in the till (0 if there is none)';
  END IF;
  v_expected := dc_expected_cash(p_practice_id, p_day);
  IF v_counted <> v_expected AND v_notes IS NULL THEN
    RAISE EXCEPTION 'The till is % by %. Say why in the note before closing the day.',
      CASE WHEN v_counted > v_expected THEN 'over' ELSE 'short' END, ar_format_nad(abs(v_counted - v_expected));
  END IF;
  SELECT * INTO v_current FROM cash_ups WHERE practice_id = p_practice_id AND business_date = p_day AND superseded_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
      RAISE EXCEPTION 'This day was already cashed up. Say why it is counted again.';
    END IF;
    UPDATE cash_ups SET superseded_at = now(), superseded_by = auth.uid(), supersede_reason = v_reason WHERE id = v_current.id;
  END IF;
  v_last := dc_seal_daybook_internal(p_practice_id);
  INSERT INTO cash_ups (practice_id, business_date, expected_cash, counted_cash, totals, notes, daybook_to, closed_by)
  VALUES (p_practice_id, p_day, v_expected, v_counted,
          CASE WHEN jsonb_typeof(p_payload->'totals') = 'object' THEN p_payload->'totals' ELSE '{}'::jsonb END,
          v_notes, v_last, auth.uid())
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'expected', v_row.expected_cash, 'counted', v_row.counted_cash, 'difference', v_row.difference);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 10. Deposit slips
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_deposits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  deposit_number text NOT NULL,
  status         text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'deposited', 'cancelled')),
  prepared_on    date NOT NULL,
  -- Cash to bank: the receipts on the slip less the cash refunds paid from the till
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  notes          text,
  prepared_by    uuid,
  prepared_at    timestamptz NOT NULL DEFAULT now(),
  deposited_on   date,
  bank_reference text,
  deposited_by   uuid,
  deposited_at   timestamptz,
  cancelled_at   timestamptz,
  cancelled_by   uuid,
  cancel_reason  text,
  CONSTRAINT bank_deposits_number_unique UNIQUE (practice_id, deposit_number),
  CONSTRAINT bank_deposits_status_shape CHECK (CASE status
    WHEN 'prepared' THEN deposited_on IS NULL AND cancelled_at IS NULL
    WHEN 'deposited' THEN deposited_on IS NOT NULL AND NULLIF(btrim(bank_reference), '') IS NOT NULL AND cancelled_at IS NULL
    ELSE cancelled_at IS NOT NULL AND NULLIF(btrim(cancel_reason), '') IS NOT NULL AND deposited_on IS NULL
  END)
);
COMMENT ON TABLE public.bank_deposits IS 'Deposit slips (DP-000001): prepared, then deposited with the bank''s reference, or cancelled (which frees its entries).';

CREATE TABLE IF NOT EXISTS public.bank_deposit_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  deposit_id  uuid NOT NULL REFERENCES public.bank_deposits(id) ON DELETE RESTRICT,
  receipt_id  uuid REFERENCES public.receipts(id) ON DELETE RESTRICT,
  refund_id   uuid REFERENCES public.invoice_adjustments(id) ON DELETE RESTRICT,
  -- Receipts positive, refunds negative
  amount      numeric(14,2) NOT NULL,
  -- Set when the slip is cancelled: the entry may go on another slip
  released_at timestamptz,
  CONSTRAINT bank_deposit_items_one_entry CHECK (num_nonnulls(receipt_id, refund_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_deposit_items_receipt_once ON public.bank_deposit_items (receipt_id) WHERE receipt_id IS NOT NULL AND released_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_deposit_items_refund_once ON public.bank_deposit_items (refund_id) WHERE refund_id IS NOT NULL AND released_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_deposit_items_deposit_idx ON public.bank_deposit_items (deposit_id);

CREATE OR REPLACE FUNCTION public.dc_deposits_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_fields text[] := ARRAY['status', 'deposited_on', 'bank_reference', 'deposited_by', 'deposited_at', 'cancelled_at', 'cancelled_by', 'cancel_reason'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A deposit slip is never deleted; cancel it instead';
  END IF;
  IF OLD.status <> 'prepared' THEN
    RAISE EXCEPTION 'Deposit slip % is % and cannot be changed', OLD.deposit_number, OLD.status;
  END IF;
  IF (to_jsonb(NEW) - v_fields) IS DISTINCT FROM (to_jsonb(OLD) - v_fields) THEN
    RAISE EXCEPTION 'Only the deposit details or the cancellation can be recorded on a slip';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dc_20_guard ON public.bank_deposits;
CREATE TRIGGER dc_20_guard BEFORE UPDATE OR DELETE ON public.bank_deposits
  FOR EACH ROW EXECUTE FUNCTION public.dc_deposits_guard();
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.bank_deposits;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.bank_deposits
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();
DROP TRIGGER IF EXISTS dc_20_history ON public.bank_deposit_items;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.bank_deposit_items
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('released_at', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.bank_deposit_items;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.bank_deposit_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

/*
  dc_prepare_deposit(practice, { "receipt_ids": [uuid], "refund_ids"?: [uuid], "notes"?: text })
  Only cash goes to the bank (receipts have no cheque method; add it to the method check below when they do).
*/
CREATE OR REPLACE FUNCTION public.dc_prepare_deposit(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_receipts uuid[] := ARRAY(SELECT DISTINCT (value)::uuid FROM jsonb_array_elements_text(COALESCE(p_payload->'receipt_ids', '[]'::jsonb)));
  v_refunds  uuid[] := ARRAY(SELECT DISTINCT (value)::uuid FROM jsonb_array_elements_text(COALESCE(p_payload->'refund_ids', '[]'::jsonb)));
  v_bad      text;
  v_amount   numeric(14,2);
  v_next     bigint;
  v_id       uuid;
  v_number   text;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF cardinality(v_receipts) = 0 THEN
    RAISE EXCEPTION 'Choose the receipts that go to the bank';
  END IF;
  -- Every receipt: this practice, standing, cash, not on another slip
  SELECT string_agg(COALESCE(r.receipt_number, x.id::text), ', ') INTO v_bad
    FROM unnest(v_receipts) AS x(id)
    LEFT JOIN receipts r ON r.id = x.id AND r.practice_id = p_practice_id
   WHERE r.id IS NULL OR r.reversed_at IS NOT NULL OR r.method <> ALL (ARRAY['cash'])
      OR EXISTS (SELECT 1 FROM bank_deposit_items i WHERE i.receipt_id = x.id AND i.released_at IS NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'These receipts cannot go on a slip (not cash, reversed, or already on a slip): %', v_bad;
  END IF;
  SELECT string_agg(COALESCE(a.adjustment_number, x.id::text), ', ') INTO v_bad
    FROM unnest(v_refunds) AS x(id)
    LEFT JOIN invoice_adjustments a ON a.id = x.id AND a.practice_id = p_practice_id AND a.kind = 'refund'
   WHERE a.id IS NULL OR a.reversed_at IS NOT NULL OR a.method <> 'cash'
      OR EXISTS (SELECT 1 FROM bank_deposit_items i WHERE i.refund_id = x.id AND i.released_at IS NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'These refunds cannot go on a slip (not cash, reversed, or already on a slip): %', v_bad;
  END IF;
  SELECT COALESCE((SELECT SUM(amount) FROM receipts WHERE id = ANY (v_receipts)), 0)
       - COALESCE((SELECT SUM(amount) FROM invoice_adjustments WHERE id = ANY (v_refunds)), 0)
    INTO v_amount;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'The refunds are more than the cash: there is nothing to bank';
  END IF;

  INSERT INTO dc_counters AS c (practice_id, series, last_number) VALUES (p_practice_id, 'deposit', 1)
  ON CONFLICT (practice_id, series) DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_next;
  v_number := 'DP-' || lpad(v_next::text, 6, '0');
  INSERT INTO bank_deposits (practice_id, deposit_number, prepared_on, amount, notes, prepared_by)
  VALUES (p_practice_id, v_number, ar_today(), v_amount, NULLIF(btrim(COALESCE(p_payload->>'notes', '')), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO bank_deposit_items (practice_id, deposit_id, receipt_id, amount)
  SELECT p_practice_id, v_id, r.id, r.amount FROM receipts r WHERE r.id = ANY (v_receipts);
  INSERT INTO bank_deposit_items (practice_id, deposit_id, refund_id, amount)
  SELECT p_practice_id, v_id, a.id, -a.amount FROM invoice_adjustments a WHERE a.id = ANY (v_refunds);
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'amount', v_amount);
END $$;

CREATE OR REPLACE FUNCTION public.dc_mark_deposited(p_deposit_id uuid, p_bank_reference text, p_deposited_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit bank_deposits%ROWTYPE;
  v_bad     text;
BEGIN
  SELECT * INTO v_deposit FROM bank_deposits WHERE id = p_deposit_id FOR UPDATE;
  PERFORM dc_assert_member(v_deposit.practice_id);
  IF v_deposit.status <> 'prepared' THEN
    RAISE EXCEPTION 'Deposit slip % is already %', v_deposit.deposit_number, v_deposit.status;
  END IF;
  IF NULLIF(btrim(COALESCE(p_bank_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the bank reference from the deposit slip or the bank app';
  END IF;
  IF p_deposited_on IS NULL OR p_deposited_on > ar_today() THEN
    RAISE EXCEPTION 'The deposit date cannot be in the future';
  END IF;
  IF p_deposited_on < v_deposit.prepared_on THEN
    RAISE EXCEPTION 'The money cannot be banked before the slip was prepared';
  END IF;
  SELECT string_agg(COALESCE(r.receipt_number, a.adjustment_number), ', ') INTO v_bad
    FROM bank_deposit_items i
    LEFT JOIN receipts r ON r.id = i.receipt_id
    LEFT JOIN invoice_adjustments a ON a.id = i.refund_id
   WHERE i.deposit_id = p_deposit_id AND i.released_at IS NULL AND (r.reversed_at IS NOT NULL OR a.reversed_at IS NOT NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '% reversed after the slip was prepared. Cancel the slip and prepare it again.', v_bad;
  END IF;
  UPDATE bank_deposits
     SET status = 'deposited', deposited_on = p_deposited_on, bank_reference = btrim(p_bank_reference), deposited_by = auth.uid(), deposited_at = now()
   WHERE id = p_deposit_id;
  RETURN jsonb_build_object('id', p_deposit_id, 'number', v_deposit.deposit_number, 'deposited', true);
END $$;

CREATE OR REPLACE FUNCTION public.dc_cancel_deposit(p_deposit_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit bank_deposits%ROWTYPE;
BEGIN
  SELECT * INTO v_deposit FROM bank_deposits WHERE id = p_deposit_id FOR UPDATE;
  PERFORM dc_assert_member(v_deposit.practice_id);
  IF v_deposit.status <> 'prepared' THEN
    RAISE EXCEPTION 'Deposit slip % is % and cannot be cancelled', v_deposit.deposit_number, v_deposit.status;
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the slip is cancelled';
  END IF;
  UPDATE bank_deposits SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason) WHERE id = p_deposit_id;
  UPDATE bank_deposit_items SET released_at = now() WHERE deposit_id = p_deposit_id AND released_at IS NULL;
  RETURN jsonb_build_object('id', p_deposit_id, 'number', v_deposit.deposit_number, 'cancelled', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 11. Control totals: movements in what debtors owe, before / in / after a period, and the ledger
--     balance now. The rules are ledgerMovements.ts's: invoices on their invoice date at what they
--     bill now (undated ones count before everything); money on the day it moved; reversals on the
--     day they were made; allocations and shortfall transfers are not movements.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dc_movements(p_practice_id uuid)
RETURNS TABLE (movement_date date, kind text, amount numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(dc_invoice_date(i.issue_date, i.created_at), DATE '0001-01-01'), 'invoices', dc_invoice_billed(i.total, i.payment_status)
    FROM invoices_enhanced i WHERE i.practice_id = p_practice_id
  UNION ALL
  SELECT r.received_on, 'receipts', -r.amount FROM receipts r WHERE r.practice_id = p_practice_id
  UNION ALL
  SELECT dc_local_date(r.reversed_at), 'receipt_reversals', r.amount FROM receipts r WHERE r.practice_id = p_practice_id AND r.reversed_at IS NOT NULL
  UNION ALL
  SELECT a.effective_on,
         CASE a.kind WHEN 'credit_note' THEN 'credit_notes' WHEN 'write_off' THEN 'write_offs' WHEN 'journal' THEN 'journals' ELSE 'refunds' END,
         CASE WHEN a.kind IN ('credit_note', 'write_off') THEN -a.amount ELSE a.amount END
    FROM invoice_adjustments a WHERE a.practice_id = p_practice_id AND a.kind <> 'shortfall_transfer'
  UNION ALL
  SELECT dc_local_date(a.reversed_at),
         CASE a.kind WHEN 'refund' THEN 'refund_reversals' ELSE 'adjustment_reversals' END,
         CASE WHEN a.kind IN ('credit_note', 'write_off') THEN a.amount ELSE -a.amount END
    FROM invoice_adjustments a WHERE a.practice_id = p_practice_id AND a.kind <> 'shortfall_transfer' AND a.reversed_at IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.dc_control_totals_internal(p_practice_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb := '{}'::jsonb;
  v_during jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  v_owed   numeric;
  v_credit numeric;
  r        record;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Choose a period: a first and a last day';
  END IF;
  FOR r IN
    SELECT m.kind,
           COALESCE(SUM(m.amount) FILTER (WHERE m.movement_date < p_from), 0) AS before_amount,
           COALESCE(SUM(m.amount) FILTER (WHERE m.movement_date BETWEEN p_from AND p_to), 0) AS during_amount,
           COALESCE(SUM(m.amount) FILTER (WHERE m.movement_date > p_to), 0) AS after_amount
      FROM dc_movements(p_practice_id) m
     GROUP BY m.kind
  LOOP
    v_before := v_before || jsonb_build_object(r.kind, round(r.before_amount * 100)::bigint);
    v_during := v_during || jsonb_build_object(r.kind, round(r.during_amount * 100)::bigint);
    v_after := v_after || jsonb_build_object(r.kind, round(r.after_amount * 100)::bigint);
  END LOOP;
  SELECT COALESCE(SUM(b.outstanding), 0) INTO v_owed FROM ar_invoice_balances b WHERE b.practice_id = p_practice_id;
  SELECT COALESCE(SUM(b.unallocated), 0) INTO v_credit FROM ar_receipt_balances b WHERE b.practice_id = p_practice_id;
  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'before', v_before, 'during', v_during, 'after', v_after,
                            'ledger_net_cents', round((v_owed - v_credit) * 100)::bigint);
END $$;

-- dc_control_totals(practice, first day, last day): the cents per movement kind before, in and
-- after the period, and ledger_net_cents (invoice balances less unallocated credit, now)
CREATE OR REPLACE FUNCTION public.dc_control_totals(p_practice_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  RETURN dc_control_totals_internal(p_practice_id, p_from, p_to);
END $$;

CREATE OR REPLACE FUNCTION public.dc_net_cents(p_totals jsonb)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(value::bigint), 0)::bigint FROM jsonb_each_text(COALESCE(p_totals, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------------------------------
-- 12. Closing and reopening a month
-- ---------------------------------------------------------------------------------------------
/*
  dc_close_period(practice, any day of the month, {
    "explanations": { "<receipt id>": "why its money stays unallocated" },
    "notes"?: text,
    "screen_during"?: { "<movement kind>": cents },   -- the month's totals the screen built the pack from
    "pack"?: { ... }                                  -- the month-end pack, kept with the close
  })
*/
CREATE OR REPLACE FUNCTION public.dc_close_period(p_practice_id uuid, p_month date, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month       date := date_trunc('month', p_month)::date;
  v_end         date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_missing     text;
  v_totals      jsonb;
  v_opening     bigint;
  v_computed    bigint;
  v_movement    bigint;
  v_ledger      bigint;
  v_previous    numeric;
  v_kinds       text[] := ARRAY['invoices', 'credit_notes', 'write_offs', 'journals', 'receipts', 'refunds', 'receipt_reversals', 'refund_reversals', 'adjustment_reversals'];
  v_last        bigint;
  v_id          uuid;
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'close a month');
  IF p_month IS NULL THEN
    RAISE EXCEPTION 'Choose the month to close';
  END IF;
  -- One close at a time per practice
  PERFORM pg_advisory_xact_lock(hashtext('dc_close_period:' || p_practice_id::text));
  IF v_end >= ar_today() THEN
    RAISE EXCEPTION '% has not ended yet: it can be closed from %', dc_month_label(v_month), dc_day_label(v_end + 1);
  END IF;
  IF EXISTS (SELECT 1 FROM period_closes WHERE practice_id = p_practice_id AND period_month = v_month AND reopened_at IS NULL) THEN
    RAISE EXCEPTION '% is already closed', dc_month_label(v_month);
  END IF;

  -- Every receipt allocated, or its unallocated money explained
  SELECT string_agg(b.receipt_number || ' (' || ar_format_nad(b.unallocated) || ')', ', ' ORDER BY b.received_on, b.receipt_number) INTO v_missing
    FROM ar_receipt_balances b
   WHERE b.practice_id = p_practice_id AND b.unallocated > 0 AND b.received_on <= v_end
     AND NULLIF(btrim(COALESCE(p_payload->'explanations'->>(b.receipt_id::text), '')), '') IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Allocate these receipts or say why their money stays unallocated: %', v_missing;
  END IF;

  -- Every day money was received or refunded is cashed up
  SELECT string_agg(dc_day_label(days.d), ', ' ORDER BY days.d) INTO v_missing
    FROM (SELECT received_on AS d FROM receipts WHERE practice_id = p_practice_id AND received_on BETWEEN v_month AND v_end
          UNION
          SELECT effective_on FROM invoice_adjustments WHERE practice_id = p_practice_id AND kind = 'refund' AND effective_on BETWEEN v_month AND v_end) days
   WHERE NOT EXISTS (SELECT 1 FROM cash_ups c WHERE c.practice_id = p_practice_id AND c.business_date = days.d AND c.superseded_at IS NULL);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'These days have payments but no cash-up: %', v_missing;
  END IF;

  -- Control totals: the entries must add up to the balances, and the opening to the last close
  v_totals := dc_control_totals_internal(p_practice_id, v_month, v_end);
  v_computed := dc_net_cents(v_totals->'before');
  v_movement := dc_net_cents(v_totals->'during');
  v_ledger := (v_totals->>'ledger_net_cents')::bigint - dc_net_cents(v_totals->'after');
  IF v_computed + v_movement <> v_ledger THEN
    RAISE EXCEPTION 'The entries add up to % but the account balances say % for the end of %. Find the difference before closing.',
      ar_format_nad((v_computed + v_movement) / 100.0), ar_format_nad(v_ledger / 100.0), dc_month_label(v_month);
  END IF;
  SELECT closing_balance INTO v_previous FROM period_closes
   WHERE practice_id = p_practice_id AND period_month = (v_month - interval '1 month')::date AND reopened_at IS NULL;
  v_opening := COALESCE(round(v_previous * 100)::bigint, v_computed);
  IF v_opening <> v_computed THEN
    RAISE EXCEPTION 'The entries before % now add up to %, not the % kept when % was closed: something dated in a closed month changed. Reopen that month with a reason and close it again.',
      dc_month_label(v_month), ar_format_nad(v_computed / 100.0), ar_format_nad(v_previous), dc_month_label((v_month - interval '1 month')::date);
  END IF;
  IF jsonb_typeof(p_payload->'screen_during') = 'object' THEN
    SELECT string_agg(k, ', ') INTO v_missing FROM unnest(v_kinds) AS k
     WHERE COALESCE((p_payload->'screen_during'->>k)::bigint, 0) <> COALESCE((v_totals->'during'->>k)::bigint, 0);
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'The figures on screen differ from the database (%). Reload the page and try again.', v_missing;
    END IF;
  END IF;

  v_last := dc_seal_daybook_internal(p_practice_id);
  INSERT INTO period_closes (practice_id, period_month, closing_balance, snapshot, explanations, notes, closed_by)
  VALUES (p_practice_id, v_month, (v_opening + v_movement) / 100.0,
          jsonb_build_object(
            'control_totals', v_totals || jsonb_build_object('opening_cents', v_opening, 'closing_cents', v_opening + v_movement,
                                                             'opening_source', CASE WHEN v_previous IS NULL THEN 'computed' ELSE 'previous_close' END),
            'daybook_to', v_last,
            'pack', COALESCE(p_payload->'pack', '{}'::jsonb)),
          CASE WHEN jsonb_typeof(p_payload->'explanations') = 'object' THEN p_payload->'explanations' ELSE '{}'::jsonb END,
          NULLIF(btrim(COALESCE(p_payload->>'notes', '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'month', v_month, 'closing_cents', v_opening + v_movement);
END $$;

CREATE OR REPLACE FUNCTION public.dc_reopen_period(p_practice_id uuid, p_month date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_id    uuid;
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'reopen a month');
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Say why the month is reopened (it is kept with the month)';
  END IF;
  UPDATE period_closes SET reopened_at = now(), reopened_by = auth.uid(), reopen_reason = btrim(p_reason)
   WHERE practice_id = p_practice_id AND period_month = v_month AND reopened_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION '% is not closed', dc_month_label(v_month);
  END IF;
  RETURN jsonb_build_object('id', v_id, 'month', v_month, 'reopened', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 13. Interest (optional, off by default)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debtor_settings (
  practice_id               uuid PRIMARY KEY REFERENCES public.practices(id) ON DELETE CASCADE,
  interest_enabled          boolean NOT NULL DEFAULT false,
  -- Yearly rate in percent, charged monthly at a twelfth
  interest_annual_rate      numeric(6,2) NOT NULL DEFAULT 0 CHECK (interest_annual_rate >= 0 AND interest_annual_rate <= 100),
  interest_min_age_days     integer NOT NULL DEFAULT 60 CHECK (interest_min_age_days >= 30),
  -- Also on medical aid portions the fund has not paid (charged to the patient)
  interest_on_medical_aid   boolean NOT NULL DEFAULT false,
  interest_minimum          numeric(14,2) NOT NULL DEFAULT 1.00 CHECK (interest_minimum >= 0),
  updated_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT debtor_settings_rate_when_on CHECK (NOT interest_enabled OR interest_annual_rate > 0)
);
COMMENT ON TABLE public.debtor_settings IS 'Per practice: interest on overdue patient balances. Off unless the practice turns it on.';

CREATE OR REPLACE FUNCTION public.dc_save_debtor_settings(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean := COALESCE((p_payload->>'interest_enabled')::boolean, false);
  v_rate    numeric := COALESCE(NULLIF(p_payload->>'interest_annual_rate', '')::numeric, 0);
  v_days    integer := COALESCE(NULLIF(p_payload->>'interest_min_age_days', '')::integer, 60);
  v_on_ma   boolean := COALESCE((p_payload->>'interest_on_medical_aid')::boolean, false);
  v_min     numeric := CASE WHEN p_payload ? 'interest_minimum' THEN ar_amount(p_payload->'interest_minimum') ELSE 1.00 END;
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'change interest settings');
  IF v_rate <> round(v_rate, 2) OR v_rate < 0 OR v_rate > 100 OR (v_enabled AND v_rate <= 0) THEN
    RAISE EXCEPTION 'Enter a yearly interest rate above 0%% and at most 100%%, with at most 2 decimals';
  END IF;
  IF v_days < 30 THEN
    RAISE EXCEPTION 'Interest starts on debts at least 30 days old';
  END IF;
  IF v_min < 0 THEN
    RAISE EXCEPTION 'Enter the smallest charge in N$';
  END IF;
  INSERT INTO debtor_settings (practice_id, interest_enabled, interest_annual_rate, interest_min_age_days, interest_on_medical_aid, interest_minimum, updated_by, updated_at)
  VALUES (p_practice_id, v_enabled, v_rate, v_days, v_on_ma, v_min, auth.uid(), now())
  ON CONFLICT (practice_id) DO UPDATE SET
    interest_enabled = EXCLUDED.interest_enabled, interest_annual_rate = EXCLUDED.interest_annual_rate,
    interest_min_age_days = EXCLUDED.interest_min_age_days, interest_on_medical_aid = EXCLUDED.interest_on_medical_aid,
    interest_minimum = EXCLUDED.interest_minimum, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  RETURN jsonb_build_object('practice_id', p_practice_id, 'interest_enabled', v_enabled);
END $$;

CREATE TABLE IF NOT EXISTS public.interest_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  period_month    date NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  run_on          date NOT NULL,
  annual_rate     numeric(6,2) NOT NULL,
  min_age_days    integer NOT NULL,
  on_medical_aid  boolean NOT NULL,
  total           numeric(14,2) NOT NULL DEFAULT 0,
  line_count      integer NOT NULL DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  CONSTRAINT interest_runs_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND NULLIF(btrim(reversal_reason), '') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS interest_runs_one_per_month ON public.interest_runs (practice_id, period_month) WHERE reversed_at IS NULL;
COMMENT ON TABLE public.interest_runs IS 'Interest charged for a month (once per month), with the rate used. Reversing a run reverses its journals.';

CREATE TABLE IF NOT EXISTS public.interest_run_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  run_id        uuid NOT NULL REFERENCES public.interest_runs(id) ON DELETE RESTRICT,
  invoice_id    uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  patient_id    uuid,
  base          numeric(14,2) NOT NULL,
  interest      numeric(14,2) NOT NULL CHECK (interest > 0),
  adjustment_id uuid NOT NULL REFERENCES public.invoice_adjustments(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS interest_run_lines_run_idx ON public.interest_run_lines (run_id);

-- Runs: only the reversal may be recorded (the totals are written while the run is posted)
CREATE OR REPLACE FUNCTION public.dc_interest_runs_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_fields text[] := ARRAY['reversed_at', 'reversed_by', 'reversal_reason', 'total', 'line_count'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'An interest run is never deleted; reverse it instead';
  END IF;
  IF OLD.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This interest run is already reversed';
  END IF;
  IF (to_jsonb(NEW) - v_fields) IS DISTINCT FROM (to_jsonb(OLD) - v_fields)
     OR (NEW.reversed_at IS NOT NULL AND (NEW.total IS DISTINCT FROM OLD.total OR NEW.line_count IS DISTINCT FROM OLD.line_count)) THEN
    RAISE EXCEPTION 'An interest run cannot be changed, only reversed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dc_20_guard ON public.interest_runs;
CREATE TRIGGER dc_20_guard BEFORE UPDATE OR DELETE ON public.interest_runs
  FOR EACH ROW EXECUTE FUNCTION public.dc_interest_runs_guard();
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.interest_runs;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.interest_runs
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();
DROP TRIGGER IF EXISTS dc_20_history ON public.interest_run_lines;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.interest_run_lines
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.interest_run_lines;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.interest_run_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

/*
  dc_post_interest_run(practice, { "lines": [{ "invoice_id": uuid, "interest": 12.34 }] })
  This month's interest, once. Each line is checked again with planInterestRun's rules
  (creditControl.ts): interest on, old enough, not disputed or handed over, at least the smallest
  charge, and no more than a month's interest on the capital still owed, capped so unpaid interest
  never exceeds that capital (in duplum).
*/
CREATE OR REPLACE FUNCTION public.dc_post_interest_run(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s          debtor_settings%ROWTYPE;
  v_month    date := date_trunc('month', ar_today())::date;
  v_run      uuid;
  v_line     jsonb;
  v_invoice  invoices_enhanced%ROWTYPE;
  b          ar_invoice_balances%ROWTYPE;
  v_account  uuid;
  v_standing numeric;
  v_unpaid   numeric;
  v_capital  numeric;
  v_room     numeric;
  v_max      numeric;
  v_interest numeric;
  v_adj      invoice_adjustments%ROWTYPE;
  v_total    numeric := 0;
  v_count    integer := 0;
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'post interest');
  SELECT * INTO s FROM debtor_settings WHERE practice_id = p_practice_id;
  IF NOT FOUND OR NOT s.interest_enabled THEN
    RAISE EXCEPTION 'Interest is turned off for this practice';
  END IF;
  IF EXISTS (SELECT 1 FROM interest_runs WHERE practice_id = p_practice_id AND period_month = v_month AND reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Interest for % has been charged already', dc_month_label(v_month);
  END IF;
  PERFORM dc_assert_open(p_practice_id, ar_today(), 'an interest run');
  IF jsonb_array_length(COALESCE(p_payload->'lines', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'There is no interest to charge';
  END IF;

  INSERT INTO interest_runs (practice_id, period_month, run_on, annual_rate, min_age_days, on_medical_aid, created_by)
  VALUES (p_practice_id, v_month, ar_today(), s.interest_annual_rate, s.interest_min_age_days, s.interest_on_medical_aid, auth.uid())
  RETURNING id INTO v_run;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
    SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = NULLIF(v_line->>'invoice_id', '')::uuid AND practice_id = p_practice_id FOR UPDATE;
    IF NOT FOUND OR ar_is_cancelled(v_invoice.payment_status) OR v_invoice.patient_id IS NULL THEN
      RAISE EXCEPTION 'Interest can only be charged on an open invoice of a patient of this practice';
    END IF;
    v_account := dc_account_of(p_practice_id, v_invoice.patient_id);
    IF EXISTS (SELECT 1 FROM account_flags f
                WHERE f.practice_id = p_practice_id AND f.patient_id = v_account AND f.cleared_at IS NULL AND f.flag IN ('dispute', 'handed_over')) THEN
      RAISE EXCEPTION 'Invoice % is on an account in dispute or handed over: no interest', v_invoice.invoice_number;
    END IF;
    IF dc_invoice_date(v_invoice.issue_date, v_invoice.created_at) > ar_today() - s.interest_min_age_days THEN
      RAISE EXCEPTION 'Invoice % is not % days old yet', v_invoice.invoice_number, s.interest_min_age_days;
    END IF;
    SELECT * INTO b FROM ar_invoice_balances WHERE invoice_id = v_invoice.id;
    SELECT COALESCE(SUM(a.amount), 0) INTO v_standing FROM invoice_adjustments a
     WHERE a.invoice_id = v_invoice.id AND a.kind = 'journal' AND a.reason_code = 'interest' AND a.reversed_at IS NULL;
    v_unpaid := LEAST(GREATEST(v_standing, 0), GREATEST(b.patient_outstanding, 0));
    v_capital := GREATEST(b.patient_outstanding, 0) - v_unpaid
               + CASE WHEN s.interest_on_medical_aid THEN GREATEST(b.medical_aid_outstanding, 0) ELSE 0 END;
    v_room := v_capital - v_unpaid;
    v_max := LEAST(round(v_capital * s.interest_annual_rate / 1200, 2), v_room);
    v_interest := ar_amount(v_line->'interest');
    IF v_interest <= 0 OR v_interest > v_max OR v_interest < s.interest_minimum THEN
      RAISE EXCEPTION 'Interest on invoice % must be between % and % this month (refresh the plan and try again)',
        v_invoice.invoice_number, ar_format_nad(s.interest_minimum), ar_format_nad(GREATEST(v_max, 0));
    END IF;
    v_adj := ar_insert_adjustment(p_practice_id, 'journal', jsonb_build_object(
      'invoice_id', v_invoice.id,
      'portion', 'patient',
      'amount', v_interest,
      'reason_code', 'interest',
      'reason', 'Interest for ' || dc_month_label(v_month) || ' at ' || rtrim(rtrim(s.interest_annual_rate::text, '0'), '.')
                || '% a year on ' || ar_format_nad(v_capital) || ' overdue',
      'effective_on', ar_today(),
      'external_ref', 'interest:' || v_run::text || ':' || v_invoice.id::text
    ), ar_today());
    INSERT INTO interest_run_lines (practice_id, run_id, invoice_id, patient_id, base, interest, adjustment_id)
    VALUES (p_practice_id, v_run, v_invoice.id, v_invoice.patient_id, v_capital, v_interest, v_adj.id);
    v_total := v_total + v_interest;
    v_count := v_count + 1;
  END LOOP;

  UPDATE interest_runs SET total = v_total, line_count = v_count WHERE id = v_run;
  RETURN jsonb_build_object('id', v_run, 'total', v_total, 'line_count', v_count);
END $$;

CREATE OR REPLACE FUNCTION public.dc_reverse_interest_run(p_run_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run  interest_runs%ROWTYPE;
  v_line record;
BEGIN
  SELECT * INTO v_run FROM interest_runs WHERE id = p_run_id FOR UPDATE;
  PERFORM dc_assert_role(v_run.practice_id, ARRAY['admin'], 'reverse an interest run');
  IF v_run.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This interest run is already reversed';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the interest is reversed';
  END IF;
  -- Each journal is reversed with the receipts proposal's own checks (paid interest must be un-paid first)
  FOR v_line IN
    SELECT l.adjustment_id FROM interest_run_lines l JOIN invoice_adjustments a ON a.id = l.adjustment_id
     WHERE l.run_id = p_run_id AND a.reversed_at IS NULL
  LOOP
    PERFORM ar_reverse_adjustment(v_line.adjustment_id, 'Interest run reversed: ' || btrim(p_reason));
  END LOOP;
  UPDATE interest_runs SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason) WHERE id = p_run_id;
  RETURN jsonb_build_object('id', p_run_id, 'reversed', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 14. Statement runs
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statement_criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- statementCriteriaJson in src/services/ledger/statementRuns.ts
  criteria    jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'object'),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS statement_criteria_name_unique ON public.statement_criteria (practice_id, lower(btrim(name))) WHERE archived_at IS NULL;
COMMENT ON TABLE public.statement_criteria IS 'Saved statement runs ("statement keys"): who gets a statement and how. Archived, never deleted.';

CREATE TABLE IF NOT EXISTS public.statement_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  criteria_id uuid REFERENCES public.statement_criteria(id) ON DELETE SET NULL,
  name        text NOT NULL,
  criteria    jsonb NOT NULL,
  as_at       date NOT NULL,
  -- Planned per channel and skipped, e.g. {"email": 40, "sms": 3, "print": 12, "skipped": 9}
  planned     jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_by  uuid,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  -- What happened: counts per channel and the accounts that failed (patient id, channel, error)
  results     jsonb
);
CREATE INDEX IF NOT EXISTS statement_runs_practice_idx ON public.statement_runs (practice_id, started_at DESC);
COMMENT ON TABLE public.statement_runs IS 'Each statement run: what was planned and, once finished, what was sent. Every SMS and email is also in the practice''s communication logs (metadata.statementRunId).';

CREATE OR REPLACE FUNCTION public.dc_statement_criteria_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Saved statement runs are archived, not deleted';
END $$;

DROP TRIGGER IF EXISTS dc_20_guard ON public.statement_criteria;
CREATE TRIGGER dc_20_guard BEFORE DELETE ON public.statement_criteria
  FOR EACH ROW EXECUTE FUNCTION public.dc_statement_criteria_guard();
DROP TRIGGER IF EXISTS dc_20_history ON public.statement_runs;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.statement_runs
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('finished_at,results', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.statement_runs;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.statement_runs
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

CREATE OR REPLACE FUNCTION public.dc_save_statement_criteria(p_practice_id uuid, p_id uuid, p_name text, p_criteria jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give the run a name, e.g. "Monthly statements"';
  END IF;
  IF jsonb_typeof(p_criteria) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'The criteria are missing';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO statement_criteria (practice_id, name, criteria, created_by, updated_by)
    VALUES (p_practice_id, btrim(p_name), p_criteria, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE statement_criteria SET name = btrim(p_name), criteria = p_criteria, updated_by = auth.uid(), updated_at = now()
     WHERE id = p_id AND practice_id = p_practice_id AND archived_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'This saved run no longer exists';
    END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.dc_archive_statement_criteria(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT practice_id INTO v_practice FROM statement_criteria WHERE id = p_id;
  PERFORM dc_assert_member(v_practice);
  UPDATE statement_criteria SET archived_at = now(), archived_by = auth.uid() WHERE id = p_id AND archived_at IS NULL;
  RETURN jsonb_build_object('id', p_id, 'archived', true);
END $$;

CREATE OR REPLACE FUNCTION public.dc_start_statement_run(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  INSERT INTO statement_runs (practice_id, criteria_id, name, criteria, as_at, planned, started_by)
  VALUES (p_practice_id,
          (SELECT id FROM statement_criteria WHERE id = NULLIF(p_payload->>'criteria_id', '')::uuid AND practice_id = p_practice_id),
          COALESCE(NULLIF(btrim(COALESCE(p_payload->>'name', '')), ''), 'Statements'),
          CASE WHEN jsonb_typeof(p_payload->'criteria') = 'object' THEN p_payload->'criteria' ELSE '{}'::jsonb END,
          COALESCE(NULLIF(p_payload->>'as_at', '')::date, ar_today()),
          CASE WHEN jsonb_typeof(p_payload->'planned') = 'object' THEN p_payload->'planned' ELSE '{}'::jsonb END,
          auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.dc_finish_statement_run(p_run_id uuid, p_results jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run statement_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM statement_runs WHERE id = p_run_id;
  PERFORM dc_assert_member(v_run.practice_id);
  IF v_run.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'This statement run has already finished';
  END IF;
  UPDATE statement_runs SET finished_at = now(), results = COALESCE(p_results, '{}'::jsonb) WHERE id = p_run_id;
  RETURN jsonb_build_object('id', p_run_id, 'finished', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 15. Row level security and grants. Read: members of the practice. Write: only the functions.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['account_holder_links', 'account_flags', 'credit_control_notes', 'payment_promises', 'period_closes',
                                 'daybook_entries', 'daybook_prints', 'cash_ups', 'bank_deposits', 'bank_deposit_items',
                                 'debtor_settings', 'interest_runs', 'interest_run_lines', 'statement_criteria', 'statement_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = %I.practice_id))',
      v_table || '_select', v_table, v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
  END LOOP;
END $$;

-- The counters are read and written only by the functions
ALTER TABLE public.dc_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dc_counters FROM anon, authenticated;

-- No dc_ function is callable with the public key; the API ones are granted to signed-in staff below
DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND left(p.proname, 3) = 'dc_'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_function);
  END LOOP;
END $$;

-- Internal functions: not callable from the API at all
DO $$
DECLARE
  v_function text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.dc_role(uuid)', 'public.dc_assert_member(uuid)', 'public.dc_assert_role(uuid,text[],text)', 'public.dc_assert_patient(uuid,uuid)',
    'public.dc_assert_open(uuid,date,text)', 'public.dc_daybook_append(uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,numeric,numeric,date,jsonb)',
    'public.dc_seal_daybook_internal(uuid)', 'public.dc_movements(uuid)', 'public.dc_control_totals_internal(uuid,date,date)',
    'public.dc_expected_cash(uuid,date)', 'public.dc_account_of(uuid,uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_function);
  END LOOP;
END $$;

-- The API (signed-in staff; each function checks the practice and the role)
DO $$
DECLARE
  v_function text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.dc_link_account_holder(uuid,uuid,uuid,text)', 'public.dc_unlink_account_holder(uuid,uuid,text)',
    'public.dc_set_account_flag(uuid,uuid,text,jsonb)', 'public.dc_clear_account_flag(uuid,uuid,text,text)', 'public.dc_set_sms_opt_out(uuid,uuid,boolean)',
    'public.dc_add_contact_note(uuid,uuid,text,text)', 'public.dc_record_promise(uuid,uuid,jsonb)', 'public.dc_cancel_promise(uuid,text)',
    'public.dc_first_open_day(uuid,date)', 'public.dc_seal_daybook(uuid)', 'public.dc_record_daybook_print(uuid,date,text)',
    'public.dc_record_cash_up(uuid,date,jsonb)', 'public.dc_prepare_deposit(uuid,jsonb)', 'public.dc_mark_deposited(uuid,text,date)',
    'public.dc_cancel_deposit(uuid,text)', 'public.dc_control_totals(uuid,date,date)', 'public.dc_close_period(uuid,date,jsonb)',
    'public.dc_reopen_period(uuid,date,text)', 'public.dc_save_debtor_settings(uuid,jsonb)', 'public.dc_post_interest_run(uuid,jsonb)',
    'public.dc_reverse_interest_run(uuid,text)', 'public.dc_save_statement_criteria(uuid,uuid,text,jsonb)',
    'public.dc_archive_statement_criteria(uuid)', 'public.dc_start_statement_run(uuid,jsonb)', 'public.dc_finish_statement_run(uuid,jsonb)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 16. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count    integer := 0;
  v_bad      text;
  v_practice uuid;
  v_totals   jsonb;
  v_sum      bigint;
BEGIN
  -- Every table is protected
  SELECT string_agg(c.relname, ', ') INTO v_bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
     AND c.relname IN ('account_holder_links', 'account_flags', 'credit_control_notes', 'payment_promises', 'period_closes', 'daybook_entries',
                       'daybook_prints', 'cash_ups', 'bank_deposits', 'bank_deposit_items', 'debtor_settings', 'interest_runs',
                       'interest_run_lines', 'statement_criteria', 'statement_runs', 'dc_counters');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: row level security is off on %', v_bad;
  END IF;

  -- No dc_ function is executable by the public key
  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND left(p.proname, 3) = 'dc_' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the public key can run %', v_bad;
  END IF;

  -- The lock and the daybook are attached
  SELECT string_agg(t.tbl || '.' || t.name, ', ') INTO v_bad
    FROM (VALUES ('receipts', 'zz_dc_period_lock'), ('invoice_adjustments', 'zz_dc_period_lock'), ('invoices_enhanced', 'zz_dc_period_lock'),
                 ('invoices_enhanced', 'zz_dc_daybook'), ('ar_audit_events', 'zz_dc_daybook')) AS t(tbl, name)
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.' || t.tbl)::regclass AND g.tgname = t.name);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: triggers missing: %', v_bad;
  END IF;

  -- For every practice, the movements of all time add up to what the balances say debtors owe now
  -- (invoice balances less unallocated credit). The month-end control totals rely on this.
  FOR v_practice IN
    SELECT practice_id FROM invoices_enhanced WHERE practice_id IS NOT NULL
    UNION SELECT practice_id FROM receipts
  LOOP
    v_totals := dc_control_totals_internal(v_practice, DATE '0001-01-01', ar_today());
    v_sum := dc_net_cents(v_totals->'before') + dc_net_cents(v_totals->'during') + dc_net_cents(v_totals->'after');
    IF v_sum <> (v_totals->>'ledger_net_cents')::bigint THEN
      v_bad := concat_ws('; ', v_bad, format('practice %s: movements %s cents, balances %s cents', v_practice, v_sum, v_totals->>'ledger_net_cents'));
    END IF;
    v_count := v_count + 1;
  END LOOP;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the ledger movements do not add up to the account balances (%). Do not apply until this is explained.', v_bad;
  END IF;
  RAISE NOTICE 'Section 16: checks passed; the movements add up to the balances for % practices.', v_count;
END $$;

-- PostgREST: pick up the new tables and functions
NOTIFY pgrst, 'reload schema';

-- Undo after a COMMIT (the lock and the daybook stop at once; the history tables are records:
-- export them first if they hold anything, and reverse interest runs before dropping them, since
-- their journals stay on the invoices):
--   DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.receipts;
--   DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.invoice_adjustments;
--   DROP TRIGGER IF EXISTS zz_dc_period_lock ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS zz_dc_daybook ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS zz_dc_daybook ON public.ar_audit_events;
--   DROP TABLE IF EXISTS public.interest_run_lines, public.interest_runs, public.debtor_settings, public.statement_runs,
--     public.statement_criteria, public.bank_deposit_items, public.bank_deposits, public.cash_ups, public.daybook_prints,
--     public.daybook_entries, public.dc_counters, public.period_closes, public.payment_promises, public.credit_control_notes,
--     public.account_flags, public.account_holder_links;
--   Then drop the dc_ functions: SELECT format('DROP FUNCTION %s;', p.oid::regprocedure) FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND left(p.proname, 3) = 'dc_';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
