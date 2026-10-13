-- Applied 2026-10-07 as migration receipts_and_allocations_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: receipts, allocations and invoice adjustments (accounts receivable)
-- File:   proposals/2026-10-07-receipts-and-allocations.sql      Drafted: 2026-10-07
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Run the whole file once as it is on a Supabase branch (or in the SQL editor): it must finish
--      without an error. Read the NOTICE lines: section 2 says what it did to the payment_status
--      check, section 13 how many legacy receipts it wrote, section 14 runs the consistency checks.
--   2. Change the final ROLLBACK to COMMIT and run it again. In production pick a quiet hour:
--      section 13 writes one receipt per invoice that is already marked paid (a few seconds per
--      thousand invoices) and holds row locks on those invoices until it commits.
--   3. Nothing to deploy. Finance and the patient file look for these tables and switch from
--      "invoices marked paid" to receipts by themselves; until then they say they are using the
--      old basis.
--   Undo after a COMMIT: see the end of the file.
--
-- What it adds
--   receipts               money received: numbered per practice (RC-000001), payer (patient, medical
--                          aid fund or other), method, amount, date, references. Never deleted.
--   receipt_allocations    which invoice and which portion (patient or medical aid) a receipt pays.
--                          Reversible. What is not allocated stays on the receipt as credit
--                          (the suspense amount for money that cannot be matched yet).
--   invoice_adjustments    credit notes (CN-), write-offs (WO-, reason code + approver), journals (JN-),
--                          refunds of unallocated credit (RF-) and shortfall transfers (ST-: the unpaid
--                          medical aid portion moved to the patient). Never deleted; reversible.
--   ar_audit_events        who created or reversed every receipt, allocation and adjustment, and when.
--   Views                  ar_invoice_balances (per invoice, both portions), ar_invoice_portion_balances
--                          (one row per invoice and portion), ar_receipt_balances (allocated, refunded,
--                          unallocated) and ar_patient_balances (per patient account).
--   RPCs                   ar_post_receipt (a receipt with many allocations, shortfall transfers and
--                          write-offs in one call: the screens and the remittance import use it),
--                          ar_allocate_receipt, ar_post_adjustment, ar_reverse_receipt,
--                          ar_reverse_allocation, ar_reverse_adjustment.
--
-- Decisions
--   * Balances are COMPUTED (views), not maintained by triggers. A practice has thousands of invoices,
--     not millions; with the indexes below a balance is a few index lookups. Computed balances can
--     never drift from the entries, so there is nothing to repair (Eminence keeps running balances
--     in trigger-maintained columns and needs repair triggers). If a practice ever outgrows this,
--     cache the view in a materialized view refreshed by the same triggers that sync payment_status.
--   * Entries are never edited or deleted, only reversed (with who, when and why). Triggers refuse
--     anything else, including DELETE and TRUNCATE, for every role.
--   * Limits are enforced in the database as well as on screen: an allocation never exceeds what
--     is left on the receipt or what is owed on that portion; a credit note, write-off or decreasing
--     journal never exceeds what is owed on that portion; a shortfall transfer never exceeds the
--     unpaid medical aid portion; a refund never exceeds the receipt's unallocated credit.
--   * invoices_enhanced.payment_status stays meaningful for every existing screen: once an invoice
--     has entries, its status is derived from its balance by ar_sync_invoice_status:
--     paid (nothing owed), partial (money received, something still owed), otherwise pending or
--     overdue. Section 2 adds 'partial' to the live check constraint when it is missing, after a
--     safety check of the constraint's definition. Invoices without entries keep the status staff set.
--   * Legacy invoices already marked paid: BACKFILLED (section 13). Each gets one legacy receipt
--     (LEG-000001, its own number series, so real receipt numbers stay gapless) dated the day the
--     invoice was last updated, with the payment method recorded on it, allocated to both portions.
--     That is the same date and method Finance's daily takings use today, so past cash-ups do not
--     move, and every settled amount (old or new) is a receipt: refunds, reversals and statements
--     work the same way for old and new invoices. Rows of the old payment_records table, if it
--     exists, are imported first with their real dates.
--   * The old "mark paid" menu keeps working (section 9): marking an invoice paid records a receipt
--     for what is still owed (source status_bridge), marking it unpaid again reverses that receipt,
--     and cancelling an invoice that has entries is refused (credit it with a credit note instead).
--   * Allocation rules (also in src/services/ledger/arAllocation.ts): oldest invoice first, by
--     portion; a patient's payment goes to patient portions, a fund's to medical aid portions; part
--     payments allowed; an overpayment stays on the receipt as unallocated credit.
--   * Write-offs need an approver: a practice admin or doctor (users.role IN ('admin','doctor')),
--     recorded in approved_by. Refunds and credit notes record who made them; they need no approver.
--   * Access: practice members read their practice's entries (the usual
--     EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = ...) rule).
--     Nobody writes the tables directly: all writes go through the RPCs (SECURITY DEFINER, which
--     check the same membership rule), so every write is validated, numbered and audited.
--
-- Supersedes section 3 of proposals/2026-10-finance-ledger.sql (payment_receipts,
-- payment_allocations, credit_notes, invoice_balances and bridge_invoice_status_payment). Do not
-- apply both: if the general ledger is wanted, change its posting functions to post from receipts,
-- receipt_allocations and invoice_adjustments instead of creating its own receipt tables.
--
-- For the remittance import (next step): call ar_post_receipt once per fund payment with
--   source 'remittance_import', external_ref = the payment reference or document hash (a second
--   call with the same external_ref returns the first receipt and changes nothing), one allocation
--   per paid claim line (portion 'medical_aid', external_ref = the remittance line id), one
--   shortfall per line the fund paid short and the patient must pay, and write_offs for
--   contractual differences (needs an admin or doctor). Unmatched money stays unallocated on the
--   receipt (suspense) until it is allocated with ar_allocate_receipt.
--
-- Money is numeric(14,2) in NAD. Business dates are Africa/Windhoek calendar dates.
-- Used by: src/components/finance/receipts/* (screens), src/services/ledger/ar*.ts (rules, tested),
--          src/components/finance/financeData.ts (reports).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Preconditions: the columns this script relies on
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ')
    INTO v_missing
    FROM (VALUES
      ('invoices_enhanced', 'id'), ('invoices_enhanced', 'practice_id'), ('invoices_enhanced', 'patient_id'),
      ('invoices_enhanced', 'invoice_number'), ('invoices_enhanced', 'issue_date'), ('invoices_enhanced', 'due_date'),
      ('invoices_enhanced', 'total'), ('invoices_enhanced', 'medical_aid_total'), ('invoices_enhanced', 'payment_status'),
      ('invoices_enhanced', 'payment_method'), ('invoices_enhanced', 'updated_at'), ('invoices_enhanced', 'batch_id'),
      ('users', 'id'), ('users', 'practice_id'), ('users', 'role'),
      ('patients', 'id'), ('patients', 'practice_id'),
      ('medical_aid_details', 'patient_id'), ('medical_aid_details', 'provider')
    ) AS t(table_name, column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name
    );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %. Adjust this script before applying it.', v_missing;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices_enhanced' AND column_name = 'payment_status' AND data_type = 'USER-DEFINED'
  ) THEN
    RAISE EXCEPTION 'Stopped: invoices_enhanced.payment_status is an enum type. Add the value ''partial'' with ALTER TYPE (outside a transaction) and remove section 2.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. payment_status must accept 'partial' (money received, something still owed)
--    Existing values are kept exactly; only 'partial' is added. The safety check refuses a
--    constraint that is anything other than a plain list of allowed payment_status values, so a
--    rule this script does not understand is never dropped.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_con     record;
  v_values  text[];
  v_rest    text;
  v_list    text;
  v_found   integer := 0;
BEGIN
  FOR v_con IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid = 'public.invoices_enhanced'::regclass AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%payment_status%'
  LOOP
    v_found := v_found + 1;
    IF v_con.def ILIKE '%''partial''%' THEN
      RAISE NOTICE 'Section 2: constraint % already accepts partial; left as it is (%).', v_con.conname, v_con.def;
      CONTINUE;
    END IF;

    SELECT array_agg(DISTINCT m[1]) INTO v_values FROM regexp_matches(v_con.def, '''([^'']*)''', 'g') AS m;
    -- Remove the quoted values, their casts and the tokens of an "IN (...)" check: nothing may be left
    v_rest := regexp_replace(v_con.def, '''[^'']*''', '', 'g');
    v_rest := regexp_replace(v_rest, '::(text|character varying)(\[\])?', '', 'gi');
    v_rest := regexp_replace(v_rest, '\m(CHECK|payment_status|ANY|ARRAY|IS|NOT|NULL|OR|IN)\M', '', 'gi');
    v_rest := regexp_replace(v_rest, '[\s(),=\[\]]', '', 'g');
    IF v_values IS NULL OR v_rest <> '' THEN
      RAISE EXCEPTION 'Stopped: check constraint % on invoices_enhanced is not a plain list of payment_status values (%). Add ''partial'' to it by hand and run this script again.', v_con.conname, v_con.def;
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO v_list
      FROM unnest(array_append(v_values, 'partial')) AS v;
    EXECUTE format('ALTER TABLE public.invoices_enhanced DROP CONSTRAINT %I', v_con.conname);
    EXECUTE format('ALTER TABLE public.invoices_enhanced ADD CONSTRAINT %I CHECK (payment_status IN (%s)) NOT VALID', v_con.conname, v_list);
    EXECUTE format('ALTER TABLE public.invoices_enhanced VALIDATE CONSTRAINT %I', v_con.conname);
    RAISE NOTICE 'Section 2: constraint % was "%"; it now allows %.', v_con.conname, v_con.def, v_list;
  END LOOP;
  IF v_found = 0 THEN
    RAISE NOTICE 'Section 2: invoices_enhanced has no check on payment_status; partial is already accepted.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Small helpers
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_today()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Africa/Windhoek')::date
$$;

CREATE OR REPLACE FUNCTION public.ar_is_cancelled(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(COALESCE(p_status, ''))) IN ('cancelled', 'canceled', 'void', 'voided')
$$;

CREATE OR REPLACE FUNCTION public.ar_format_nad(p_amount numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'N$ ' || to_char(COALESCE(p_amount, 0), 'FM999999999990.00')
$$;

CREATE OR REPLACE FUNCTION public.ar_portion_label(p_portion text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_portion WHEN 'medical_aid' THEN 'medical aid' WHEN 'patient' THEN 'patient' ELSE COALESCE(p_portion, '?') END
$$;

-- An amount from an RPC payload: a JSON number or numeric string with at most 2 decimals
CREATE OR REPLACE FUNCTION public.ar_amount(p_value jsonb)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v numeric;
BEGIN
  BEGIN
    v := (p_value #>> '{}')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Not a valid amount: %', p_value;
  END;
  IF v IS NULL THEN
    RAISE EXCEPTION 'An amount is missing';
  END IF;
  IF v <> round(v, 2) THEN
    RAISE EXCEPTION 'Amounts are in cents: % has more than 2 decimals', v;
  END IF;
  RETURN v;
END $$;

-- The payment methods HPMS has stored as free text, mapped like Finance does (ledger/invoices.ts)
CREATE OR REPLACE FUNCTION public.ar_receipt_method_from_text(p_method text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE regexp_replace(lower(btrim(COALESCE(p_method, ''))), '[\s-]+', '_', 'g')
    WHEN '' THEN 'not_recorded'
    WHEN 'cash' THEN 'cash'
    WHEN 'card' THEN 'card' WHEN 'credit_card' THEN 'card' WHEN 'debit_card' THEN 'card'
    WHEN 'eft' THEN 'eft' WHEN 'bank_transfer' THEN 'eft'
    WHEN 'medical_aid' THEN 'medical_aid' WHEN 'medicalaid' THEN 'medical_aid'
    WHEN 'debit_order' THEN 'debit_order'
    ELSE 'other'
  END
$$;

-- Membership and approver rules (the same rule as the RLS policies below)
CREATE OR REPLACE FUNCTION public.ar_assert_member(p_practice_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'You can only record payments for your own practice' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ar_is_approver(p_practice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.practice_id = p_practice_id AND users.role IN ('admin', 'doctor')
  )
$$;
COMMENT ON FUNCTION public.ar_is_approver(uuid) IS
  'True for the practice''s admins and doctors: they approve write-offs.';

-- ---------------------------------------------------------------------------------------------
-- 4. Document numbers: per practice and series, gapless (the counter row is updated in the same
--    transaction as the document, so a failed save does not use up a number)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ar_document_counters (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  series      text NOT NULL CHECK (series IN ('receipt', 'legacy_receipt', 'credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer')),
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (practice_id, series)
);
COMMENT ON TABLE public.ar_document_counters IS
  'Last number used per practice and document series. Written only by ar_next_document_number().';

CREATE OR REPLACE FUNCTION public.ar_next_document_number(p_practice_id uuid, p_series text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO ar_document_counters AS c (practice_id, series, last_number)
  VALUES (p_practice_id, p_series, 1)
  ON CONFLICT (practice_id, series) DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_next;
  RETURN CASE p_series
    WHEN 'receipt' THEN 'RC'
    WHEN 'legacy_receipt' THEN 'LEG'
    WHEN 'credit_note' THEN 'CN'
    WHEN 'write_off' THEN 'WO'
    WHEN 'journal' THEN 'JN'
    WHEN 'refund' THEN 'RF'
    WHEN 'shortfall_transfer' THEN 'ST'
  END || '-' || lpad(v_next::text, 6, '0');
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Tables
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  receipt_number  text NOT NULL,
  payer_type      text NOT NULL CHECK (payer_type IN ('patient', 'medical_aid', 'other')),
  -- The paying patient; for other payers, the patient whose account it is (optional)
  patient_id      uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  -- The medical aid fund, as written in medical_aid_details.provider (payer_type medical_aid)
  fund_name       text,
  -- Who paid when it was neither the patient nor a fund (employer, relative, insurer)
  payer_name      text,
  method          text NOT NULL CHECK (method IN ('cash', 'card', 'eft', 'medical_aid', 'debit_order', 'other', 'not_recorded')),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  received_on     date NOT NULL,
  reference       text,
  -- Idempotency key of imports (e.g. a remittance payment reference); unique per practice and source
  external_ref    text,
  source          text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'batch', 'remittance_import', 'status_bridge', 'legacy_backfill')),
  notes           text,
  created_by      uuid, -- auth user id; no foreign key so staff records can change without touching history
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  CONSTRAINT receipts_number_unique UNIQUE (practice_id, receipt_number),
  CONSTRAINT receipts_payer_known CHECK (
    (payer_type = 'patient' AND patient_id IS NOT NULL)
    OR (payer_type = 'medical_aid' AND NULLIF(btrim(fund_name), '') IS NOT NULL)
    OR (payer_type = 'other' AND NULLIF(btrim(payer_name), '') IS NOT NULL)
  ),
  CONSTRAINT receipts_old_methods_only_for_old_payments CHECK (
    method NOT IN ('other', 'not_recorded') OR source IN ('status_bridge', 'legacy_backfill')
  ),
  CONSTRAINT receipts_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND NULLIF(btrim(reversal_reason), '') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_external_ref_unique ON public.receipts (practice_id, source, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipts_practice_received_idx ON public.receipts (practice_id, received_on);
CREATE INDEX IF NOT EXISTS receipts_patient_idx ON public.receipts (patient_id) WHERE patient_id IS NOT NULL;
COMMENT ON TABLE public.receipts IS
  'Money received. Never deleted or edited: a wrong receipt is reversed (reversed_at, reversed_by, reversal_reason) and a new one recorded. What is not allocated to invoices is credit on the receipt (suspense).';
COMMENT ON COLUMN public.receipts.source IS
  'manual and batch: Finance screens; remittance_import: medical aid remittances; status_bridge: an invoice marked paid in the old status menu; legacy_backfill: payments from before receipts existed (LEG- numbers).';

CREATE TABLE IF NOT EXISTS public.receipt_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  receipt_id      uuid NOT NULL REFERENCES public.receipts(id) ON DELETE RESTRICT,
  invoice_id      uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  portion         text NOT NULL CHECK (portion IN ('patient', 'medical_aid')),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  -- e.g. the remittance line this allocation came from
  external_ref    text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  CONSTRAINT receipt_allocations_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND NULLIF(btrim(reversal_reason), '') IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS receipt_allocations_receipt_idx ON public.receipt_allocations (receipt_id);
CREATE INDEX IF NOT EXISTS receipt_allocations_invoice_idx ON public.receipt_allocations (invoice_id);
COMMENT ON TABLE public.receipt_allocations IS
  'Which invoice and portion (patient or medical aid) a receipt pays. Reversing one puts the amount back on the invoice and back on the receipt as unallocated credit.';

CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id       uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  adjustment_number text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer')),
  invoice_id        uuid REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  -- refunds: the receipt whose unallocated credit is paid back
  receipt_id        uuid REFERENCES public.receipts(id) ON DELETE RESTRICT,
  patient_id        uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  -- The portion affected. Shortfall transfers always move from 'medical_aid' to the patient.
  portion           text CHECK (portion IN ('patient', 'medical_aid')),
  -- Positive, except journals: positive adds to what the portion owes, negative takes off
  amount            numeric(14,2) NOT NULL,
  -- refunds: how the money went back
  method            text CHECK (method IN ('cash', 'card', 'eft', 'debit_order')),
  reason_code       text,
  reason            text NOT NULL CHECK (btrim(reason) <> ''),
  approved_by       uuid,
  approved_at       timestamptz,
  effective_on      date NOT NULL,
  external_ref      text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reversed_at       timestamptz,
  reversed_by       uuid,
  reversal_reason   text,
  CONSTRAINT invoice_adjustments_number_unique UNIQUE (practice_id, adjustment_number),
  CONSTRAINT invoice_adjustments_shape CHECK (
    CASE kind
      WHEN 'refund' THEN receipt_id IS NOT NULL AND invoice_id IS NULL AND portion IS NULL AND amount > 0 AND method IS NOT NULL
      WHEN 'shortfall_transfer' THEN invoice_id IS NOT NULL AND receipt_id IS NULL AND portion = 'medical_aid' AND amount > 0
      WHEN 'journal' THEN invoice_id IS NOT NULL AND receipt_id IS NULL AND portion IS NOT NULL AND amount <> 0
      ELSE invoice_id IS NOT NULL AND receipt_id IS NULL AND portion IS NOT NULL AND amount > 0
    END
  ),
  CONSTRAINT invoice_adjustments_write_off_rules CHECK (
    kind <> 'write_off' OR (
      approved_by IS NOT NULL
      AND reason_code IN ('bad_debt', 'small_balance', 'scheme_rate', 'claim_expired', 'courtesy', 'deceased', 'other')
    )
  ),
  CONSTRAINT invoice_adjustments_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND NULLIF(btrim(reversal_reason), '') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_adjustments_external_ref_unique ON public.invoice_adjustments (practice_id, kind, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_adjustments_invoice_idx ON public.invoice_adjustments (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_adjustments_receipt_idx ON public.invoice_adjustments (receipt_id) WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_adjustments_practice_date_idx ON public.invoice_adjustments (practice_id, effective_on);
COMMENT ON TABLE public.invoice_adjustments IS
  'Credit notes, write-offs, journals (corrections), refunds and shortfall transfers. Never deleted or edited; reversed with a reason.';
COMMENT ON COLUMN public.invoice_adjustments.reason_code IS
  'Write-offs: bad_debt, small_balance, scheme_rate (fund paid its tariff; the difference may not be billed), claim_expired (claim deadline missed), courtesy, deceased, other. Free for other kinds (e.g. remittance reason codes).';

CREATE TABLE IF NOT EXISTS public.ar_audit_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id uuid NOT NULL,
  entity      text NOT NULL CHECK (entity IN ('receipt', 'allocation', 'adjustment')),
  entity_id   uuid NOT NULL,
  action      text NOT NULL CHECK (action IN ('created', 'reversed')),
  actor       uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details     jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ar_audit_events_entity_idx ON public.ar_audit_events (entity, entity_id);
CREATE INDEX IF NOT EXISTS ar_audit_events_practice_idx ON public.ar_audit_events (practice_id, occurred_at);
COMMENT ON TABLE public.ar_audit_events IS
  'Append-only: who created or reversed each receipt, allocation and adjustment, when, and the row as it was.';

-- ---------------------------------------------------------------------------------------------
-- 6. Balance views (security_invoker: the caller's RLS applies)
--    The invoice split follows Finance (ledger/invoices.ts splitCents): the medical aid owes its
--    recorded portion capped at the total, the patient the rest; a cancelled invoice is void.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ar_invoice_balances WITH (security_invoker = true) AS
SELECT f.*,
       f.medical_aid_billed + f.medical_aid_journals - f.shortfall_transferred
         - f.medical_aid_credited - f.medical_aid_written_off - f.medical_aid_allocated AS medical_aid_outstanding,
       f.patient_billed + f.patient_journals + f.shortfall_transferred
         - f.patient_credited - f.patient_written_off - f.patient_allocated AS patient_outstanding,
       f.medical_aid_billed + f.patient_billed + f.medical_aid_journals + f.patient_journals
         - f.medical_aid_credited - f.patient_credited - f.medical_aid_written_off - f.patient_written_off
         - f.medical_aid_allocated - f.patient_allocated AS outstanding
FROM (
  SELECT i.id AS invoice_id,
         i.practice_id,
         i.patient_id,
         i.invoice_number,
         i.issue_date,
         i.due_date,
         i.payment_status,
         i.batch_id,
         public.ar_is_cancelled(i.payment_status) AS is_cancelled,
         s.medical_aid_billed,
         s.patient_billed,
         COALESCE(a.medical_aid_allocated, 0) AS medical_aid_allocated,
         COALESCE(a.patient_allocated, 0) AS patient_allocated,
         COALESCE(d.medical_aid_credited, 0) AS medical_aid_credited,
         COALESCE(d.patient_credited, 0) AS patient_credited,
         COALESCE(d.medical_aid_written_off, 0) AS medical_aid_written_off,
         COALESCE(d.patient_written_off, 0) AS patient_written_off,
         COALESCE(d.medical_aid_journals, 0) AS medical_aid_journals,
         COALESCE(d.patient_journals, 0) AS patient_journals,
         COALESCE(d.shortfall_transferred, 0) AS shortfall_transferred,
         (COALESCE(a.effective_entries, 0) + COALESCE(d.effective_entries, 0)) > 0 AS has_activity,
         (COALESCE(a.entries, 0) + COALESCE(d.entries, 0)) > 0 AS has_entries,
         a.last_receipt_method,
         a.last_receipt_on
  FROM public.invoices_enhanced i
  CROSS JOIN LATERAL (
    SELECT round(COALESCE(i.total, 0)::numeric, 2) AS total,
           round(COALESCE(i.medical_aid_total, 0)::numeric, 2) AS medical_aid_total
  ) t
  CROSS JOIN LATERAL (
    SELECT CASE WHEN public.ar_is_cancelled(i.payment_status) OR t.total <= 0 THEN 0
                ELSE LEAST(GREATEST(t.medical_aid_total, 0), t.total)
           END AS medical_aid_billed,
           CASE WHEN public.ar_is_cancelled(i.payment_status) THEN 0
                WHEN t.total <= 0 THEN t.total
                ELSE t.total - LEAST(GREATEST(t.medical_aid_total, 0), t.total)
           END AS patient_billed
  ) s
  LEFT JOIN LATERAL (
    SELECT SUM(ra.amount) FILTER (WHERE ra.portion = 'medical_aid' AND ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS medical_aid_allocated,
           SUM(ra.amount) FILTER (WHERE ra.portion = 'patient' AND ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS patient_allocated,
           COUNT(*) FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS effective_entries,
           COUNT(*) AS entries,
           (array_agg(r.method ORDER BY r.received_on DESC, ra.created_at DESC)
              FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL))[1] AS last_receipt_method,
           MAX(r.received_on) FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS last_receipt_on
    FROM public.receipt_allocations ra
    JOIN public.receipts r ON r.id = ra.receipt_id
    WHERE ra.invoice_id = i.id
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT SUM(ad.amount) FILTER (WHERE ad.kind = 'credit_note' AND ad.portion = 'medical_aid' AND ad.reversed_at IS NULL) AS medical_aid_credited,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'credit_note' AND ad.portion = 'patient' AND ad.reversed_at IS NULL) AS patient_credited,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'write_off' AND ad.portion = 'medical_aid' AND ad.reversed_at IS NULL) AS medical_aid_written_off,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'write_off' AND ad.portion = 'patient' AND ad.reversed_at IS NULL) AS patient_written_off,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'journal' AND ad.portion = 'medical_aid' AND ad.reversed_at IS NULL) AS medical_aid_journals,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'journal' AND ad.portion = 'patient' AND ad.reversed_at IS NULL) AS patient_journals,
           SUM(ad.amount) FILTER (WHERE ad.kind = 'shortfall_transfer' AND ad.reversed_at IS NULL) AS shortfall_transferred,
           COUNT(*) FILTER (WHERE ad.reversed_at IS NULL) AS effective_entries,
           COUNT(*) AS entries
    FROM public.invoice_adjustments ad
    WHERE ad.invoice_id = i.id
  ) d ON true
) f;
COMMENT ON VIEW public.ar_invoice_balances IS
  'Per invoice and portion: billed, allocated, credited, written off, journals, shortfall moved to the patient, and outstanding (negative = paid more than owed). has_activity: entries that still stand; has_entries: any entry, reversed or not (from then on payment_status follows the balance).';

CREATE OR REPLACE VIEW public.ar_invoice_portion_balances WITH (security_invoker = true) AS
SELECT b.invoice_id, b.practice_id, b.patient_id, b.invoice_number, b.issue_date, b.due_date, 'medical_aid'::text AS portion,
       b.medical_aid_billed AS billed, b.medical_aid_allocated AS allocated, b.medical_aid_credited AS credited,
       b.medical_aid_written_off AS written_off, b.medical_aid_journals AS journals, -b.shortfall_transferred AS transferred,
       b.medical_aid_outstanding AS outstanding
FROM public.ar_invoice_balances b
UNION ALL
SELECT b.invoice_id, b.practice_id, b.patient_id, b.invoice_number, b.issue_date, b.due_date, 'patient'::text,
       b.patient_billed, b.patient_allocated, b.patient_credited,
       b.patient_written_off, b.patient_journals, b.shortfall_transferred,
       b.patient_outstanding
FROM public.ar_invoice_balances b;
COMMENT ON VIEW public.ar_invoice_portion_balances IS
  'One row per invoice and portion. transferred: shortfall moved in (patient, positive) or out (medical aid, negative).';

CREATE OR REPLACE VIEW public.ar_receipt_balances WITH (security_invoker = true) AS
SELECT r.id AS receipt_id,
       r.practice_id,
       r.receipt_number,
       r.payer_type,
       r.patient_id,
       r.fund_name,
       r.payer_name,
       r.method,
       r.amount,
       r.received_on,
       r.reference,
       r.external_ref,
       r.source,
       r.notes,
       r.created_by,
       r.created_at,
       r.reversed_at,
       r.reversed_by,
       r.reversal_reason,
       COALESCE(a.allocated, 0) AS allocated,
       COALESCE(f.refunded, 0) AS refunded,
       CASE WHEN r.reversed_at IS NULL THEN r.amount - COALESCE(a.allocated, 0) - COALESCE(f.refunded, 0) ELSE 0 END AS unallocated
FROM public.receipts r
LEFT JOIN LATERAL (
  SELECT SUM(ra.amount) AS allocated FROM public.receipt_allocations ra
  WHERE ra.receipt_id = r.id AND ra.reversed_at IS NULL
) a ON true
LEFT JOIN LATERAL (
  SELECT SUM(ad.amount) AS refunded FROM public.invoice_adjustments ad
  WHERE ad.receipt_id = r.id AND ad.kind = 'refund' AND ad.reversed_at IS NULL
) f ON true;
COMMENT ON VIEW public.ar_receipt_balances IS
  'Each receipt with what is allocated, refunded and still unallocated (credit; suspense for money not matched yet). A reversed receipt has nothing unallocated.';

CREATE OR REPLACE VIEW public.ar_patient_balances WITH (security_invoker = true) AS
WITH owed AS (
  SELECT practice_id, patient_id,
         SUM(GREATEST(medical_aid_outstanding, 0)) AS medical_aid_owed,
         SUM(GREATEST(patient_outstanding, 0)) AS patient_owed,
         COUNT(*) FILTER (WHERE medical_aid_outstanding > 0 OR patient_outstanding > 0) AS open_invoices
  FROM public.ar_invoice_balances
  WHERE patient_id IS NOT NULL AND practice_id IS NOT NULL
  GROUP BY practice_id, patient_id
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
  'Per patient account: what the medical aid and the patient still owe, credit not yet allocated, and the net balance.';

CREATE OR REPLACE FUNCTION public.ar_portion_outstanding(p_invoice_id uuid, p_portion text)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE p_portion WHEN 'medical_aid' THEN b.medical_aid_outstanding WHEN 'patient' THEN b.patient_outstanding END
  FROM public.ar_invoice_balances b
  WHERE b.invoice_id = p_invoice_id
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. payment_status from the balance (same rule as deriveInvoiceStatus in ledger/arBalances.ts)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_derive_payment_status(
  p_current text, p_due_date date, p_has_entries boolean, p_owed numeric, p_allocated numeric)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN public.ar_is_cancelled(p_current) THEN p_current
    WHEN NOT p_has_entries THEN p_current           -- never had entries: the status staff set still applies
    WHEN p_owed <= 0 THEN 'paid'
    WHEN p_allocated > 0 THEN 'partial'
    WHEN lower(btrim(COALESCE(p_current, ''))) IN ('pending', 'overdue') THEN p_current
    WHEN p_due_date IS NOT NULL AND p_due_date < public.ar_today() THEN 'overdue'
    ELSE 'pending'
  END
$$;

CREATE OR REPLACE FUNCTION public.ar_sync_invoice_status(p_invoice_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b        public.ar_invoice_balances%ROWTYPE;
  v_status text;
BEGIN
  -- Section 13 imports old payments with the sync paused, then syncs the invoices it touched
  IF current_setting('hpms.ar_backfill', true) = 'on' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO b FROM ar_invoice_balances WHERE invoice_id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_status := ar_derive_payment_status(
    b.payment_status, b.due_date, b.has_entries,
    GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0),
    b.medical_aid_allocated + b.patient_allocated
  );
  IF v_status IS NOT DISTINCT FROM b.payment_status THEN
    RETURN v_status;
  END IF;
  -- Tell the status bridge (section 9) that this update comes from the ledger itself
  PERFORM set_config('hpms.ar_internal', 'on', true);
  UPDATE invoices_enhanced
     SET payment_status = v_status,
         -- As the old status menu does: the method of the payment that settled it, cleared otherwise
         payment_method = CASE WHEN v_status = 'paid' THEN b.last_receipt_method END
   WHERE id = p_invoice_id;
  PERFORM set_config('hpms.ar_internal', 'off', true);
  RETURN v_status;
END $$;
COMMENT ON FUNCTION public.ar_sync_invoice_status(uuid) IS
  'Sets invoices_enhanced.payment_status (and payment_method) from the invoice balance once it has entries. Called by the entry triggers.';

-- ---------------------------------------------------------------------------------------------
-- 8. Triggers on the entries
-- ---------------------------------------------------------------------------------------------

-- 8a. Receipts: number, defaults and payer checks
CREATE OR REPLACE FUNCTION public.ar_receipts_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.receipt_number := ar_next_document_number(NEW.practice_id, CASE WHEN NEW.source = 'legacy_backfill' THEN 'legacy_receipt' ELSE 'receipt' END);
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.created_at := now();
  NEW.reversed_at := NULL;
  NEW.reversed_by := NULL;
  NEW.reversal_reason := NULL;
  NEW.fund_name := NULLIF(btrim(NEW.fund_name), '');
  NEW.payer_name := NULLIF(btrim(NEW.payer_name), '');
  IF NEW.patient_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = NEW.patient_id AND (p.practice_id = NEW.practice_id OR p.practice_id IS NULL))
     AND NOT EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.patient_id = NEW.patient_id AND i.practice_id = NEW.practice_id) THEN
    RAISE EXCEPTION 'This patient is not a patient of the practice';
  END IF;
  RETURN NEW;
END $$;

-- 8b. Allocations: never more than is left on the receipt or owed on the portion
CREATE OR REPLACE FUNCTION public.ar_allocations_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_receipt     receipts%ROWTYPE;
  v_invoice     invoices_enhanced%ROWTYPE;
  v_unallocated numeric(14,2);
  v_owed        numeric(14,2);
BEGIN
  -- Lock both rows so two allocations at the same moment cannot both use the same money
  SELECT * INTO v_receipt FROM receipts WHERE id = NEW.receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = NEW.invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF v_receipt.practice_id <> NEW.practice_id OR v_invoice.practice_id IS DISTINCT FROM NEW.practice_id THEN
    RAISE EXCEPTION 'The receipt, the invoice and the allocation must belong to the same practice';
  END IF;
  IF v_receipt.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Receipt % is reversed; record a new receipt', v_receipt.receipt_number;
  END IF;
  IF ar_is_cancelled(v_invoice.payment_status) THEN
    RAISE EXCEPTION 'Invoice % is cancelled; nothing can be allocated to it', v_invoice.invoice_number;
  END IF;
  SELECT unallocated INTO v_unallocated FROM ar_receipt_balances WHERE receipt_id = NEW.receipt_id;
  IF NEW.amount > COALESCE(v_unallocated, 0) THEN
    RAISE EXCEPTION 'Receipt % has only % left to allocate', v_receipt.receipt_number, ar_format_nad(GREATEST(COALESCE(v_unallocated, 0), 0));
  END IF;
  v_owed := COALESCE(ar_portion_outstanding(NEW.invoice_id, NEW.portion), 0);
  IF NEW.amount > v_owed THEN
    RAISE EXCEPTION '% is more than the % still owed on the % portion of invoice %',
      ar_format_nad(NEW.amount), ar_format_nad(GREATEST(v_owed, 0)), ar_portion_label(NEW.portion), v_invoice.invoice_number;
  END IF;
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.created_at := now();
  NEW.reversed_at := NULL;
  NEW.reversed_by := NULL;
  NEW.reversal_reason := NULL;
  RETURN NEW;
END $$;

-- 8c. Adjustments: number, limits per kind and the write-off approver
CREATE OR REPLACE FUNCTION public.ar_adjustments_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice     invoices_enhanced%ROWTYPE;
  v_receipt     receipts%ROWTYPE;
  v_owed        numeric(14,2);
  v_unallocated numeric(14,2);
BEGIN
  IF NEW.kind = 'refund' THEN
    SELECT * INTO v_receipt FROM receipts WHERE id = NEW.receipt_id FOR UPDATE;
    IF NOT FOUND OR v_receipt.practice_id <> NEW.practice_id THEN
      RAISE EXCEPTION 'Receipt not found in this practice';
    END IF;
    IF v_receipt.reversed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Receipt % is reversed; there is nothing to refund', v_receipt.receipt_number;
    END IF;
    SELECT unallocated INTO v_unallocated FROM ar_receipt_balances WHERE receipt_id = NEW.receipt_id;
    IF NEW.amount > COALESCE(v_unallocated, 0) THEN
      RAISE EXCEPTION 'A refund can only pay back unallocated credit: receipt % has % unallocated',
        v_receipt.receipt_number, ar_format_nad(GREATEST(COALESCE(v_unallocated, 0), 0));
    END IF;
    NEW.patient_id := COALESCE(NEW.patient_id, v_receipt.patient_id);
  ELSE
    SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = NEW.invoice_id FOR UPDATE;
    IF NOT FOUND OR v_invoice.practice_id IS DISTINCT FROM NEW.practice_id THEN
      RAISE EXCEPTION 'Invoice not found in this practice';
    END IF;
    IF ar_is_cancelled(v_invoice.payment_status) THEN
      RAISE EXCEPTION 'Invoice % is cancelled', v_invoice.invoice_number;
    END IF;
    NEW.patient_id := v_invoice.patient_id;
    IF NEW.kind IN ('credit_note', 'write_off') OR (NEW.kind = 'journal' AND NEW.amount < 0) THEN
      v_owed := COALESCE(ar_portion_outstanding(NEW.invoice_id, NEW.portion), 0);
      IF abs(NEW.amount) > v_owed THEN
        RAISE EXCEPTION '% cannot be more than the % still owed on the % portion of invoice %',
          CASE NEW.kind WHEN 'credit_note' THEN 'A credit note' WHEN 'write_off' THEN 'A write-off' ELSE 'A correction' END,
          ar_format_nad(GREATEST(v_owed, 0)), ar_portion_label(NEW.portion), v_invoice.invoice_number;
      END IF;
    ELSIF NEW.kind = 'shortfall_transfer' THEN
      v_owed := COALESCE(ar_portion_outstanding(NEW.invoice_id, 'medical_aid'), 0);
      IF NEW.amount > v_owed THEN
        RAISE EXCEPTION 'Only % of the medical aid portion of invoice % is unpaid, so no more can be moved to the patient',
          ar_format_nad(GREATEST(v_owed, 0)), v_invoice.invoice_number;
      END IF;
    END IF;
  END IF;
  IF NEW.kind = 'write_off' AND (
       NEW.approved_by IS NULL
       OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.approved_by AND u.practice_id = NEW.practice_id AND u.role IN ('admin', 'doctor'))
     ) THEN
    RAISE EXCEPTION 'A write-off must be approved by a practice admin or doctor';
  END IF;
  NEW.adjustment_number := ar_next_document_number(NEW.practice_id, NEW.kind);
  NEW.approved_at := CASE WHEN NEW.approved_by IS NOT NULL THEN now() END;
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.created_at := now();
  NEW.reversed_at := NULL;
  NEW.reversed_by := NULL;
  NEW.reversal_reason := NULL;
  RETURN NEW;
END $$;

-- 8d. Never deleted, never changed: only a one-way reversal with a reason
CREATE OR REPLACE FUNCTION public.ar_reverse_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_fields text[] := ARRAY['reversed_at', 'reversed_by', 'reversal_reason'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Receipts, allocations and adjustments are never deleted; reverse them instead';
  END IF;
  IF OLD.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This entry is already reversed';
  END IF;
  IF (to_jsonb(NEW) - v_fields) IS DISTINCT FROM (to_jsonb(OLD) - v_fields) THEN
    RAISE EXCEPTION 'Entries cannot be changed; reverse this one and record a new one';
  END IF;
  IF NEW.reversed_at IS NULL OR NULLIF(btrim(COALESCE(NEW.reversal_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reversal needs a reason';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.ar_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Receipts, allocations and adjustments are never deleted';
END $$;

-- 8e. Reversal rules that depend on other entries
CREATE OR REPLACE FUNCTION public.ar_receipts_before_reverse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_refund text;
BEGIN
  SELECT adjustment_number INTO v_refund FROM invoice_adjustments
   WHERE receipt_id = NEW.id AND kind = 'refund' AND reversed_at IS NULL
   ORDER BY created_at LIMIT 1;
  IF v_refund IS NOT NULL THEN
    RAISE EXCEPTION 'Money was refunded from receipt % (%); reverse the refund first', NEW.receipt_number, v_refund;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.ar_adjustments_before_reverse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owed numeric(14,2);
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    PERFORM 1 FROM invoices_enhanced WHERE id = NEW.invoice_id FOR UPDATE;
  END IF;
  IF NEW.kind = 'shortfall_transfer' THEN
    -- Moving it back to the medical aid is only possible while the patient still owes it
    v_owed := COALESCE(ar_portion_outstanding(NEW.invoice_id, 'patient'), 0);
    IF NEW.amount > v_owed THEN
      RAISE EXCEPTION 'The patient has already paid part of the % moved by %; reverse that payment first',
        ar_format_nad(NEW.amount), NEW.adjustment_number;
    END IF;
  ELSIF NEW.kind = 'journal' AND NEW.amount > 0 THEN
    v_owed := COALESCE(ar_portion_outstanding(NEW.invoice_id, NEW.portion), 0);
    IF NEW.amount > v_owed THEN
      RAISE EXCEPTION 'Part of the % added by % has been paid; reverse that payment first',
        ar_format_nad(NEW.amount), NEW.adjustment_number;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 8f. After a receipt is reversed, so are its allocations (the invoices are owed again)
CREATE OR REPLACE FUNCTION public.ar_receipts_after_reverse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE receipt_allocations
     SET reversed_at = NEW.reversed_at,
         reversed_by = NEW.reversed_by,
         reversal_reason = 'Receipt ' || NEW.receipt_number || ' reversed: ' || NEW.reversal_reason
   WHERE receipt_id = NEW.id AND reversed_at IS NULL;
  RETURN NULL;
END $$;

-- 8g. Keep payment_status in step with the balance
CREATE OR REPLACE FUNCTION public.ar_entries_sync_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    PERFORM ar_sync_invoice_status(NEW.invoice_id);
  END IF;
  RETURN NULL;
END $$;

-- 8h. Audit
CREATE OR REPLACE FUNCTION public.ar_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO ar_audit_events (practice_id, entity, entity_id, action, actor, details)
  VALUES (NEW.practice_id, TG_ARGV[0], NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'reversed' END, auth.uid(), to_jsonb(NEW));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.ar_audit_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The audit trail cannot be changed';
END $$;

-- Triggers fire in name order within each timing; the numbers keep the checks in a fixed order
DROP TRIGGER IF EXISTS ar_10_before_insert ON public.receipts;
CREATE TRIGGER ar_10_before_insert BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.ar_receipts_before_insert();
DROP TRIGGER IF EXISTS ar_20_reverse_only ON public.receipts;
CREATE TRIGGER ar_20_reverse_only BEFORE UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.ar_reverse_only();
DROP TRIGGER IF EXISTS ar_30_before_reverse ON public.receipts;
CREATE TRIGGER ar_30_before_reverse BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.ar_receipts_before_reverse();
DROP TRIGGER IF EXISTS ar_40_after_reverse ON public.receipts;
CREATE TRIGGER ar_40_after_reverse AFTER UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.ar_receipts_after_reverse();
DROP TRIGGER IF EXISTS ar_90_audit ON public.receipts;
CREATE TRIGGER ar_90_audit AFTER INSERT OR UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit('receipt');
DROP TRIGGER IF EXISTS ar_99_no_truncate ON public.receipts;
CREATE TRIGGER ar_99_no_truncate BEFORE TRUNCATE ON public.receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.ar_no_truncate();

DROP TRIGGER IF EXISTS ar_10_before_insert ON public.receipt_allocations;
CREATE TRIGGER ar_10_before_insert BEFORE INSERT ON public.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ar_allocations_before_insert();
DROP TRIGGER IF EXISTS ar_20_reverse_only ON public.receipt_allocations;
CREATE TRIGGER ar_20_reverse_only BEFORE UPDATE OR DELETE ON public.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ar_reverse_only();
DROP TRIGGER IF EXISTS ar_50_sync_status ON public.receipt_allocations;
CREATE TRIGGER ar_50_sync_status AFTER INSERT OR UPDATE ON public.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ar_entries_sync_status();
DROP TRIGGER IF EXISTS ar_90_audit ON public.receipt_allocations;
CREATE TRIGGER ar_90_audit AFTER INSERT OR UPDATE ON public.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit('allocation');
DROP TRIGGER IF EXISTS ar_99_no_truncate ON public.receipt_allocations;
CREATE TRIGGER ar_99_no_truncate BEFORE TRUNCATE ON public.receipt_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION public.ar_no_truncate();

DROP TRIGGER IF EXISTS ar_10_before_insert ON public.invoice_adjustments;
CREATE TRIGGER ar_10_before_insert BEFORE INSERT ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ar_adjustments_before_insert();
DROP TRIGGER IF EXISTS ar_20_reverse_only ON public.invoice_adjustments;
CREATE TRIGGER ar_20_reverse_only BEFORE UPDATE OR DELETE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ar_reverse_only();
DROP TRIGGER IF EXISTS ar_30_before_reverse ON public.invoice_adjustments;
CREATE TRIGGER ar_30_before_reverse BEFORE UPDATE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ar_adjustments_before_reverse();
DROP TRIGGER IF EXISTS ar_50_sync_status ON public.invoice_adjustments;
CREATE TRIGGER ar_50_sync_status AFTER INSERT OR UPDATE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ar_entries_sync_status();
DROP TRIGGER IF EXISTS ar_90_audit ON public.invoice_adjustments;
CREATE TRIGGER ar_90_audit AFTER INSERT OR UPDATE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit('adjustment');
DROP TRIGGER IF EXISTS ar_99_no_truncate ON public.invoice_adjustments;
CREATE TRIGGER ar_99_no_truncate BEFORE TRUNCATE ON public.invoice_adjustments
  FOR EACH STATEMENT EXECUTE FUNCTION public.ar_no_truncate();

DROP TRIGGER IF EXISTS ar_audit_append_only ON public.ar_audit_events;
CREATE TRIGGER ar_audit_append_only BEFORE UPDATE OR DELETE ON public.ar_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit_append_only();
DROP TRIGGER IF EXISTS ar_99_no_truncate ON public.ar_audit_events;
CREATE TRIGGER ar_99_no_truncate BEFORE TRUNCATE ON public.ar_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.ar_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 9. The old status menu (Manage invoices > change status) keeps working
--    paid       -> a receipt (source status_bridge) for whatever is still owed, dated today
--    unpaid     -> the status_bridge / legacy status receipts of that invoice are reversed; an
--                  invoice settled by other entries must be reversed in Finance instead
--    cancelled  -> refused while the invoice has entries (credit it in full instead)
--    A changed total or medical aid portion re-derives the status of an invoice with entries.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_invoice_status_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b          ar_invoice_balances%ROWTYPE;
  v_new      text := lower(btrim(COALESCE(NEW.payment_status, '')));
  v_old      text := CASE WHEN TG_OP = 'UPDATE' THEN lower(btrim(COALESCE(OLD.payment_status, ''))) ELSE '' END;
  v_owed     numeric(14,2);
  v_method   text;
  v_payer    text;
  v_fund     text;
  v_receipt  uuid;
  v_entries  text;
BEGIN
  IF current_setting('hpms.ar_internal', true) = 'on' OR NEW.practice_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' OR v_new IS DISTINCT FROM v_old THEN
    SELECT * INTO b FROM ar_invoice_balances WHERE invoice_id = NEW.id;

    IF ar_is_cancelled(v_new) THEN
      IF b.has_activity THEN
        RAISE EXCEPTION 'Invoice % has payments or adjustments recorded. Reverse them in Finance first, or credit the invoice in full with a credit note instead of cancelling it.', NEW.invoice_number;
      END IF;
      RETURN NULL;
    END IF;

    IF v_new = 'paid' THEN
      v_owed := GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0);
      IF v_owed > 0 THEN
        v_method := ar_receipt_method_from_text(NEW.payment_method);
        v_payer := CASE WHEN v_method = 'medical_aid' THEN 'medical_aid' WHEN NEW.patient_id IS NULL THEN 'other' ELSE 'patient' END;
        IF v_payer = 'medical_aid' THEN
          SELECT NULLIF(btrim(provider), '') INTO v_fund FROM medical_aid_details WHERE patient_id = NEW.patient_id LIMIT 1;
        END IF;
        INSERT INTO receipts (practice_id, payer_type, patient_id, fund_name, payer_name, method, amount, received_on, reference, source, notes)
        VALUES (NEW.practice_id, v_payer, NEW.patient_id,
                CASE WHEN v_payer = 'medical_aid' THEN COALESCE(v_fund, 'Medical aid (not recorded)') END,
                CASE WHEN v_payer = 'other' THEN 'Not recorded' END,
                v_method, v_owed, ar_today(), NEW.invoice_number, 'status_bridge',
                'Recorded when invoice ' || COALESCE(NEW.invoice_number, '') || ' was marked paid in the status menu')
        RETURNING id INTO v_receipt;
        IF b.medical_aid_outstanding > 0 THEN
          INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount)
          VALUES (NEW.practice_id, v_receipt, NEW.id, 'medical_aid', b.medical_aid_outstanding);
        END IF;
        IF b.patient_outstanding > 0 THEN
          INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount)
          VALUES (NEW.practice_id, v_receipt, NEW.id, 'patient', b.patient_outstanding);
        END IF;
      END IF;
    ELSIF v_old IN ('paid', 'partial') THEN
      UPDATE receipts r
         SET reversed_at = now(),
             reversed_by = auth.uid(),
             reversal_reason = 'Invoice ' || COALESCE(NEW.invoice_number, '') || ' was marked ' || v_new || ' in the status menu'
       WHERE r.reversed_at IS NULL
         AND (r.source = 'status_bridge' OR (r.source = 'legacy_backfill' AND r.external_ref LIKE 'legacy-status:%'))
         AND EXISTS (SELECT 1 FROM receipt_allocations a WHERE a.receipt_id = r.id AND a.invoice_id = NEW.id AND a.reversed_at IS NULL);
      SELECT string_agg(DISTINCT n, ', ') INTO v_entries FROM (
        SELECT r.receipt_number AS n FROM receipt_allocations a JOIN receipts r ON r.id = a.receipt_id
         WHERE a.invoice_id = NEW.id AND a.reversed_at IS NULL AND r.reversed_at IS NULL
        UNION ALL
        SELECT d.adjustment_number FROM invoice_adjustments d WHERE d.invoice_id = NEW.id AND d.reversed_at IS NULL
      ) entries;
      IF v_entries IS NOT NULL THEN
        RAISE EXCEPTION 'Invoice % is settled by % recorded in Finance. Reverse them there to mark it unpaid.', NEW.invoice_number, v_entries;
      END IF;
      -- Reversing those receipts re-derived the status on the way; the status staff chose applies again
      PERFORM set_config('hpms.ar_internal', 'on', true);
      UPDATE invoices_enhanced SET payment_status = NEW.payment_status, payment_method = NEW.payment_method
       WHERE id = NEW.id AND (payment_status IS DISTINCT FROM NEW.payment_status OR payment_method IS DISTINCT FROM NEW.payment_method);
      PERFORM set_config('hpms.ar_internal', 'off', true);
      RETURN NULL;
    END IF;
  END IF;

  PERFORM ar_sync_invoice_status(NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS ar_invoice_status_bridge ON public.invoices_enhanced;
CREATE TRIGGER ar_invoice_status_bridge
  AFTER INSERT OR UPDATE OF payment_status, total, medical_aid_total ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.ar_invoice_status_bridge();

-- An invoice with payment history is never deleted (the foreign keys refuse it too; this says why
-- in words staff understand, where the delete button shows the database's message)
CREATE OR REPLACE FUNCTION public.ar_invoice_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM receipt_allocations WHERE invoice_id = OLD.id)
     OR EXISTS (SELECT 1 FROM invoice_adjustments WHERE invoice_id = OLD.id) THEN
    RAISE EXCEPTION 'Invoice % has payment history (receipts or adjustments, including reversed ones), so it is kept. Cancel it instead, or credit it in full with a credit note.', OLD.invoice_number;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS ar_invoice_delete_guard ON public.invoices_enhanced;
CREATE TRIGGER ar_invoice_delete_guard
  BEFORE DELETE ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.ar_invoice_delete_guard();

-- ---------------------------------------------------------------------------------------------
-- 10. RPCs (the only way to write). Each checks that the caller belongs to the practice.
-- ---------------------------------------------------------------------------------------------

-- Allocations of a payload: [{ "invoice_id", "portion", "amount", "external_ref"? }]
CREATE OR REPLACE FUNCTION public.ar_insert_allocations(p_practice_id uuid, p_receipt_id uuid, p_lines jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line  jsonb;
  v_count integer := 0;
BEGIN
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) LOOP
    INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount, external_ref)
    VALUES (p_practice_id, p_receipt_id, (v_line->>'invoice_id')::uuid, v_line->>'portion',
            ar_amount(v_line->'amount'), NULLIF(btrim(v_line->>'external_ref'), ''));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- One adjustment from a payload; write-offs are approved by the caller (admin or doctor)
CREATE OR REPLACE FUNCTION public.ar_insert_adjustment(p_practice_id uuid, p_kind text, p_line jsonb, p_default_date date)
RETURNS public.invoice_adjustments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row invoice_adjustments%ROWTYPE;
BEGIN
  IF p_kind = 'write_off' AND NOT ar_is_approver(p_practice_id) THEN
    RAISE EXCEPTION 'Only a practice admin or doctor can approve a write-off' USING ERRCODE = '42501';
  END IF;
  INSERT INTO invoice_adjustments (
    practice_id, kind, invoice_id, receipt_id, portion, amount, method, reason_code, reason,
    approved_by, effective_on, external_ref
  ) VALUES (
    p_practice_id,
    p_kind,
    NULLIF(p_line->>'invoice_id', '')::uuid,
    NULLIF(p_line->>'receipt_id', '')::uuid,
    CASE WHEN p_kind = 'shortfall_transfer' THEN 'medical_aid' WHEN p_kind = 'refund' THEN NULL ELSE p_line->>'portion' END,
    ar_amount(p_line->'amount'),
    CASE WHEN p_kind = 'refund' THEN p_line->>'method' END,
    NULLIF(btrim(p_line->>'reason_code'), ''),
    COALESCE(NULLIF(btrim(p_line->>'reason'), ''),
             CASE WHEN p_kind = 'shortfall_transfer' THEN 'The medical aid paid less than claimed; the rest is for the patient' END),
    CASE WHEN p_kind = 'write_off' THEN auth.uid() END,
    COALESCE(NULLIF(p_line->>'effective_on', '')::date, p_default_date, ar_today()),
    NULLIF(btrim(p_line->>'external_ref'), '')
  ) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

/*
  ar_post_receipt(payload): a receipt with its allocations, shortfall transfers and write-offs, all or nothing.
  {
    "practice_id": uuid, "payer_type": "patient" | "medical_aid" | "other",
    "patient_id": uuid?, "fund_name": text?, "payer_name": text?,
    "method": "cash" | "card" | "eft" | "medical_aid" | "debit_order",
    "amount": 500.00, "received_on": "2026-10-07"?, "reference": text?, "notes": text?,
    "source": "manual" | "batch" | "remittance_import"?, "external_ref": text?,
    "allocations": [{ "invoice_id", "portion", "amount", "external_ref"? }],
    "shortfalls":  [{ "invoice_id", "amount", "reason"?, "reason_code"?, "external_ref"? }],
    "write_offs":  [{ "invoice_id", "portion", "amount", "reason_code", "reason", "external_ref"? }]
  }
  Returns { receipt_id, receipt_number, duplicate, allocated, unallocated, adjustments: [{ id, number, kind }] }.
  The same external_ref (per practice and source) returns the first receipt with duplicate = true.
*/
CREATE OR REPLACE FUNCTION public.ar_post_receipt(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload->>'practice_id', '')::uuid;
  v_source   text := COALESCE(NULLIF(p_payload->>'source', ''), 'manual');
  v_external text := NULLIF(btrim(COALESCE(p_payload->>'external_ref', '')), '');
  v_receipt  receipts%ROWTYPE;
  v_adj      invoice_adjustments%ROWTYPE;
  v_adjs     jsonb := '[]'::jsonb;
  v_line     jsonb;
  v_balance  ar_receipt_balances%ROWTYPE;
  v_date     date := COALESCE(NULLIF(p_payload->>'received_on', '')::date, ar_today());
