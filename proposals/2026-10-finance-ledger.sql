-- Applied 2026-10-13 as migration finance_ledger_2026_10_13 (version 20261013195537; stored statement md5 369b139a5a4fd30b22ed16f7b2d2ff55 = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: double-entry general ledger for HPMS Finance (the accounting export's books)
-- File:   proposals/2026-10-finance-ledger.sql            Drafted: 2026-10-06, reworked 2026-10-13 (agent dbops)
-- Plain-language companion: proposals/2026-10-finance-ledger.md (written for the 2026-10-06 draft: its receipts,
-- allocations and credit-note tables are gone, see "Rework" below)
--
-- Owner decision (13 Oct 2026): "Accounting export (proposals/2026-10-finance-ledger.sql): apply."
--
-- Rework of 13 Oct 2026 (the 6 Oct draft could not be applied as it was)
--   - Section 3 of the draft (payment_receipts, payment_allocations, credit_notes, invoice_balances) and
--     bridge_invoice_status_payment are removed: receipts-and-allocations (applied 7 Oct) already keeps money
--     received in receipts / receipt_allocations and corrections in invoice_adjustments, and its own
--     ar_invoice_status_bridge already turns "marked paid" into a receipt. The ledger now posts FROM those tables:
--     post_receipt (bank or cash against the payer's receivable) and post_adjustment (credit notes, discounts,
--     write-offs, journals, shortfall moves and refunds).
--   - The books are read and managed by the practice's administrators only (users.role = 'admin'): journal lines
--     carry each payslip's amounts, and the owner decided on 13 Oct that payslips are for administrators and the
--     person themself (proposals/2026-10-13-payslips-admin-or-own.sql), and that money corrections are for
--     administrators. The draft let administrators and doctors manage and every staff member read.
--   - Every function is closed to PUBLIC and anon (Supabase grants EXECUTE to everyone by default); the posting
--     functions are closed to signed-in users too: only the triggers and the definer functions run them.
--   - A practice's chart of accounts is created the first time something posts for it (no trigger on practices).
--   - Opening balances brought over from Eminance (invoices numbered OB-...) post against "Opening balances", not
--     revenue. Write-offs post to a new "Bad debts written off" expense account.
--   - Changes are dated in Windhoek time (ar_today()), like the rest of Finance.
--   - Section 7 creates the books of every practice that has staff and posts their history once (finance_backfill).
--
-- How posting works
--   Every source record (invoice, receipt, adjustment, payslip, practice expense, stock valuation) has TARGET
--   balances per account. finance_sync_source() compares them with what is already POSTED for that record and posts
--   only the difference as a new, balanced journal entry. Posting is idempotent; edits post as adjustments;
--   cancellations, reversals and deletions post reversals; posted entries are never changed. A ledger problem is
--   written to finance_posting_errors and never stops the billing, receipt, payroll or expense save.
--
-- How to apply: rehearse the part between BEGIN; and ROLLBACK; (an administrator reads the trial balance and it
--   balances per practice; a doctor and a receptionist read 0 journal lines; another practice reads 0; anon is
--   refused; a receptionist cannot post a manual journal; a new receipt and its reversal post and net to zero), then
--   apply it as one migration (finance_ledger_2026_10_13).
-- Undo: DROP TRIGGER invoices_enhanced_post_ledger ON invoices_enhanced; DROP TRIGGER receipts_post_ledger ON receipts;
--   DROP TRIGGER invoice_adjustments_post_ledger ON invoice_adjustments; DROP TRIGGER payslips_post_ledger ON payslips;
--   DROP TRIGGER practice_expenses_post_ledger ON practice_expenses; then DROP the views trial_balance, the tables
--   journal_lines, journal_entries, finance_posting_errors, chart_of_accounts, and the functions created below.
--
-- Money is numeric(14,2) in NAD. Business dates are local (Africa/Windhoek) calendar dates.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before, and access helpers (SECURITY DEFINER so policies do not recurse through users' own RLS)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.receipts') IS NULL OR to_regclass('public.invoice_adjustments') IS NULL
     OR to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
  IF to_regclass('public.chart_of_accounts') IS NOT NULL OR to_regclass('public.journal_entries') IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: the ledger tables already exist';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finance_practice_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.practice_id FROM public.users u
   WHERE u.id = auth.uid() AND u.practice_id IS NOT NULL AND u.role = 'admin' AND COALESCE(u.is_active, true)
$$;
COMMENT ON FUNCTION public.finance_practice_ids() IS
  'Practices whose books the signed-in user may read: the practices they administer (owner, 13 Oct 2026).';

CREATE OR REPLACE FUNCTION public.finance_can_manage(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
  )
$$;
COMMENT ON FUNCTION public.finance_can_manage(uuid) IS
  'True for the practice''s administrators: they keep the chart of accounts, post manual journals and stock valuations.';

-- ---------------------------------------------------------------------------------------------
-- 1. Chart of accounts
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.chart_of_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  code           text NOT NULL,
  name           text NOT NULL,
  account_type   text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  system_key     text,
  parent_id      uuid REFERENCES public.chart_of_accounts(id),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chart_of_accounts_code_unique UNIQUE (practice_id, code),
  CONSTRAINT chart_of_accounts_system_key_unique UNIQUE (practice_id, system_key)
);
COMMENT ON TABLE public.chart_of_accounts IS
  'The accounts each practice keeps books in. Seeded with a standard medical-practice chart; the accountant can rename, renumber or add accounts.';
COMMENT ON COLUMN public.chart_of_accounts.system_key IS
  'Stable key used by automatic posting (e.g. ar_medical_aid, revenue_services). Do not delete these; rename or renumber instead.';
COMMENT ON COLUMN public.chart_of_accounts.normal_balance IS
  'debit for assets and expenses, credit for liabilities, equity and income. Contra accounts (credit notes, accumulated depreciation) take the opposite side.';

CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_practice_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.chart_of_accounts (practice_id, code, name, account_type, normal_balance, system_key)
  VALUES
    (p_practice_id, '1000', 'Bank', 'asset', 'debit', 'bank'),
    (p_practice_id, '1010', 'Cash on hand', 'asset', 'debit', 'cash'),
    (p_practice_id, '1100', 'Receivables - medical aids', 'asset', 'debit', 'ar_medical_aid'),
    (p_practice_id, '1110', 'Receivables - patients', 'asset', 'debit', 'ar_patient'),
    (p_practice_id, '1200', 'Stock on hand (consumables and medicines)', 'asset', 'debit', 'inventory'),
    (p_practice_id, '1500', 'Equipment at cost', 'asset', 'debit', 'equipment'),
    (p_practice_id, '1510', 'Accumulated depreciation - equipment', 'asset', 'credit', 'accumulated_depreciation'),
    (p_practice_id, '2000', 'Payables - suppliers', 'liability', 'credit', 'ap_suppliers'),
    (p_practice_id, '2100', 'Salaries payable', 'liability', 'credit', 'salaries_payable'),
    (p_practice_id, '2110', 'PAYE and payroll deductions payable', 'liability', 'credit', 'payroll_deductions'),
    (p_practice_id, '2200', 'VAT payable', 'liability', 'credit', 'vat'),
    (p_practice_id, '3000', 'Owner''s capital', 'equity', 'credit', 'capital'),
    (p_practice_id, '3100', 'Retained earnings', 'equity', 'credit', 'retained_earnings'),
    (p_practice_id, '3900', 'Opening balances', 'equity', 'credit', 'opening_balances'),
    (p_practice_id, '4000', 'Medical services revenue', 'income', 'credit', 'revenue_services'),
    (p_practice_id, '4900', 'Credit notes and discounts', 'income', 'debit', 'revenue_credits'),
    (p_practice_id, '5000', 'Salaries and wages', 'expense', 'debit', 'payroll_expense'),
    (p_practice_id, '5100', 'Rent and lease', 'expense', 'debit', 'expense_rent'),
    (p_practice_id, '5110', 'Utilities', 'expense', 'debit', 'expense_utilities'),
    (p_practice_id, '5120', 'Insurance', 'expense', 'debit', 'expense_insurance'),
    (p_practice_id, '5130', 'Medical supplies used', 'expense', 'debit', 'expense_supplies'),
    (p_practice_id, '5140', 'Equipment (expensed)', 'expense', 'debit', 'expense_equipment'),
    (p_practice_id, '5150', 'Other staff costs', 'expense', 'debit', 'expense_staff'),
    (p_practice_id, '5160', 'Professional services', 'expense', 'debit', 'expense_professional_services'),
    (p_practice_id, '5170', 'Marketing', 'expense', 'debit', 'expense_marketing'),
    (p_practice_id, '5180', 'Technology and IT', 'expense', 'debit', 'expense_technology'),
    (p_practice_id, '5190', 'Regulatory and compliance', 'expense', 'debit', 'expense_regulatory'),
    (p_practice_id, '5200', 'Maintenance', 'expense', 'debit', 'expense_maintenance'),
    (p_practice_id, '5290', 'Other expenses', 'expense', 'debit', 'expense_other'),
    (p_practice_id, '5900', 'Expired and damaged stock written off', 'expense', 'debit', 'stock_written_off'),
    (p_practice_id, '5950', 'Depreciation', 'expense', 'debit', 'depreciation'),
    (p_practice_id, '5960', 'Bad debts written off', 'expense', 'debit', 'bad_debts')
  ON CONFLICT DO NOTHING
$$;
COMMENT ON FUNCTION public.seed_default_chart_of_accounts(uuid) IS
  'Creates the standard accounts for a practice. Expense accounts mirror practice_expenses.expense_type (expense_<type>).';

-- ---------------------------------------------------------------------------------------------
-- 2. Journal entries and lines
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.journal_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  entry_number bigint GENERATED ALWAYS AS IDENTITY,
  entry_date   date NOT NULL,
  description  text NOT NULL,
  source_type  text NOT NULL CHECK (source_type IN (
                 'invoice', 'receipt', 'adjustment', 'payslip', 'practice_expense',
                 'inventory', 'manual', 'opening_balance')),
  source_id    uuid,
  source_event text NOT NULL CHECK (source_event IN ('created', 'changed', 'deleted', 'manual')),
  created_by   uuid, -- auth user id; no foreign key so staff records can change without touching history
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_practice_date_idx ON public.journal_entries (practice_id, entry_date);
CREATE INDEX journal_entries_source_idx ON public.journal_entries (source_type, source_id);
COMMENT ON TABLE public.journal_entries IS
  'One accounting event. Automatic entries point at the record that caused them (source_type, source_id); later edits to that record post new "changed" entries for the difference, so history is never rewritten.';

CREATE TABLE public.journal_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id     uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  practice_id          uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  account_id           uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit                numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit               numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  funder               text CHECK (funder IN ('medical_aid', 'patient')),
  -- Plain reference (no foreign key): lines are append-only, so ON DELETE SET NULL could never run
  -- and a foreign key would block deleting a patient. Patients with financial history should be archived.
  patient_id           uuid,
  memo                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_one_side CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX journal_lines_entry_idx ON public.journal_lines (journal_entry_id);
CREATE INDEX journal_lines_account_idx ON public.journal_lines (practice_id, account_id);
COMMENT ON TABLE public.journal_lines IS
  'Debit or credit lines of a journal entry. funder and patient_id give the receivables sub-ledger (who owes what) without a separate table.';

-- Every entry must balance (checked at commit, so all lines of an entry can be inserted first)
CREATE OR REPLACE FUNCTION public.journal_entry_must_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_entry  uuid;
  v_debit  numeric(14,2);
  v_credit numeric(14,2);
  v_lines  integer;
BEGIN
  IF TG_OP = 'DELETE' THEN v_entry := OLD.journal_entry_id; ELSE v_entry := NEW.journal_entry_id; END IF;
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
    INTO v_debit, v_credit, v_lines
    FROM public.journal_lines WHERE journal_entry_id = v_entry;
  IF v_lines > 0 AND (v_lines < 2 OR v_debit <> v_credit) THEN
    RAISE EXCEPTION 'Journal entry % does not balance (debits %, credits %)', v_entry, v_debit, v_credit;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER journal_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.journal_entry_must_balance();

-- A line, its entry and its account must belong to the same practice
CREATE OR REPLACE FUNCTION public.journal_line_same_practice()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = NEW.journal_entry_id AND e.practice_id = NEW.practice_id)
     OR NOT EXISTS (SELECT 1 FROM public.chart_of_accounts a WHERE a.id = NEW.account_id AND a.practice_id = NEW.practice_id) THEN
    RAISE EXCEPTION 'Journal line, entry and account must belong to the same practice';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER journal_lines_same_practice
  BEFORE INSERT OR UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.journal_line_same_practice();

