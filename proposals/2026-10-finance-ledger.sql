-- =============================================================================================
-- PROPOSAL, NOT APPLIED: double-entry general ledger for HPMS Finance
-- File:   proposals/2026-10-finance-ledger.sql            Drafted: 2026-10-06
-- Plain-language companion: proposals/2026-10-finance-ledger.md
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind. To turn it into a migration: review,
-- test on a Supabase branch, then change the final ROLLBACK to COMMIT.
--
-- Tables
--   chart_of_accounts      per-practice accounts: assets, liabilities, equity, income, expenses
--   journal_entries        one business event (invoice raised, payment received, payslip, ...)
--   journal_lines          the debits and credits of an entry; every entry must balance
--   payment_receipts       money received (cash, card, EFT, medical aid remittance)
--   payment_allocations    which invoices a receipt pays (part-payments; one remittance, many invoices)
--   credit_notes           reductions of an invoice, instead of editing or cancelling it
--   finance_posting_errors postings that failed; billing and payroll are never blocked by the ledger
--
-- How posting works
--   Every source record (invoice, receipt, credit note, payslip, practice expense, stock valuation)
--   has TARGET balances per account (e.g. invoice: receivables +total, revenue -total). The single
--   routine finance_sync_source() compares them with what is already POSTED for that record and posts
--   only the difference as a new, balanced journal entry. So posting is idempotent, edits post as
--   adjustments, cancellations and deletions post reversals, and posted entries are never changed.
--   The rules match the Finance page (src/services/ledgerService.ts): a cancelled invoice is void;
--   the medical aid owes its recorded portion capped at the total and the patient owes the rest.
--
-- Money is numeric(14,2) in NAD. Business dates are local (Africa/Windhoek) calendar dates.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Access helpers. Same rule as existing policies: a user's practice comes from public.users.
--    SECURITY DEFINER so policies on finance tables do not recurse through users' own RLS.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_practice_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.practice_id FROM public.users u WHERE u.id = auth.uid() AND u.practice_id IS NOT NULL
$$;
COMMENT ON FUNCTION public.finance_practice_ids() IS
  'Practices whose finance data the signed-in user may read.';

CREATE OR REPLACE FUNCTION public.finance_can_manage(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND u.role IN ('admin', 'doctor')
  )
$$;
COMMENT ON FUNCTION public.finance_can_manage(uuid) IS
  'True for practice admins and doctors: they may record receipts, credit notes and manual journals.';

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
    (p_practice_id, '5950', 'Depreciation', 'expense', 'debit', 'depreciation')
  ON CONFLICT (practice_id, code) DO NOTHING
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
                 'invoice', 'payment_receipt', 'credit_note', 'payslip', 'practice_expense',
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
RETURNS trigger LANGUAGE plpgsql AS $$
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
RETURNS trigger LANGUAGE plpgsql AS $$
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
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Posted journals cannot be changed or deleted; post a correcting entry instead';
END $$;

CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.journal_is_append_only();
CREATE TRIGGER journal_lines_append_only BEFORE UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.journal_is_append_only();

-- ---------------------------------------------------------------------------------------------
-- 3. Receipts, allocations and credit notes
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.payment_receipts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  receipt_number     text NOT NULL,
  received_on        date NOT NULL,
  payer_type         text NOT NULL CHECK (payer_type IN ('medical_aid', 'patient')),
  patient_id         uuid, -- plain reference, see journal_lines.patient_id
  medical_aid_provider text,
  method             text NOT NULL CHECK (method IN ('cash', 'card', 'eft', 'medical_aid_remittance', 'other')),
  amount             numeric(14,2) NOT NULL CHECK (amount > 0),
  deposit_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  reference          text,
  notes              text,
  created_from       text NOT NULL DEFAULT 'receipt' CHECK (created_from IN ('receipt', 'invoice_status', 'import')),
  voided_at          timestamptz,
  void_reason        text,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_receipts_number_unique UNIQUE (practice_id, receipt_number),
  CONSTRAINT payment_receipts_void_reason CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);
COMMENT ON TABLE public.payment_receipts IS
  'Money received, with the real payment date and method. Receipts are voided, never deleted. created_from = invoice_status marks receipts made automatically when an invoice is marked paid in the current UI.';

CREATE TABLE public.payment_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  receipt_id  uuid NOT NULL REFERENCES public.payment_receipts(id) ON DELETE RESTRICT,
  invoice_id  uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_unique UNIQUE (receipt_id, invoice_id)
);
COMMENT ON TABLE public.payment_allocations IS
  'Which invoices a receipt settles and by how much: supports part-payments and one medical aid remittance covering many invoices. Allocations are sub-ledger detail; the general ledger is posted from the receipt.';