BEGIN
  PERFORM ar_assert_member(v_practice);
  IF v_source NOT IN ('manual', 'batch', 'remittance_import') THEN
    RAISE EXCEPTION 'source must be manual, batch or remittance_import';
  END IF;
  IF COALESCE(p_payload->>'payer_type', '') NOT IN ('patient', 'medical_aid', 'other') THEN
    RAISE EXCEPTION 'Choose who paid: a patient, a medical aid fund or someone else';
  END IF;
  IF COALESCE(p_payload->>'method', '') NOT IN ('cash', 'card', 'eft', 'medical_aid', 'debit_order') THEN
    RAISE EXCEPTION 'Choose how it was paid: cash, card, EFT, debit order or medical aid';
  END IF;
  IF v_date > ar_today() THEN
    RAISE EXCEPTION 'A receipt cannot be dated in the future';
  END IF;

  IF v_external IS NOT NULL THEN
    SELECT * INTO v_receipt FROM receipts WHERE practice_id = v_practice AND source = v_source AND external_ref = v_external;
    IF FOUND THEN
      SELECT * INTO v_balance FROM ar_receipt_balances WHERE receipt_id = v_receipt.id;
      RETURN jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'duplicate', true,
                                'allocated', v_balance.allocated, 'unallocated', v_balance.unallocated, 'adjustments', '[]'::jsonb);
    END IF;
  END IF;

  INSERT INTO receipts (practice_id, payer_type, patient_id, fund_name, payer_name, method, amount, received_on,
                        reference, external_ref, source, notes)
  VALUES (v_practice, p_payload->>'payer_type', NULLIF(p_payload->>'patient_id', '')::uuid, p_payload->>'fund_name',
          p_payload->>'payer_name', p_payload->>'method', ar_amount(p_payload->'amount'),
          v_date, NULLIF(btrim(p_payload->>'reference'), ''),
          v_external, v_source, NULLIF(btrim(p_payload->>'notes'), ''))
  RETURNING * INTO v_receipt;

  PERFORM ar_insert_allocations(v_practice, v_receipt.id, p_payload->'allocations');

  -- After the allocations: a shortfall may only move what the fund still owes
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'shortfalls', '[]'::jsonb)) LOOP
    v_adj := ar_insert_adjustment(v_practice, 'shortfall_transfer', v_line, v_receipt.received_on);
    v_adjs := v_adjs || jsonb_build_object('id', v_adj.id, 'number', v_adj.adjustment_number, 'kind', v_adj.kind);
  END LOOP;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'write_offs', '[]'::jsonb)) LOOP
    v_adj := ar_insert_adjustment(v_practice, 'write_off', v_line, v_receipt.received_on);
    v_adjs := v_adjs || jsonb_build_object('id', v_adj.id, 'number', v_adj.adjustment_number, 'kind', v_adj.kind);
  END LOOP;

  SELECT * INTO v_balance FROM ar_receipt_balances WHERE receipt_id = v_receipt.id;
  RETURN jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'duplicate', false,
                            'allocated', v_balance.allocated, 'unallocated', v_balance.unallocated, 'adjustments', v_adjs);