-- Posted journals are append-only: corrections are new (reversing or adjusting) entries
CREATE OR REPLACE FUNCTION public.journal_is_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Posted journals cannot be changed or deleted; post a correcting entry instead';
END $$;

CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.journal_is_append_only();
CREATE TRIGGER journal_lines_append_only BEFORE UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.journal_is_append_only();

-- ---------------------------------------------------------------------------------------------
-- 3. (Removed 13 Oct 2026) Receipts, allocations and credit notes live in receipts, receipt_allocations and
--    invoice_adjustments (proposals/2026-10-07-receipts-and-allocations.sql); section 4 posts from them.
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 4. Posting
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.finance_posting_errors (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id   uuid REFERENCES public.practices(id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  error_message text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
COMMENT ON TABLE public.finance_posting_errors IS
  'Postings that failed. The billing, receipt, payroll or expense change still saves; finance_backfill re-posts once the cause is fixed.';

CREATE OR REPLACE FUNCTION public.finance_account(p_practice_id uuid, p_system_key text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.chart_of_accounts
   WHERE practice_id = p_practice_id AND system_key = p_system_key AND is_active;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Account "%" is not set up for practice %', p_system_key, p_practice_id;
  END IF;
  RETURN v_id;
END $$;

-- The one posting routine. p_targets: [{"account": system_key | "account_id": uuid, "funder": text|null,
-- "balance": signed amount (debit positive)}]. Posts target minus already-posted, per account and funder.
CREATE OR REPLACE FUNCTION public.finance_sync_source(
  p_practice_id uuid,
  p_source_type text,
  p_source_id   uuid,
  p_entry_date  date,
  p_description text,
  p_targets     jsonb,
  p_patient_id  uuid DEFAULT NULL,
  p_change_date date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_prior boolean;
  v_deltas    jsonb;
  v_entry     uuid;
BEGIN
  -- Serialise postings for one record so two concurrent triggers cannot post the same change twice
  PERFORM pg_advisory_xact_lock(hashtext(p_source_type || ':' || p_source_id::text));

  -- A practice's books are opened the first time something posts for it
  IF NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE practice_id = p_practice_id) THEN
    PERFORM public.seed_default_chart_of_accounts(p_practice_id);
  END IF;

  v_has_prior := EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type = p_source_type AND source_id = p_source_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('account_id', account_id, 'funder', funder, 'delta', delta)), '[]'::jsonb)
    INTO v_deltas
    FROM (
      SELECT account_id, funder, SUM(amount) AS delta
      FROM (
        SELECT COALESCE((t->>'account_id')::uuid, public.finance_account(p_practice_id, t->>'account')) AS account_id,
               NULLIF(t->>'funder', '') AS funder,
               round((t->>'balance')::numeric, 2) AS amount
        FROM jsonb_array_elements(p_targets) AS t
        UNION ALL
        SELECT l.account_id, l.funder, -(l.debit - l.credit)
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.journal_entry_id
        WHERE e.source_type = p_source_type AND e.source_id = p_source_id
      ) movements
      GROUP BY account_id, funder
      HAVING SUM(amount) <> 0
    ) deltas;

  IF jsonb_array_length(v_deltas) = 0 THEN
    RETURN NULL; -- already in step: nothing to post
  END IF;

  INSERT INTO public.journal_entries (practice_id, entry_date, description, source_type, source_id, source_event, created_by)
  VALUES (
    p_practice_id,
    -- First posting carries the business date; later changes are dated when they happen,
    -- so closed months are never altered retrospectively
    CASE WHEN v_has_prior THEN COALESCE(p_change_date, public.ar_today()) ELSE p_entry_date END,
    p_description,
    p_source_type,
    p_source_id,
    CASE WHEN NOT v_has_prior THEN 'created' WHEN jsonb_array_length(p_targets) = 0 THEN 'deleted' ELSE 'changed' END,
    auth.uid()
  )
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (journal_entry_id, practice_id, account_id, debit, credit, funder, patient_id)
  SELECT v_entry, p_practice_id, (d->>'account_id')::uuid,
         GREATEST((d->>'delta')::numeric, 0), GREATEST(-(d->>'delta')::numeric, 0),
         d->>'funder', p_patient_id
  FROM jsonb_array_elements(v_deltas) AS d;

  RETURN v_entry;
END $$;
COMMENT ON FUNCTION public.finance_sync_source(uuid, text, uuid, date, text, jsonb, uuid, date) IS
  'Brings the ledger in line with one source record by posting only the difference between its target balances and what is already posted. Safe to run any number of times.';

CREATE OR REPLACE FUNCTION public.finance_reverse_source(p_source_type text, p_source_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_practice uuid;
BEGIN
  SELECT practice_id INTO v_practice FROM public.journal_entries
   WHERE source_type = p_source_type AND source_id = p_source_id LIMIT 1;
  IF v_practice IS NULL THEN RETURN NULL; END IF;
  RETURN public.finance_sync_source(v_practice, p_source_type, p_source_id, public.ar_today(),
    initcap(replace(p_source_type, '_', ' ')) || ' deleted', '[]'::jsonb);
END $$;

-- Invoice: receivables (split by funder) against revenue. Cancelled = void (all zero). Opening balances brought over
-- from Eminance (OB-...) sit against "Opening balances", not this year's revenue.
CREATE OR REPLACE FUNCTION public.post_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v       public.invoices_enhanced%ROWTYPE;
  v_void  boolean;
  v_total numeric(14,2);
  v_ma    numeric(14,2);
BEGIN
  SELECT * INTO v FROM public.invoices_enhanced WHERE id = p_invoice_id;
  IF NOT FOUND OR v.practice_id IS NULL THEN RETURN NULL; END IF;
  v_void  := lower(btrim(COALESCE(v.payment_status, ''))) IN ('cancelled', 'canceled', 'void', 'voided');
  v_total := CASE WHEN v_void THEN 0 ELSE GREATEST(round(COALESCE(v.total, 0), 2), 0) END;
  v_ma    := LEAST(GREATEST(round(COALESCE(v.medical_aid_total, 0), 2), 0), v_total);
  RETURN public.finance_sync_source(
    v.practice_id, 'invoice', v.id, COALESCE(v.issue_date, public.ar_today()),
    'Invoice ' || COALESCE(v.invoice_number, v.id::text) || CASE WHEN v_void THEN ' cancelled' ELSE '' END,
    jsonb_build_array(
      jsonb_build_object('account', 'ar_medical_aid', 'funder', 'medical_aid', 'balance', v_ma),
      jsonb_build_object('account', 'ar_patient', 'funder', 'patient', 'balance', v_total - v_ma),
      jsonb_build_object('account', CASE WHEN COALESCE(v.invoice_number, '') LIKE 'OB-%' THEN 'opening_balances' ELSE 'revenue_services' END,
                         'balance', -v_total)
    ),
    v.patient_id
  );
END $$;

-- Receipt: bank (or cash) against the payer's receivable. A reversed receipt nets to zero, dated when reversed.
-- Payers other than a medical aid (the patient, a company paying the patient's portion) reduce patients' receivables.
CREATE OR REPLACE FUNCTION public.post_receipt(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        public.receipts%ROWTYPE;
  v_amount numeric(14,2);
  v_funder text;
BEGIN
  SELECT * INTO r FROM public.receipts WHERE id = p_receipt_id;
  IF NOT FOUND OR r.practice_id IS NULL THEN RETURN NULL; END IF;
  v_amount := CASE WHEN r.reversed_at IS NULL THEN round(r.amount, 2) ELSE 0 END;
  v_funder := CASE WHEN r.payer_type = 'medical_aid' THEN 'medical_aid' ELSE 'patient' END;
  RETURN public.finance_sync_source(
    r.practice_id, 'receipt', r.id, r.received_on,
    'Receipt ' || COALESCE(r.receipt_number, r.id::text) || CASE WHEN r.reversed_at IS NOT NULL THEN ' reversed' ELSE '' END,
    jsonb_build_array(
      jsonb_build_object('account', CASE WHEN r.method = 'cash' THEN 'cash' ELSE 'bank' END, 'balance', v_amount),
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', -v_amount)
    ),
    r.patient_id,
    CASE WHEN r.reversed_at IS NOT NULL THEN (r.reversed_at AT TIME ZONE 'Africa/Windhoek')::date END
  );
END $$;

-- Adjustment (invoice_adjustments): credit notes and discounts reduce revenue; write-offs are bad debts; journals
-- move the portion's receivable against revenue (signed); a shortfall moves the medical aid's portion to the
-- patient; a refund pays money back out of bank or cash. A reversed adjustment nets to zero, dated when reversed.
CREATE OR REPLACE FUNCTION public.post_adjustment(p_adjustment_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a         public.invoice_adjustments%ROWTYPE;
  v_amount  numeric(14,2);
  v_funder  text;
  v_patient uuid;
  v_targets jsonb;
BEGIN
  SELECT * INTO a FROM public.invoice_adjustments WHERE id = p_adjustment_id;
  IF NOT FOUND OR a.practice_id IS NULL THEN RETURN NULL; END IF;
  v_amount := CASE WHEN a.reversed_at IS NULL THEN round(a.amount, 2) ELSE 0 END;
  v_patient := COALESCE(a.patient_id, (SELECT i.patient_id FROM public.invoices_enhanced i WHERE i.id = a.invoice_id),
                        (SELECT rc.patient_id FROM public.receipts rc WHERE rc.id = a.receipt_id));
  IF a.kind = 'refund' THEN
    v_funder := COALESCE((SELECT CASE WHEN rc.payer_type = 'medical_aid' THEN 'medical_aid' ELSE 'patient' END
                            FROM public.receipts rc WHERE rc.id = a.receipt_id), 'patient');
  ELSE
    v_funder := COALESCE(a.portion, 'patient');
  END IF;

  v_targets := CASE a.kind
    WHEN 'credit_note' THEN jsonb_build_array(
      jsonb_build_object('account', 'revenue_credits', 'balance', v_amount),
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', -v_amount))
    WHEN 'discount' THEN jsonb_build_array(
      jsonb_build_object('account', 'revenue_credits', 'balance', v_amount),
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', -v_amount))
    WHEN 'write_off' THEN jsonb_build_array(
      jsonb_build_object('account', 'bad_debts', 'balance', v_amount),
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', -v_amount))
    WHEN 'journal' THEN jsonb_build_array(
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', v_amount),
      jsonb_build_object('account', 'revenue_services', 'balance', -v_amount))
    WHEN 'shortfall_transfer' THEN jsonb_build_array(
      jsonb_build_object('account', 'ar_patient', 'funder', 'patient', 'balance', v_amount),
      jsonb_build_object('account', 'ar_medical_aid', 'funder', 'medical_aid', 'balance', -v_amount))
    WHEN 'refund' THEN jsonb_build_array(
      jsonb_build_object('account', 'ar_' || v_funder, 'funder', v_funder, 'balance', v_amount),
      jsonb_build_object('account', CASE WHEN a.method = 'cash' THEN 'cash' ELSE 'bank' END, 'balance', -v_amount))
    ELSE '[]'::jsonb
  END;
  IF jsonb_array_length(v_targets) = 0 THEN RETURN NULL; END IF;

  RETURN public.finance_sync_source(
    a.practice_id, 'adjustment', a.id, COALESCE(a.effective_on, public.ar_today()),
    initcap(replace(a.kind, '_', ' ')) || ' ' || COALESCE(a.adjustment_number, a.id::text)
      || CASE WHEN a.reversed_at IS NOT NULL THEN ' reversed' ELSE '' END,
    v_targets,
    v_patient,
    CASE WHEN a.reversed_at IS NOT NULL THEN (a.reversed_at AT TIME ZONE 'Africa/Windhoek')::date END
  );
END $$;

-- Payslip: gross pay expense; deductions and net pay owed until paid, then net pay from the bank.
CREATE OR REPLACE FUNCTION public.post_payslip(p_payslip_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p           record;
  v_cancelled boolean;
  v_paid      boolean;
  v_gross     numeric(14,2);
  v_deduct    numeric(14,2);
  v_net_owed  numeric(14,2);
BEGIN
  SELECT s.*, u.practice_id AS owner_practice_id, u.full_name AS employee_name
    INTO p
    FROM public.payslips s JOIN public.users u ON u.id = s.user_id
   WHERE s.id = p_payslip_id;
  IF NOT FOUND OR p.owner_practice_id IS NULL THEN RETURN NULL; END IF;
  v_cancelled := lower(btrim(COALESCE(p.status, ''))) IN ('cancelled', 'canceled', 'void', 'voided');
  v_paid      := NOT v_cancelled AND lower(btrim(COALESCE(p.status, ''))) = 'paid';
  v_gross     := CASE WHEN v_cancelled THEN 0 ELSE round(COALESCE(p.gross_earnings, 0), 2) END;
  v_deduct    := CASE WHEN v_cancelled THEN 0 ELSE round(COALESCE(p.total_deductions, 0), 2) END;
  v_net_owed  := v_gross - v_deduct;
  RETURN public.finance_sync_source(
    p.owner_practice_id, 'payslip', p.id, COALESCE(p.pay_period_end, p.payment_date, public.ar_today()),
    'Payslip ' || COALESCE(p.employee_name, '') || ' ' || COALESCE(to_char(p.pay_period_start, 'Mon YYYY'), ''),
    jsonb_build_array(
      jsonb_build_object('account', 'payroll_expense', 'balance', v_gross),
      jsonb_build_object('account', 'payroll_deductions', 'balance', -v_deduct),
      jsonb_build_object('account', 'salaries_payable', 'balance', CASE WHEN v_paid THEN 0 ELSE -v_net_owed END),
      jsonb_build_object('account', 'bank', 'balance', CASE WHEN v_paid THEN -v_net_owed ELSE 0 END)
    ),
    NULL,
    CASE WHEN v_paid THEN p.payment_date END
  );
END $$;

-- Practice expense: expense by type; owed to the supplier until paid, then out of bank or cash.
CREATE OR REPLACE FUNCTION public.post_practice_expense(p_expense_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e           public.practice_expenses%ROWTYPE;
  v_cancelled boolean;
  v_paid      boolean;
  v_amount    numeric(14,2);
  v_expense   text;
  v_pay_from  text;
BEGIN
  SELECT * INTO e FROM public.practice_expenses WHERE id = p_expense_id;
  IF NOT FOUND OR e.practice_id IS NULL THEN RETURN NULL; END IF;
  v_cancelled := lower(btrim(COALESCE(e.status, ''))) IN ('cancelled', 'canceled', 'void', 'voided');
  v_paid      := NOT v_cancelled AND lower(btrim(COALESCE(e.status, ''))) = 'paid';
  v_amount    := CASE WHEN v_cancelled THEN 0 ELSE round(COALESCE(e.amount, 0), 2) END;
  v_expense   := 'expense_' || COALESCE(e.expense_type, 'other');
  IF NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE practice_id = e.practice_id AND system_key = v_expense) THEN
    v_expense := 'expense_other';
  END IF;
  v_pay_from  := CASE WHEN lower(COALESCE(e.payment_method, '')) = 'cash' THEN 'cash' ELSE 'bank' END;
  RETURN public.finance_sync_source(
    e.practice_id, 'practice_expense', e.id, COALESCE(e.expense_date, public.ar_today()), 'Expense: ' || COALESCE(e.name, ''),
    jsonb_build_array(
      jsonb_build_object('account', v_expense, 'balance', v_amount),
      jsonb_build_object('account', 'ap_suppliers', 'balance', CASE WHEN v_paid THEN 0 ELSE -v_amount END),
      jsonb_build_object('account', v_pay_from, 'balance', CASE WHEN v_paid THEN -v_amount ELSE 0 END)
    ),
    NULL,
    CASE WHEN v_paid THEN e.paid_date END
  );
END $$;

-- Stock take: stock and equipment at cost against what was expensed when bought. The internal routine has no caller
-- check (finance_backfill uses it); post_inventory_valuation is the one administrators call.
CREATE OR REPLACE FUNCTION public.finance_inventory_valuation_internal(p_practice_id uuid, p_as_at date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stock     numeric(14,2);
  v_equipment numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(value) FILTER (WHERE COALESCE(category, '') <> 'equipment'), 0),
         COALESCE(SUM(value) FILTER (WHERE category = 'equipment'), 0)
    INTO v_stock, v_equipment
    FROM (
      SELECT category,
             CASE WHEN unit_cost > 0 THEN round(GREATEST(quantity, 0) * unit_cost, 2)
                  ELSE GREATEST(COALESCE(total_value, 0), 0) END AS value
      FROM public.practice_inventory
      WHERE practice_id = p_practice_id
    ) items;
  RETURN public.finance_sync_source(
    p_practice_id, 'inventory', p_practice_id, p_as_at, 'Stock and equipment valuation at ' || to_char(p_as_at, 'DD Mon YYYY'),
    jsonb_build_array(
      jsonb_build_object('account', 'inventory', 'balance', v_stock),
      jsonb_build_object('account', 'expense_supplies', 'balance', -v_stock),
      jsonb_build_object('account', 'equipment', 'balance', v_equipment),
      jsonb_build_object('account', 'expense_equipment', 'balance', -v_equipment)
    ),
    NULL,
    p_as_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.post_inventory_valuation(p_practice_id uuid, p_as_at date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.finance_can_manage(p_practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator can post a stock valuation' USING ERRCODE = '42501';
  END IF;
  RETURN public.finance_inventory_valuation_internal(p_practice_id, p_as_at);
END $$;

-- One trigger function for every source table. Ledger problems are logged, never raised, so saving an invoice,
-- receipt, adjustment, payslip or expense can never fail because of the ledger.
CREATE OR REPLACE FUNCTION public.finance_on_source_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source text := TG_ARGV[0];
  v_row    jsonb;
  v_id     uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); ELSE v_row := to_jsonb(NEW); END IF;
  v_id := (v_row->>'id')::uuid;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.finance_reverse_source(v_source, v_id);
    ELSIF v_source = 'invoice' THEN
      PERFORM public.post_invoice(v_id);
    ELSIF v_source = 'receipt' THEN
      PERFORM public.post_receipt(v_id);
    ELSIF v_source = 'adjustment' THEN
      PERFORM public.post_adjustment(v_id);
    ELSIF v_source = 'payslip' THEN
      PERFORM public.post_payslip(v_id);
    ELSIF v_source = 'practice_expense' THEN
      PERFORM public.post_practice_expense(v_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.finance_posting_errors (practice_id, source_type, source_id, error_message)
    VALUES ((v_row->>'practice_id')::uuid, v_source, v_id, SQLERRM);
  END;
  RETURN NULL;
END $$;

CREATE TRIGGER invoices_enhanced_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('invoice');
CREATE TRIGGER receipts_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('receipt');
CREATE TRIGGER invoice_adjustments_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('adjustment');
CREATE TRIGGER payslips_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('payslip');
CREATE TRIGGER practice_expenses_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.practice_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('practice_expense');

-- Manual journal (accountant adjustments, opening balances). Lines: [{"account_id", "debit", "credit", "memo"}]
CREATE OR REPLACE FUNCTION public.post_manual_journal(p_practice_id uuid, p_entry_date date, p_description text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry uuid;
BEGIN
  IF NOT public.finance_can_manage(p_practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator can post a manual journal' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_description, '')), '') IS NULL OR p_entry_date IS NULL
     OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A journal needs a date, a description and at least two lines';
  END IF;
  INSERT INTO public.journal_entries (practice_id, entry_date, description, source_type, source_event, created_by)
  VALUES (p_practice_id, p_entry_date, p_description, 'manual', 'manual', auth.uid())
  RETURNING id INTO v_entry;
  INSERT INTO public.journal_lines (journal_entry_id, practice_id, account_id, debit, credit, memo)
  SELECT v_entry, p_practice_id, (l->>'account_id')::uuid,
         round(COALESCE((l->>'debit')::numeric, 0), 2), round(COALESCE((l->>'credit')::numeric, 0), 2), l->>'memo'
  FROM jsonb_array_elements(p_lines) AS l;
  RETURN v_entry; -- the deferred balance check rejects the whole journal at commit if it does not balance
END $$;

-- Opens a practice's books and posts every existing record once. Safe to re-run: postings only add differences.
CREATE OR REPLACE FUNCTION public.finance_backfill(p_practice_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r       record;
  v_count integer := 0;
BEGIN
  PERFORM public.seed_default_chart_of_accounts(p_practice_id);
  FOR r IN SELECT id FROM public.invoices_enhanced WHERE practice_id = p_practice_id LOOP
    PERFORM public.post_invoice(r.id);
    v_count := v_count + 1;
  END LOOP;
  FOR r IN SELECT id FROM public.receipts WHERE practice_id = p_practice_id LOOP
    PERFORM public.post_receipt(r.id);
    v_count := v_count + 1;
  END LOOP;
  FOR r IN SELECT id FROM public.invoice_adjustments WHERE practice_id = p_practice_id LOOP
    PERFORM public.post_adjustment(r.id);
    v_count := v_count + 1;
  END LOOP;
  FOR r IN SELECT s.id FROM public.payslips s JOIN public.users u ON u.id = s.user_id WHERE u.practice_id = p_practice_id LOOP
    PERFORM public.post_payslip(r.id);
    v_count := v_count + 1;
  END LOOP;
  FOR r IN SELECT id FROM public.practice_expenses WHERE practice_id = p_practice_id LOOP
    PERFORM public.post_practice_expense(r.id);
    v_count := v_count + 1;
  END LOOP;
  PERFORM public.finance_inventory_valuation_internal(p_practice_id, public.ar_today());
  RETURN v_count;
END $$;
COMMENT ON FUNCTION public.finance_backfill(uuid) IS
  'Opens a practice''s books and posts its history (service role / migrations only). Safe to re-run: postings only add differences.';

-- ---------------------------------------------------------------------------------------------
-- 5. Reporting (security_invoker: the caller's RLS applies, so only the practice's administrators see figures)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.trial_balance WITH (security_invoker = true) AS
SELECT a.practice_id,
       a.id AS account_id,
       a.code,
       a.name,
       a.account_type,
       a.normal_balance,
       COALESCE(SUM(l.debit), 0)  AS total_debit,
       COALESCE(SUM(l.credit), 0) AS total_credit,
       COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS net_debit
FROM public.chart_of_accounts a
LEFT JOIN public.journal_lines l ON l.account_id = a.id
GROUP BY a.practice_id, a.id, a.code, a.name, a.account_type, a.normal_balance;
COMMENT ON VIEW public.trial_balance IS
  'All-time balance per account; total debits equal total credits per practice by construction.';

CREATE OR REPLACE FUNCTION public.trial_balance_as_at(p_practice_id uuid, p_as_at date)
RETURNS TABLE (account_id uuid, code text, name text, account_type text, total_debit numeric, total_credit numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.id, a.code, a.name, a.account_type,
         COALESCE(SUM(l.debit) FILTER (WHERE e.entry_date <= p_as_at), 0),
         COALESCE(SUM(l.credit) FILTER (WHERE e.entry_date <= p_as_at), 0)
  FROM public.chart_of_accounts a
  LEFT JOIN public.journal_lines l ON l.account_id = a.id
  LEFT JOIN public.journal_entries e ON e.id = l.journal_entry_id
  WHERE a.practice_id = p_practice_id
  GROUP BY a.id, a.code, a.name, a.account_type
  ORDER BY a.code
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Access: the practice's administrators read the books; journals are written only by the posting functions
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.chart_of_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_posting_errors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chart_of_accounts, public.journal_entries, public.journal_lines, public.finance_posting_errors,
              public.trial_balance FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chart_of_accounts TO authenticated;
GRANT SELECT ON public.journal_entries, public.journal_lines, public.finance_posting_errors, public.trial_balance TO authenticated;
GRANT ALL ON public.chart_of_accounts, public.journal_entries, public.journal_lines, public.finance_posting_errors TO service_role;
GRANT SELECT ON public.trial_balance TO service_role;

CREATE POLICY "Practice administrators read accounts" ON public.chart_of_accounts
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice administrators add accounts" ON public.chart_of_accounts
  FOR INSERT TO authenticated WITH CHECK (public.finance_can_manage(practice_id));
CREATE POLICY "Practice administrators edit accounts" ON public.chart_of_accounts
  FOR UPDATE TO authenticated USING (public.finance_can_manage(practice_id)) WITH CHECK (public.finance_can_manage(practice_id));
CREATE POLICY "Practice administrators read journal entries" ON public.journal_entries
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice administrators read journal lines" ON public.journal_lines
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice administrators read posting errors" ON public.finance_posting_errors
  FOR SELECT TO authenticated USING (practice_id IS NOT NULL AND public.finance_can_manage(practice_id));

DO $$
DECLARE v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['chart_of_accounts', 'journal_entries', 'journal_lines', 'finance_posting_errors'] LOOP
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
                        USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- Functions: nobody but signed-in users gets the few that the app may call; the posting routines are internal
REVOKE ALL ON FUNCTION
  public.finance_practice_ids(), public.finance_can_manage(uuid), public.seed_default_chart_of_accounts(uuid),
  public.journal_entry_must_balance(), public.journal_line_same_practice(), public.journal_is_append_only(),
  public.finance_account(uuid, text), public.finance_sync_source(uuid, text, uuid, date, text, jsonb, uuid, date),
  public.finance_reverse_source(text, uuid), public.post_invoice(uuid), public.post_receipt(uuid),
  public.post_adjustment(uuid), public.post_payslip(uuid), public.post_practice_expense(uuid),
  public.finance_inventory_valuation_internal(uuid, date), public.post_inventory_valuation(uuid, date),
  public.finance_on_source_change(), public.post_manual_journal(uuid, date, text, jsonb),
  public.finance_backfill(uuid), public.trial_balance_as_at(uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.finance_practice_ids(), public.finance_can_manage(uuid), public.post_inventory_valuation(uuid, date),
  public.post_manual_journal(uuid, date, text, jsonb), public.trial_balance_as_at(uuid, date)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Open the books of every practice that has staff, and post their history once
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE v_practice uuid;
BEGIN
  FOR v_practice IN SELECT DISTINCT u.practice_id FROM public.users u WHERE u.practice_id IS NOT NULL LOOP
    PERFORM public.finance_backfill(v_practice);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE v_off text;
BEGIN
  SELECT string_agg(practice_id::text, ', ') INTO v_off FROM (
    SELECT l.practice_id FROM public.journal_lines l GROUP BY l.practice_id HAVING SUM(l.debit) <> SUM(l.credit)) x;
  IF v_off IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the books do not balance for %', v_off;
  END IF;
  IF has_table_privilege('anon', 'public.journal_lines', 'SELECT') OR has_table_privilege('anon', 'public.chart_of_accounts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.journal_lines', 'INSERT')
     OR has_table_privilege('authenticated', 'public.journal_entries', 'INSERT') THEN
    RAISE EXCEPTION 'Check failed: the journals can be written directly or read by anon';
  END IF;
  IF has_function_privilege('anon', 'public.finance_backfill(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finance_backfill(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finance_sync_source(uuid,text,uuid,date,text,jsonb,uuid,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.post_manual_journal(uuid,date,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: an internal posting function can be called from the app';
  END IF;
END $$;

ROLLBACK;