CREATE TABLE public.credit_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  credit_note_number text NOT NULL,
  invoice_id         uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  issued_on          date NOT NULL,
  funder             text NOT NULL CHECK (funder IN ('medical_aid', 'patient')),
  amount             numeric(14,2) NOT NULL CHECK (amount > 0),
  reason             text NOT NULL,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_notes_number_unique UNIQUE (practice_id, credit_note_number)
);
COMMENT ON TABLE public.credit_notes IS
  'Reduces what a funder owes on an invoice (scheme short-payment, write-off, discount) without editing the invoice, so the original charge stays on record.';

-- An allocation may not exceed the receipt, nor what is still owed on the invoice
CREATE OR REPLACE FUNCTION public.payment_allocation_within_limits()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_receipt   public.payment_receipts%ROWTYPE;
  v_invoice   public.invoices_enhanced%ROWTYPE;
  v_allocated numeric(14,2);
  v_settled   numeric(14,2);
BEGIN
  SELECT * INTO v_receipt FROM public.payment_receipts WHERE id = NEW.receipt_id FOR UPDATE;
  SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = NEW.invoice_id FOR UPDATE;
  IF v_receipt.practice_id <> NEW.practice_id OR v_invoice.practice_id IS DISTINCT FROM NEW.practice_id THEN
    RAISE EXCEPTION 'Receipt, invoice and allocation must belong to the same practice';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_allocated
    FROM public.payment_allocations WHERE receipt_id = NEW.receipt_id AND id <> NEW.id;
  IF v_allocated + NEW.amount > v_receipt.amount THEN
    RAISE EXCEPTION 'Allocations (%) exceed receipt % (%)', v_allocated + NEW.amount, v_receipt.receipt_number, v_receipt.amount;
  END IF;
  SELECT COALESCE(SUM(a.amount), 0) INTO v_settled
    FROM public.payment_allocations a
    JOIN public.payment_receipts r ON r.id = a.receipt_id AND r.voided_at IS NULL
    WHERE a.invoice_id = NEW.invoice_id AND a.id <> NEW.id;
  v_settled := v_settled + COALESCE((SELECT SUM(amount) FROM public.credit_notes WHERE invoice_id = NEW.invoice_id), 0);
  IF v_settled + NEW.amount > COALESCE(v_invoice.total, 0) THEN
    RAISE EXCEPTION 'Allocation exceeds the amount still owed on invoice %', v_invoice.invoice_number;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER payment_allocations_within_limits
  BEFORE INSERT OR UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.payment_allocation_within_limits();

-- Receipts can only be voided after they are created (their amount and date are history)
CREATE OR REPLACE FUNCTION public.payment_receipt_void_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Receipts cannot be deleted; void them instead';
  END IF;
  IF (to_jsonb(NEW) - 'voided_at' - 'void_reason') <> (to_jsonb(OLD) - 'voided_at' - 'void_reason')
     OR (OLD.voided_at IS NOT NULL AND NEW.voided_at IS NULL) THEN
    RAISE EXCEPTION 'A receipt can only be voided; record a new receipt for a different amount or date';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER payment_receipts_void_only
  BEFORE UPDATE OR DELETE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.payment_receipt_void_only();

-- What is still owed on each invoice after receipts and credit notes
CREATE OR REPLACE VIEW public.invoice_balances WITH (security_invoker = true) AS
SELECT i.id AS invoice_id,
       i.practice_id,
       COALESCE(i.total, 0) AS total,
       COALESCE(p.paid, 0) AS paid,
       COALESCE(c.credited, 0) AS credited,
       COALESCE(i.total, 0) - COALESCE(p.paid, 0) - COALESCE(c.credited, 0) AS balance
FROM public.invoices_enhanced i
LEFT JOIN (
  SELECT a.invoice_id, SUM(a.amount) AS paid
  FROM public.payment_allocations a
  JOIN public.payment_receipts r ON r.id = a.receipt_id AND r.voided_at IS NULL
  GROUP BY a.invoice_id
) p ON p.invoice_id = i.id
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS credited FROM public.credit_notes GROUP BY invoice_id
) c ON c.invoice_id = i.id;
COMMENT ON VIEW public.invoice_balances IS
  'Per-invoice balance after receipts and credit notes; replaces payment_status as the source of truth for what is owed.';

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
  'Postings that failed (e.g. accounts not set up). The billing, payroll or expense change still saves; Finance shows these so they can be fixed and re-posted.';

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
    CASE WHEN v_has_prior THEN COALESCE(p_change_date, CURRENT_DATE) ELSE p_entry_date END,
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
  RETURN public.finance_sync_source(v_practice, p_source_type, p_source_id, CURRENT_DATE,
    initcap(replace(p_source_type, '_', ' ')) || ' deleted', '[]'::jsonb);
