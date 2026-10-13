-- Applied 2026-10-13 as migration company_accounts_followup_2026_10_13 (version 20261013033954; stored statement md5 d751440e18d0899ff7cfc74395a19b8b = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins and an invented patient (rolled back): of three invoices, N$500 on a visit billed to
-- an employer, N$200 and N$100 on a visit of an injury case the patient pays, the patient's own balance was N$300 on 2
-- open invoices while the ledger still had the company's N$500 open; the credit-limit override note said the account
-- owed N$300; billed back to the patient, N$800 on 3; another practice read 0 rows, anon 42501; security_invoker, the
-- grants and the columns unchanged.
-- =============================================================================================
-- PROPOSAL: what a patient owes leaves out the invoices company and fund accounts pay (parity A14, A19 follow-up)
-- File:   proposals/2026-10-13-company-accounts-followup.sql                 Drafted: 2026-10-13
-- Needs:  proposals/2026-10-07-receipts-and-allocations.sql (ar_patient_balances, ar_invoice_balances,
--         ar_receipt_balances) and proposals/2026-10-13-company-accounts-and-injury-cases.sql (visit_payers)
-- Code:   src/services/specialListsService.ts (Messages > Lists > Special lists: accounts handed over),
--         src/components/finance/debtors/useAccountFlags.ts (the credit limit at the desk); the database's
--         dc_record_credit_limit_override (the note kept when an administrator invoices above a credit limit)
--
-- Why: a visit billed to the patient's employer, the Employees' Compensation Fund or the MVA Fund makes its invoices
-- the account's to pay (company-accounts-and-injury-cases.sql: every line is in the patient portion, nothing is
-- claimed). ar_patient_balances still added them to the patient's own balance, so the "accounts handed over" list,
-- the credit limit and the credit-limit note counted the employer's debt as the patient's.
--
-- What it does (one view, same columns in the same order; no table, policy or grant changes)
--   ar_patient_balances leaves out the invoices of a visit billed to a company or fund account (visit_payers with an
--   account). A visit of an injury case the patient pays (no account) stays the patient's. The account's own balance
--   is its invoices' balances (Finance > Debtors > Companies). security_invoker as before: the caller's policies apply.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration.
-- Undo: the view as proposals/2026-10-07-receipts-and-allocations.sql wrote it (CREATE OR REPLACE VIEW
--       public.ar_patient_balances ... with the owed part reading every invoice of the patient).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_columns text;
BEGIN
  IF to_regclass('public.visit_payers') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-13-company-accounts-and-injury-cases.sql first (visit_payers)';
  END IF;
  IF to_regclass('public.ar_invoice_balances') IS NULL OR to_regclass('public.ar_receipt_balances') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first (ar_invoice_balances, ar_receipt_balances)';
  END IF;
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO v_columns
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ar_patient_balances';
  IF v_columns IS DISTINCT FROM 'practice_id,patient_id,medical_aid_owed,patient_owed,owed,unallocated_credit,net_balance,open_invoices' THEN
    RAISE EXCEPTION 'Stopped: ar_patient_balances is not the view the receipts file wrote (columns %)', v_columns;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The patient's own balance
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ar_patient_balances WITH (security_invoker = true) AS
WITH owed AS (
  SELECT b.practice_id, b.patient_id,
         SUM(GREATEST(b.medical_aid_outstanding, 0)) AS medical_aid_owed,
         SUM(GREATEST(b.patient_outstanding, 0)) AS patient_owed,
         COUNT(*) FILTER (WHERE b.medical_aid_outstanding > 0 OR b.patient_outstanding > 0) AS open_invoices
  FROM public.ar_invoice_balances b
  WHERE b.patient_id IS NOT NULL AND b.practice_id IS NOT NULL
    -- An invoice of a visit billed to a company or fund account is the account's to pay, not the patient's
    AND NOT EXISTS (
      SELECT 1
        FROM public.invoices_enhanced i
        JOIN public.visit_payers vp ON vp.visit_id = i.visit_id
       WHERE i.id = b.invoice_id AND vp.payer_account_id IS NOT NULL
    )
  GROUP BY b.practice_id, b.patient_id
), credit AS (
  SELECT practice_id, patient_id, SUM(unallocated) AS unallocated_credit
  FROM public.ar_receipt_balances
  WHERE patient_id IS NOT NULL AND unallocated > 0
  GROUP BY practice_id, patient_id
)
SELECT COALESCE(o.practice_id, c.practice_id) AS practice_id,
       COALESCE(o.patient_id, c.patient_id) AS patient_id,
       COALESCE(o.medical_aid_owed, 0) AS medical_aid_owed,
       COALESCE(o.patient_owed, 0) AS patient_owed,
       COALESCE(o.medical_aid_owed, 0) + COALESCE(o.patient_owed, 0) AS owed,
       COALESCE(c.unallocated_credit, 0) AS unallocated_credit,
       COALESCE(o.medical_aid_owed, 0) + COALESCE(o.patient_owed, 0) - COALESCE(c.unallocated_credit, 0) AS net_balance,
       COALESCE(o.open_invoices, 0) AS open_invoices
FROM owed o
FULL JOIN credit c ON c.practice_id = o.practice_id AND c.patient_id = o.patient_id;
COMMENT ON VIEW public.ar_patient_balances IS
  'Per patient account: what the medical aid and the patient still owe, credit not yet allocated, and the net balance. Invoices of visits billed to a company or fund account (visit_payers) are that account''s, not the patient''s.';

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ar_patient_balances', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.ar_patient_balances', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: ar_patient_balances is not for signed-in staff only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'ar_patient_balances'
                    AND 'security_invoker=true' = ANY (COALESCE(c.reloptions, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Check failed: ar_patient_balances must read with the caller''s policies (security_invoker)';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