END $$;

-- Allocate (part of) a receipt's unallocated credit later, e.g. suspense money once it is matched
CREATE OR REPLACE FUNCTION public.ar_allocate_receipt(p_receipt_id uuid, p_allocations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
  v_balance  ar_receipt_balances%ROWTYPE;
BEGIN
  SELECT practice_id INTO v_practice FROM receipts WHERE id = p_receipt_id;
  PERFORM ar_assert_member(v_practice);
  PERFORM ar_insert_allocations(v_practice, p_receipt_id, p_allocations);
  SELECT * INTO v_balance FROM ar_receipt_balances WHERE receipt_id = p_receipt_id;
  RETURN jsonb_build_object('receipt_id', p_receipt_id, 'receipt_number', v_balance.receipt_number,
                            'allocated', v_balance.allocated, 'unallocated', v_balance.unallocated);
END $$;

/*
  ar_post_adjustment(payload) for one invoice or receipt:
  { "practice_id", "kind": "credit_note" | "write_off" | "journal" | "refund" | "shortfall_transfer",
    "invoice_id"? (all but refund), "receipt_id"? (refund), "portion"? (credit_note, write_off, journal),
    "amount" (journal: negative takes off, positive adds), "method"? (refund: cash, card, eft, debit_order),
    "reason_code"? (write_off: required), "reason", "effective_on"?, "external_ref"? }
  Returns { id, number, kind }.
*/
CREATE OR REPLACE FUNCTION public.ar_post_adjustment(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload->>'practice_id', '')::uuid;
  v_kind     text := p_payload->>'kind';
  v_adj      invoice_adjustments%ROWTYPE;
BEGIN
  PERFORM ar_assert_member(v_practice);
  IF v_kind NOT IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer') THEN
    RAISE EXCEPTION 'Unknown adjustment kind %', v_kind;
  END IF;
  IF NULLIF(p_payload->>'effective_on', '')::date > ar_today() THEN
    RAISE EXCEPTION 'An adjustment cannot be dated in the future';
  END IF;
  v_adj := ar_insert_adjustment(v_practice, v_kind, p_payload, ar_today());
  RETURN jsonb_build_object('id', v_adj.id, 'number', v_adj.adjustment_number, 'kind', v_adj.kind);
END $$;

CREATE OR REPLACE FUNCTION public.ar_reverse_receipt(p_receipt_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_receipt receipts%ROWTYPE;
BEGIN
  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id;
  PERFORM ar_assert_member(v_receipt.practice_id);
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why the receipt is reversed';
  END IF;
  UPDATE receipts SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
   WHERE id = p_receipt_id;
  RETURN jsonb_build_object('receipt_id', p_receipt_id, 'receipt_number', v_receipt.receipt_number, 'reversed', true);
END $$;

CREATE OR REPLACE FUNCTION public.ar_reverse_allocation(p_allocation_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT practice_id INTO v_practice FROM receipt_allocations WHERE id = p_allocation_id;
  PERFORM ar_assert_member(v_practice);
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why the allocation is reversed';
  END IF;
  UPDATE receipt_allocations SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
   WHERE id = p_allocation_id;
  RETURN jsonb_build_object('allocation_id', p_allocation_id, 'reversed', true);
END $$;

CREATE OR REPLACE FUNCTION public.ar_reverse_adjustment(p_adjustment_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_adj invoice_adjustments%ROWTYPE;
BEGIN
  SELECT * INTO v_adj FROM invoice_adjustments WHERE id = p_adjustment_id;
  PERFORM ar_assert_member(v_adj.practice_id);
  IF v_adj.kind = 'write_off' AND NOT ar_is_approver(v_adj.practice_id) THEN
    RAISE EXCEPTION 'Only a practice admin or doctor can reverse a write-off' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why it is reversed';
  END IF;
  UPDATE invoice_adjustments SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
   WHERE id = p_adjustment_id;
  RETURN jsonb_build_object('id', p_adjustment_id, 'number', v_adj.adjustment_number, 'reversed', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 11. Row level security and grants
--     Read: members of the practice. Write: only through the RPCs above.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_allocations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_audit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_select ON public.receipts;
CREATE POLICY receipts_select ON public.receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = receipts.practice_id));

DROP POLICY IF EXISTS receipt_allocations_select ON public.receipt_allocations;
CREATE POLICY receipt_allocations_select ON public.receipt_allocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = receipt_allocations.practice_id));

DROP POLICY IF EXISTS invoice_adjustments_select ON public.invoice_adjustments;
CREATE POLICY invoice_adjustments_select ON public.invoice_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = invoice_adjustments.practice_id));

