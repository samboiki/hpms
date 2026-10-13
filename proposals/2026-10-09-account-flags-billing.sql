-- Applied 2026-10-09 as migration account_flags_billing_2026_10_09 (version 20261009102954; stored statement md5 b00c7378f42880c9efb6f2e59d790f8a = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: dc_flag_rule a800489ecc468bfc913e1785a62b3ea8, dc_post_interest_run 3c48721c6afeb4ac7b571d976fbbc4e5.
-- Rehearsed with simulated logins together with 2026-10-09-allocation-lines.sql (rolled back): a receptionist set "Lay-bye"
-- but not "No interest" and could not override a credit limit; an administrator was refused without a limit or a reason,
-- then the override was kept as a credit-control note; an interest line on the lay-bye account was refused; anon cannot run it.
-- =============================================================================================
-- PROPOSAL: account flags where people bill: "No interest" and "Lay-bye", and an administrator's
-- reason kept when an invoice goes over a credit limit
-- File:   proposals/2026-10-09-account-flags-billing.sql                Drafted: 2026-10-09
-- Code:   src/services/ledger/accountFlags.ts (FLAG_DEFINITIONS, checkInvoiceFlags: tested),
--         src/services/ledger/creditControl.ts (planInterestRun: tested), src/services/ledger/statementRuns.ts,
--         src/components/finance/debtors/statementDocument.ts (lay-bye statements: tested),
--         src/components/visits/InvoiceFlagCheck.tsx (the check when a visit is invoiced)
--
-- Why (parity A8): account flags showed only in the patient header and were never checked when invoicing;
-- Eminance keeps "charge interest" and "lay-bye" per account, HPMS had neither.
--
-- What it does (additive; no policy changes, nothing removed)
--   1. account_flags takes two more flags, both on whoever pays (they cover the family), with a reason:
--        no_interest  "No interest": interest runs leave the account out (only an admin or doctor sets it,
--                     like a credit limit: it waives money);
--        lay_bye      "Lay-bye": the account is paid off by agreement (for example glasses kept until paid):
--                     no interest, and its statements say so instead of showing what is overdue.
--   2. dc_flag_rule: the two rules (the same table as FLAG_DEFINITIONS in accountFlags.ts). Started from the live
--      definition; the two rows are added after "statement_language" and nothing else changes.
--   3. dc_post_interest_run refuses interest on a "No interest" or lay-bye account, as it does for disputed and
--      handed-over ones (the same rule as planInterestRun). Started from the live definition: only the flag list
--      and its message change; the role check, the open-month check, in duplum and the journals stay.
--   4. dc_record_credit_limit_override(practice, patient, { invoice_amount, reason }): only a practice
--      administrator may invoice above an account's credit limit, and their reason is kept on the account as a
--      credit-control note (who and when, the limit and what was owed, read here, not from the screen).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Section 5 checks the result.
-- Undo, in this order: DROP FUNCTION public.dc_record_credit_limit_override(uuid, uuid, jsonb);
--   dc_post_interest_run and dc_flag_rule as they were (pg_get_functiondef before this file: the flag list
--   ('dispute', 'handed_over') and the 8 rule rows); clear any no_interest / lay_bye flags, then
--   ALTER TABLE public.account_flags DROP CONSTRAINT account_flags_flag_check, ADD CONSTRAINT account_flags_flag_check
--   CHECK (flag IN ('cash_only', 'no_claims', 'dispute', 'handed_over', 'credit_limit', 'no_statement',
--   'statement_language', 'alert'));
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions: the debtors proposal (account flags, interest, credit-control notes)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.account_flags'), ('public.credit_control_notes'), ('public.ar_patient_balances')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-debtors-and-controls.sql first (missing: %)', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.dc_flag_rule(text)'), ('public.dc_post_interest_run(uuid,jsonb)'), ('public.dc_assert_role(uuid,text[],text)'),
                 ('public.dc_assert_patient(uuid,uuid)'), ('public.dc_account_of(uuid,uuid)'), ('public.ar_amount(jsonb)'),
                 ('public.ar_format_nad(numeric)')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions of the debtors proposal are missing: %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Two more account flags: "No interest" and "Lay-bye"
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.account_flags DROP CONSTRAINT IF EXISTS account_flags_flag_check;
ALTER TABLE public.account_flags ADD CONSTRAINT account_flags_flag_check CHECK (
  flag IN ('cash_only', 'no_claims', 'dispute', 'handed_over', 'credit_limit', 'no_statement', 'statement_language', 'alert',
           'no_interest', 'lay_bye')
);

COMMENT ON TABLE public.account_flags IS
  'Account flags. Account flags (cash_only, dispute, handed_over, credit_limit, no_statement, statement_language, no_interest, lay_bye) are stored on whoever pays and cover the family; patient flags (no_claims, alert) on the patient. Cleared flags are history. No SMS is patients.sms_opt_out.';

-- ---------------------------------------------------------------------------------------------
-- 2. dc_flag_rule: the live definition with the two rules added after "statement_language"
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old text := $old$    ('statement_language', 'Statement language', 'account', false, ARRAY[]::text[])$old$;
  v_new text := $new$    ('statement_language', 'Statement language', 'account', false, ARRAY[]::text[]),
    ('no_interest', 'No interest', 'account', true, ARRAY['admin', 'doctor']),
    ('lay_bye', 'Lay-bye', 'account', true, ARRAY[]::text[])$new$;
BEGIN
  SELECT pg_get_functiondef('public.dc_flag_rule(text)'::regprocedure) INTO v_def;
  IF position('''no_interest''' in v_def) > 0 THEN
    RAISE EXCEPTION 'dc_flag_rule already has the "No interest" rule; nothing changed';
  END IF;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'dc_flag_rule: the statement_language row was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 3. dc_post_interest_run: no interest on a "No interest" or lay-bye account either
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old_flags text := $old$f.flag IN ('dispute', 'handed_over')) THEN$old$;
  v_new_flags text := $new$f.flag IN ('dispute', 'handed_over', 'no_interest', 'lay_bye')) THEN$new$;
  v_old_text text := $old$'Invoice % is on an account in dispute or handed over: no interest'$old$;
  v_new_text text := $new$'Invoice % is on an account in dispute, handed over, on lay-bye or marked "No interest": no interest'$new$;