END $$;

-- Invoice: receivables (split by funder) against revenue. Cancelled = void (all zero).
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
    v.practice_id, 'invoice', v.id, COALESCE(v.issue_date, CURRENT_DATE),
    'Invoice ' || COALESCE(v.invoice_number, v.id::text) || CASE WHEN v_void THEN ' cancelled' ELSE '' END,
    jsonb_build_array(
      jsonb_build_object('account', 'ar_medical_aid', 'funder', 'medical_aid', 'balance', v_ma),
      jsonb_build_object('account', 'ar_patient', 'funder', 'patient', 'balance', v_total - v_ma),
      jsonb_build_object('account', 'revenue_services', 'balance', -v_total)
    ),
    v.patient_id
  );
END $$;

-- Receipt: bank or cash against the payer's receivable. Voided = all zero.
CREATE OR REPLACE FUNCTION public.post_payment_receipt(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        public.payment_receipts%ROWTYPE;
  v_amount numeric(14,2);
BEGIN
  SELECT * INTO r FROM public.payment_receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_amount := CASE WHEN r.voided_at IS NULL THEN r.amount ELSE 0 END;
  RETURN public.finance_sync_source(
    r.practice_id, 'payment_receipt', r.id, r.received_on,
    'Receipt ' || r.receipt_number || CASE WHEN r.voided_at IS NOT NULL THEN ' voided' ELSE '' END,
    jsonb_build_array(
      jsonb_build_object('account_id', r.deposit_account_id, 'balance', v_amount),
      jsonb_build_object('account', 'ar_' || r.payer_type, 'funder', r.payer_type, 'balance', -v_amount)
    ),
    r.patient_id
  );
END $$;

-- Credit note: contra-revenue against the funder's receivable.
CREATE OR REPLACE FUNCTION public.post_credit_note(p_credit_note_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c         public.credit_notes%ROWTYPE;
  v_patient uuid;
BEGIN
  SELECT * INTO c FROM public.credit_notes WHERE id = p_credit_note_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT patient_id INTO v_patient FROM public.invoices_enhanced WHERE id = c.invoice_id;
  RETURN public.finance_sync_source(
    c.practice_id, 'credit_note', c.id, c.issued_on, 'Credit note ' || c.credit_note_number,
    jsonb_build_array(
      jsonb_build_object('account', 'revenue_credits', 'balance', c.amount),
      jsonb_build_object('account', 'ar_' || c.funder, 'funder', c.funder, 'balance', -c.amount)
    ),
    v_patient
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
    p.owner_practice_id, 'payslip', p.id, COALESCE(p.pay_period_end, p.payment_date, CURRENT_DATE),
    'Payslip ' || COALESCE(p.employee_name, '') || ' ' || to_char(p.pay_period_start, 'Mon YYYY'),
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
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_cancelled := lower(btrim(COALESCE(e.status, ''))) IN ('cancelled', 'canceled', 'void', 'voided');
  v_paid      := NOT v_cancelled AND lower(btrim(COALESCE(e.status, ''))) = 'paid';
  v_amount    := CASE WHEN v_cancelled THEN 0 ELSE round(COALESCE(e.amount, 0), 2) END;
  v_expense   := 'expense_' || COALESCE(e.expense_type, 'other');
  IF NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE practice_id = e.practice_id AND system_key = v_expense) THEN
    v_expense := 'expense_other';
  END IF;
  v_pay_from  := CASE WHEN lower(COALESCE(e.payment_method, '')) = 'cash' THEN 'cash' ELSE 'bank' END;
  RETURN public.finance_sync_source(
    e.practice_id, 'practice_expense', e.id, COALESCE(e.expense_date, CURRENT_DATE), 'Expense: ' || e.name,
    jsonb_build_array(
      jsonb_build_object('account', v_expense, 'balance', v_amount),
      jsonb_build_object('account', 'ap_suppliers', 'balance', CASE WHEN v_paid THEN 0 ELSE -v_amount END),
      jsonb_build_object('account', v_pay_from, 'balance', CASE WHEN v_paid THEN -v_amount ELSE 0 END)
    ),
    NULL,
    CASE WHEN v_paid THEN e.paid_date END
  );
END $$;

-- Stock take: stock and equipment at cost (same valuation as the Finance page) against what was
-- expensed when bought. Run monthly (pg_cron) or from a "Post stock valuation" button.
CREATE OR REPLACE FUNCTION public.post_inventory_valuation(p_practice_id uuid, p_as_at date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stock     numeric(14,2);
  v_equipment numeric(14,2);
BEGIN
  IF NOT public.finance_can_manage(p_practice_id) AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only practice administrators can post a stock valuation';
  END IF;
  SELECT COALESCE(SUM(value) FILTER (WHERE category <> 'equipment'), 0),
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

-- Bridge for the current UI: marking an invoice paid creates a receipt for what is still owed;
-- un-marking it voids that automatic receipt. Removed once receipts are recorded directly.
CREATE OR REPLACE FUNCTION public.bridge_invoice_status_payment(p_invoice_id uuid, p_received_on date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v          public.invoices_enhanced%ROWTYPE;
  v_total    numeric(14,2);
  v_ma_share numeric(14,2);
  v_method   text;
  v_deposit  uuid;
  v_funder   text;
  v_owed     numeric(14,2);
  v_receipt  uuid;
BEGIN
  SELECT * INTO v FROM public.invoices_enhanced WHERE id = p_invoice_id;
  IF NOT FOUND OR v.practice_id IS NULL THEN RETURN; END IF;

  IF lower(btrim(COALESCE(v.payment_status, ''))) <> 'paid' THEN
    UPDATE public.payment_receipts r
       SET voided_at = now(), void_reason = 'Invoice no longer marked paid'
     WHERE r.created_from = 'invoice_status' AND r.voided_at IS NULL
       AND EXISTS (SELECT 1 FROM public.payment_allocations a WHERE a.receipt_id = r.id AND a.invoice_id = v.id);
    RETURN;
  END IF;

  v_total    := GREATEST(round(COALESCE(v.total, 0), 2), 0);
  v_ma_share := LEAST(GREATEST(round(COALESCE(v.medical_aid_total, 0), 2), 0), v_total);
  v_method   := CASE lower(btrim(COALESCE(v.payment_method, '')))
                  WHEN 'cash' THEN 'cash' WHEN 'card' THEN 'card' WHEN 'eft' THEN 'eft'
                  WHEN 'bank_transfer' THEN 'eft' WHEN 'medical_aid' THEN 'medical_aid_remittance' ELSE 'other' END;
  v_deposit  := public.finance_account(v.practice_id, CASE WHEN v_method = 'cash' THEN 'cash' ELSE 'bank' END);

  FOREACH v_funder IN ARRAY ARRAY['medical_aid', 'patient'] LOOP
    v_owed := CASE WHEN v_funder = 'medical_aid' THEN v_ma_share ELSE v_total - v_ma_share END
      - COALESCE((SELECT SUM(a.amount) FROM public.payment_allocations a
                  JOIN public.payment_receipts r ON r.id = a.receipt_id AND r.voided_at IS NULL
                  WHERE a.invoice_id = v.id AND r.payer_type = v_funder), 0)
      - COALESCE((SELECT SUM(c.amount) FROM public.credit_notes c WHERE c.invoice_id = v.id AND c.funder = v_funder), 0);
    IF v_owed > 0 THEN
      INSERT INTO public.payment_receipts (practice_id, receipt_number, received_on, payer_type, patient_id, method,
                                           amount, deposit_account_id, reference, created_from, created_by)
      VALUES (v.practice_id,
              'AUTO-' || COALESCE(v.invoice_number, left(v.id::text, 8)) || '-' || left(v_funder, 2) || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
              COALESCE(p_received_on, (now() AT TIME ZONE 'Africa/Windhoek')::date),
              v_funder, v.patient_id, v_method, v_owed, v_deposit, v.invoice_number, 'invoice_status', auth.uid())
      RETURNING id INTO v_receipt;
      INSERT INTO public.payment_allocations (practice_id, receipt_id, invoice_id, amount)
      VALUES (v.practice_id, v_receipt, v.id, v_owed);
    END IF;
  END LOOP;
END $$;

-- One trigger function for every source table. Ledger problems are logged, never raised, so
-- saving an invoice, payslip or expense can never fail because of the ledger.
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
      IF TG_OP = 'INSERT' THEN
        PERFORM public.bridge_invoice_status_payment(v_id);
      ELSIF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        PERFORM public.bridge_invoice_status_payment(v_id);
      END IF;
    ELSIF v_source = 'payment_receipt' THEN
      PERFORM public.post_payment_receipt(v_id);
    ELSIF v_source = 'credit_note' THEN
      PERFORM public.post_credit_note(v_id);
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
CREATE TRIGGER payment_receipts_post_ledger
  AFTER INSERT OR UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('payment_receipt');
CREATE TRIGGER credit_notes_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('credit_note');
CREATE TRIGGER payslips_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('payslip');
CREATE TRIGGER practice_expenses_post_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.practice_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_on_source_change('practice_expense');

-- New practices get the standard chart of accounts
CREATE OR REPLACE FUNCTION public.finance_seed_new_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_default_chart_of_accounts(NEW.id);
  RETURN NULL;
END $$;

CREATE TRIGGER practices_seed_chart_of_accounts
  AFTER INSERT ON public.practices
  FOR EACH ROW EXECUTE FUNCTION public.finance_seed_new_practice();

-- Manual journal (accountant adjustments, opening balances). Lines: [{"account_id", "debit", "credit", "memo"}]
CREATE OR REPLACE FUNCTION public.post_manual_journal(p_practice_id uuid, p_entry_date date, p_description text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry uuid;
BEGIN
  IF NOT public.finance_can_manage(p_practice_id) THEN
    RAISE EXCEPTION 'Only practice administrators can post manual journals';
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

-- One-off go-live: seed accounts and post every existing record for a practice. Historical invoices
-- already marked paid get an automatic receipt dated their last update (the best date available).
CREATE OR REPLACE FUNCTION public.finance_backfill(p_practice_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r       record;
  v_count integer := 0;
BEGIN
  PERFORM public.seed_default_chart_of_accounts(p_practice_id);
  FOR r IN SELECT id, updated_at, issue_date FROM public.invoices_enhanced WHERE practice_id = p_practice_id LOOP
    PERFORM public.post_invoice(r.id);
    PERFORM public.bridge_invoice_status_payment(r.id, COALESCE((r.updated_at AT TIME ZONE 'Africa/Windhoek')::date, r.issue_date));
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
  PERFORM public.post_inventory_valuation(p_practice_id, (now() AT TIME ZONE 'Africa/Windhoek')::date);
  RETURN v_count;
END $$;
COMMENT ON FUNCTION public.finance_backfill(uuid) IS
  'Run once per practice at go-live (service role). Safe to re-run: postings only add differences.';

-- ---------------------------------------------------------------------------------------------
-- 5. Reporting views (security_invoker: the caller's RLS applies)
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
-- 6. Row level security: each practice sees only its own books
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.chart_of_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_posting_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice members read accounts" ON public.chart_of_accounts
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice managers add accounts" ON public.chart_of_accounts
  FOR INSERT TO authenticated WITH CHECK (public.finance_can_manage(practice_id));
CREATE POLICY "Practice managers edit accounts" ON public.chart_of_accounts
  FOR UPDATE TO authenticated USING (public.finance_can_manage(practice_id)) WITH CHECK (public.finance_can_manage(practice_id));

-- Journals: read-only for users; written only by the SECURITY DEFINER posting functions
CREATE POLICY "Practice members read journal entries" ON public.journal_entries
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice members read journal lines" ON public.journal_lines
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));

CREATE POLICY "Practice members read receipts" ON public.payment_receipts
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice managers record receipts" ON public.payment_receipts
  FOR INSERT TO authenticated WITH CHECK (public.finance_can_manage(practice_id));
CREATE POLICY "Practice managers void receipts" ON public.payment_receipts
  FOR UPDATE TO authenticated USING (public.finance_can_manage(practice_id)) WITH CHECK (public.finance_can_manage(practice_id));

CREATE POLICY "Practice members read allocations" ON public.payment_allocations
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice managers allocate receipts" ON public.payment_allocations
  FOR INSERT TO authenticated WITH CHECK (public.finance_can_manage(practice_id));

CREATE POLICY "Practice members read credit notes" ON public.credit_notes
  FOR SELECT TO authenticated USING (practice_id IN (SELECT public.finance_practice_ids()));
CREATE POLICY "Practice managers issue credit notes" ON public.credit_notes
  FOR INSERT TO authenticated WITH CHECK (public.finance_can_manage(practice_id));

CREATE POLICY "Practice managers read posting errors" ON public.finance_posting_errors
  FOR SELECT TO authenticated USING (practice_id IS NOT NULL AND public.finance_can_manage(practice_id));

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