DROP POLICY IF EXISTS ar_audit_events_select ON public.ar_audit_events;
CREATE POLICY ar_audit_events_select ON public.ar_audit_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = ar_audit_events.practice_id));

-- No policies on ar_document_counters: only ar_next_document_number() touches it

REVOKE ALL ON public.receipts, public.receipt_allocations, public.invoice_adjustments, public.ar_audit_events, public.ar_document_counters
  FROM anon, authenticated;
GRANT SELECT ON public.receipts, public.receipt_allocations, public.invoice_adjustments, public.ar_audit_events TO authenticated;
GRANT SELECT ON public.ar_invoice_balances, public.ar_invoice_portion_balances, public.ar_receipt_balances, public.ar_patient_balances
  TO authenticated;
REVOKE ALL ON public.ar_invoice_balances, public.ar_invoice_portion_balances, public.ar_receipt_balances, public.ar_patient_balances
  FROM anon;

-- Internal functions are not callable from the API
REVOKE ALL ON FUNCTION public.ar_next_document_number(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_sync_invoice_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_insert_allocations(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_insert_adjustment(uuid, text, jsonb, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_assert_member(uuid) FROM PUBLIC, anon, authenticated;

-- The API
REVOKE ALL ON FUNCTION public.ar_post_receipt(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_allocate_receipt(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_post_adjustment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_reverse_receipt(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_reverse_allocation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_reverse_adjustment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ar_is_approver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ar_post_receipt(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_allocate_receipt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_post_adjustment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_reverse_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_reverse_allocation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_reverse_adjustment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ar_is_approver(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 12. Legacy payments
--     12a. payment_records (the old per-invoice payment table, if it exists) become LEG- receipts
--          with their own dates; money beyond what the invoice owes stays unallocated for review.
--     12b. Invoices marked paid with nothing (or not everything) received get one LEG- receipt
--          for what is still owed, dated the day the invoice was last updated (the date Finance
--          uses for these payments today), with the method recorded on the invoice.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_import_payment_records(p_practice_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         record;
  v_receipt uuid;
  v_payer   text;
  v_left    numeric(14,2);
  v_part    numeric(14,2);
  v_portion text;
  v_count   integer := 0;
BEGIN
  IF to_regclass('public.payment_records') IS NULL THEN
    RETURN 0;
  END IF;
  FOR r IN EXECUTE $q$
    SELECT pr.id, pr.amount, pr.payment_method, pr.payment_date, pr.reference, pr.notes, pr.processed_by,
           i.id AS invoice_id, i.practice_id, i.patient_id, i.invoice_number
    FROM public.payment_records pr
    JOIN public.invoices_enhanced i ON i.id = pr.invoice_id
    WHERE i.practice_id IS NOT NULL AND ($1 IS NULL OR i.practice_id = $1) AND COALESCE(pr.amount, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM public.receipts x WHERE x.practice_id = i.practice_id AND x.source = 'legacy_backfill'
                      AND x.external_ref = 'payment-records:' || pr.id::text)
    ORDER BY pr.payment_date, pr.id
  $q$ USING p_practice_id
  LOOP
    v_payer := CASE WHEN ar_receipt_method_from_text(r.payment_method) = 'medical_aid' THEN 'medical_aid'
                    WHEN r.patient_id IS NULL THEN 'other' ELSE 'patient' END;
    INSERT INTO receipts (practice_id, payer_type, patient_id, fund_name, payer_name, method, amount, received_on, reference, external_ref, source, notes)
    VALUES (r.practice_id,
            v_payer,
            r.patient_id,
            CASE WHEN v_payer = 'medical_aid' THEN
              COALESCE((SELECT NULLIF(btrim(m.provider), '') FROM medical_aid_details m WHERE m.patient_id = r.patient_id LIMIT 1), 'Medical aid (not recorded)')
            END,
            CASE WHEN v_payer = 'other' THEN 'Not recorded' END,
            ar_receipt_method_from_text(r.payment_method),
            round(r.amount::numeric, 2),
            COALESCE((r.payment_date AT TIME ZONE 'Africa/Windhoek')::date, ar_today()),
            COALESCE(NULLIF(btrim(r.reference), ''), r.invoice_number),
            'payment-records:' || r.id::text,
            'legacy_backfill',
            concat_ws('. ', 'Imported from payment_records', NULLIF(btrim(r.notes), ''), 'Processed by ' || NULLIF(btrim(r.processed_by), '')))
    RETURNING id INTO v_receipt;
    -- Patient payments reduce the patient portion first, then the medical aid portion; medical aid
    -- payments the other way round. Whatever is left stays unallocated for review.
    v_left := round(r.amount::numeric, 2);
    FOREACH v_portion IN ARRAY CASE WHEN ar_receipt_method_from_text(r.payment_method) = 'medical_aid'
                                    THEN ARRAY['medical_aid', 'patient'] ELSE ARRAY['patient', 'medical_aid'] END LOOP
      v_part := LEAST(v_left, GREATEST(COALESCE(ar_portion_outstanding(r.invoice_id, v_portion), 0), 0));
      IF v_part > 0 THEN
        INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount)
        VALUES (r.practice_id, v_receipt, r.invoice_id, v_portion, v_part);
        v_left := v_left - v_part;
      END IF;
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.ar_backfill_paid_invoices(p_practice_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         record;
  v_method  text;
  v_payer   text;
  v_receipt uuid;
  v_count   integer := 0;
BEGIN
  FOR r IN
    SELECT i.id, i.practice_id, i.patient_id, i.invoice_number, i.payment_method, i.updated_at, i.issue_date,
           b.medical_aid_outstanding, b.patient_outstanding
    FROM invoices_enhanced i
    JOIN ar_invoice_balances b ON b.invoice_id = i.id
    WHERE i.practice_id IS NOT NULL AND (p_practice_id IS NULL OR i.practice_id = p_practice_id)
      AND lower(btrim(COALESCE(i.payment_status, ''))) = 'paid'
      AND GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0) > 0
    ORDER BY i.practice_id, i.updated_at NULLS FIRST, i.id
  LOOP
    v_method := ar_receipt_method_from_text(r.payment_method);
    v_payer := CASE WHEN v_method = 'medical_aid' THEN 'medical_aid' WHEN r.patient_id IS NULL THEN 'other' ELSE 'patient' END;
    INSERT INTO receipts (practice_id, payer_type, patient_id, fund_name, payer_name, method, amount, received_on, reference, external_ref, source, notes)
    VALUES (r.practice_id, v_payer, r.patient_id,
            CASE WHEN v_payer = 'medical_aid' THEN
              COALESCE((SELECT NULLIF(btrim(m.provider), '') FROM medical_aid_details m WHERE m.patient_id = r.patient_id LIMIT 1), 'Medical aid (not recorded)')
            END,
            CASE WHEN v_payer = 'other' THEN 'Not recorded' END,
            v_method,
            GREATEST(r.medical_aid_outstanding, 0) + GREATEST(r.patient_outstanding, 0),
            COALESCE((r.updated_at AT TIME ZONE 'Africa/Windhoek')::date, r.issue_date, ar_today()),
            r.invoice_number,
            'legacy-status:' || r.id::text,
            'legacy_backfill',
            'Invoice was marked paid before receipts were recorded; dated the day the invoice was last updated')
    RETURNING id INTO v_receipt;
    IF r.medical_aid_outstanding > 0 THEN
      INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount)
      VALUES (r.practice_id, v_receipt, r.id, 'medical_aid', r.medical_aid_outstanding);
    END IF;
    IF r.patient_outstanding > 0 THEN
      INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount)
      VALUES (r.practice_id, v_receipt, r.id, 'patient', r.patient_outstanding);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.ar_import_payment_records(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_backfill_paid_invoices(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 13. Run the backfill for every practice (one-off; both functions are safe to run again)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_records integer;
  v_paid    integer;
BEGIN
  -- Statuses stay as staff set them while the old payments go in (otherwise a paid invoice that
  -- payment_records only part-covers would turn 'partial' before step two settles the rest)
  PERFORM set_config('hpms.ar_backfill', 'on', true);
  v_records := public.ar_import_payment_records(NULL);
  v_paid := public.ar_backfill_paid_invoices(NULL);
  PERFORM set_config('hpms.ar_backfill', 'off', true);
  -- Invoices that only payment_records paid (in part) now follow their balance
  PERFORM public.ar_sync_invoice_status(b.invoice_id)
     FROM public.ar_invoice_balances b
    WHERE b.has_entries
      AND EXISTS (SELECT 1 FROM public.receipt_allocations a JOIN public.receipts r ON r.id = a.receipt_id
                  WHERE a.invoice_id = b.invoice_id AND r.external_ref LIKE 'payment-records:%');
  RAISE NOTICE 'Section 13: % payment_records rows and % invoices marked paid became legacy (LEG-) receipts.', v_records, v_paid;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 14. Consistency checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.ar_invoice_balances b
   WHERE b.practice_id IS NOT NULL AND lower(btrim(COALESCE(b.payment_status, ''))) = 'paid'
     AND GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0) > 0;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Check failed: % invoices are marked paid but still owe money', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.ar_receipt_balances WHERE unallocated < 0;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Check failed: % receipts have more allocated or refunded than received', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.ar_invoice_balances b
   WHERE b.has_entries AND b.payment_status IS DISTINCT FROM public.ar_derive_payment_status(
     b.payment_status, b.due_date, b.has_entries,
     GREATEST(b.medical_aid_outstanding, 0) + GREATEST(b.patient_outstanding, 0), b.medical_aid_allocated + b.patient_allocated);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Check failed: % invoices have a payment_status that does not match their balance', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.ar_receipt_balances WHERE unallocated > 0;
  RAISE NOTICE 'Section 14: checks passed. % receipts have unallocated money to review (Finance > Payments).', v_count;
END $$;

-- PostgREST: pick up the new tables, views and functions
NOTIFY pgrst, 'reload schema';

-- Undo after a COMMIT (only while nothing depends on the entries; receipts are money records):
--   DROP TRIGGER IF EXISTS ar_invoice_status_bridge ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS ar_invoice_delete_guard ON public.invoices_enhanced;
--   DROP VIEW IF EXISTS public.ar_patient_balances, public.ar_receipt_balances, public.ar_invoice_portion_balances, public.ar_invoice_balances;
--   DROP TABLE IF EXISTS public.ar_audit_events, public.invoice_adjustments, public.receipt_allocations, public.receipts, public.ar_document_counters;
--   DROP FUNCTION IF EXISTS public.ar_post_receipt(jsonb), public.ar_allocate_receipt(uuid, jsonb), public.ar_post_adjustment(jsonb),
--     public.ar_reverse_receipt(uuid, text), public.ar_reverse_allocation(uuid, text), public.ar_reverse_adjustment(uuid, text), ...;
--   Invoices whose status became 'partial' go back to 'pending':
--   UPDATE public.invoices_enhanced SET payment_status = 'pending' WHERE payment_status = 'partial';
--   The 'partial' value can stay in the payment_status check.

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