BEGIN
  SELECT pg_get_functiondef('public.dc_post_interest_run(uuid,jsonb)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old_flags, ''))) / length(v_old_flags) <> 1
     OR (length(v_def) - length(replace(v_def, v_old_text, ''))) / length(v_old_text) <> 1 THEN
    RAISE EXCEPTION 'dc_post_interest_run: the account flag check was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(replace(v_def, v_old_flags, v_new_flags), v_old_text, v_new_text);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 4. An invoice above the credit limit: only an administrator, and their reason is kept on the account
-- ---------------------------------------------------------------------------------------------
/*
  dc_record_credit_limit_override(practice, patient, { "invoice_amount": 450.00, "reason": text })
  Called just before the invoice is saved. The limit and what the account owes (patient portions less
  unallocated credit, every patient on the account) are read here, so the note says what was true.
*/
CREATE OR REPLACE FUNCTION public.dc_record_credit_limit_override(p_practice_id uuid, p_patient_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason  text := btrim(COALESCE(p_payload->>'reason', ''));
  v_invoice numeric(14,2);
  v_account uuid;
  v_limit   numeric(14,2);
  v_owed    numeric(14,2);
  v_id      uuid;
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'invoice above an account''s credit limit');
  PERFORM dc_assert_patient(p_practice_id, p_patient_id);
  v_invoice := ar_amount(p_payload->'invoice_amount');
  IF v_invoice <= 0 THEN
    RAISE EXCEPTION 'Enter the amount of the invoice';
  END IF;
  IF char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Give a reason for going over the credit limit: it is kept with the account';
  END IF;
  v_account := dc_account_of(p_practice_id, p_patient_id);
  SELECT f.amount INTO v_limit FROM account_flags f
   WHERE f.practice_id = p_practice_id AND f.patient_id = v_account AND f.flag = 'credit_limit' AND f.cleared_at IS NULL;
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'This account has no credit limit';
  END IF;
  SELECT COALESCE(SUM(b.patient_owed - b.unallocated_credit), 0) INTO v_owed
    FROM ar_patient_balances b
   WHERE b.practice_id = p_practice_id
     AND (b.patient_id = v_account
          OR b.patient_id IN (SELECT l.patient_id FROM account_holder_links l
                               WHERE l.practice_id = p_practice_id AND l.holder_patient_id = v_account AND l.unlinked_at IS NULL));
  INSERT INTO credit_control_notes (practice_id, patient_id, channel, note, created_by)
  VALUES (p_practice_id, v_account, 'other',
          left('Invoice of ' || ar_format_nad(v_invoice) || ' allowed above the credit limit of ' || ar_format_nad(v_limit)
               || ' (the account owed ' || ar_format_nad(v_owed) || '). Reason: ' || v_reason, 2000),
          auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'patient_id', v_account, 'limit', v_limit, 'owed', v_owed);
END $$;
COMMENT ON FUNCTION public.dc_record_credit_limit_override(uuid, uuid, jsonb) IS
  'Only a practice administrator: keeps their reason for invoicing above an account''s credit limit as a credit-control note on the account.';

REVOKE ALL ON FUNCTION public.dc_record_credit_limit_override(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dc_record_credit_limit_override(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM public.dc_flag_rule('no_interest') WHERE level = 'account' AND needs_reason AND roles = ARRAY['admin', 'doctor']) <> 1
     OR (SELECT count(*) FROM public.dc_flag_rule('lay_bye') WHERE level = 'account' AND needs_reason AND cardinality(roles) = 0) <> 1
     OR (SELECT count(*) FROM public.dc_flag_rule('credit_limit')) <> 1 THEN
    RAISE EXCEPTION 'Check failed: dc_flag_rule does not hold the new rules (or lost an old one)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.dc_post_interest_run(uuid,jsonb)'::regprocedure
       AND position('''no_interest'', ''lay_bye''' in p.prosrc) > 0
       AND position('dc_assert_role(p_practice_id, ARRAY[''admin''], ''post interest'')' in p.prosrc) > 0
  ) THEN
    RAISE EXCEPTION 'Check failed: dc_post_interest_run does not leave out "No interest" and lay-bye accounts';
  END IF;
  IF has_function_privilege('anon', 'public.dc_record_credit_limit_override(uuid,uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.dc_record_credit_limit_override(uuid,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: dc_record_credit_limit_override must be callable by signed-in staff only';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
