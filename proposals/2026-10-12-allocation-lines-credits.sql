-- Applied 2026-10-12 as migration allocation_lines_credits_2026_10_12 (version 20261012152816; stored statement md5 9d2a79ed507ab196928e3f99d652e949 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: ar_split_allocation_over_lines 49aa9f72d9d2b0ade4975ffe0a229904, ar_insert_allocation_lines 914ae61e3cf4fce82b5bc208ddd2d6ef.
-- Rehearsed (rolled back) with simulated logins: a receptionist credited the oldest line of a private invoice in full
-- (credit_note_post_lines); the line then showed nothing unpaid, an automatic payment went to the other line, choosing the
-- credited line was refused; another practice saw none of the lines and anon was refused the view. After applying, a 40%
-- credit (rolled back) left only the rest to pay on the line, one cent more was refused, and an automatic payment of the
-- rest plus N$ 1.00 put the rest on that line and N$ 1.00 on the next.
-- =============================================================================================
-- PROPOSAL: what a payment covers leaves out what a credit note already took off a line
-- File:   proposals/2026-10-12-allocation-lines-credits.sql              Drafted: 2026-10-12
-- Code:   src/services/ledger/allocationLines.ts (InvoiceLineOpen.credited; suggestLineSplit and lineRoomCents
--         subtract it: the same rule as here, tested), src/components/finance/receipts/arService.ts (reads the columns)
--
-- Why (parity H2, after D24): proposals/2026-10-09-claim-corrections.sql (applied after the allocation lines) credits
-- chosen invoice lines (credit_note_lines). ar_invoice_line_balances still counted a credited line as unpaid, so a
-- later payment could be split onto a line that was credited (the receipt would say it paid a service the practice
-- took off the invoice), and Receive payment offered that line.
--
-- What it does (no table, policy or allocation is changed; existing allocation lines stay as they are)
--   1. ar_invoice_line_balances: two more columns at the end, medical_aid_credited and patient_credited (credit
--      note lines whose credit note is not reversed), and unpaid = billed - paid - credited.
--   2. ar_split_allocation_over_lines (the automatic split) and ar_insert_allocation_lines (lines chosen by staff):
--      a line's own portion still open also subtracts that portion's credits. Each is the live definition with that
--      one expression replaced (found exactly once, or nothing changes); every other check stays.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Section 3 checks the result.
-- Undo: ar_invoice_line_balances, ar_split_allocation_over_lines and ar_insert_allocation_lines as in
--   proposals/2026-10-09-allocation-lines.sql (DROP VIEW first: a view's columns cannot be removed by REPLACE).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions: the allocation lines and the credit note lines
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.receipt_allocation_lines') IS NULL OR to_regclass('public.ar_invoice_line_balances') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-09-allocation-lines.sql first';
  END IF;
  IF to_regclass('public.credit_note_lines') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-09-claim-corrections.sql first (credit_note_lines)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. ar_invoice_line_balances: credits per portion, and unpaid after them
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ar_invoice_line_balances WITH (security_invoker = true) AS
SELECT s.id AS invoice_line_id,
       s.invoice_id,
       i.practice_id,
       i.patient_id,
       s.code,
       s.description,
       COALESCE(s.service_date, i.issue_date) AS line_date,
       s.system_transaction_number AS line_order,
       round(COALESCE(s.total_price, 0)::numeric, 2) AS billed,
       round(COALESCE(s.medical_aid_covered, 0)::numeric, 2) AS medical_aid_billed,
       round(COALESCE(s.patient_portion, 0)::numeric, 2) AS patient_billed,
       COALESCE(p.medical_aid_paid, 0) AS medical_aid_paid,
       COALESCE(p.patient_paid, 0) AS patient_paid,
       round(COALESCE(s.total_price, 0)::numeric, 2) - COALESCE(p.medical_aid_paid, 0) - COALESCE(p.patient_paid, 0)
         - COALESCE(c.medical_aid_credited, 0) - COALESCE(c.patient_credited, 0) AS unpaid,
       COALESCE(c.medical_aid_credited, 0) AS medical_aid_credited,
       COALESCE(c.patient_credited, 0) AS patient_credited
FROM public.invoice_services s
JOIN public.invoices_enhanced i ON i.id = s.invoice_id
LEFT JOIN LATERAL (
  SELECT SUM(l.amount) FILTER (WHERE l.portion = 'medical_aid') AS medical_aid_paid,
         SUM(l.amount) FILTER (WHERE l.portion = 'patient') AS patient_paid
  FROM public.receipt_allocation_lines l
  JOIN public.receipt_allocations a ON a.id = l.allocation_id
  JOIN public.receipts r ON r.id = a.receipt_id
  WHERE l.invoice_line_id = s.id AND a.reversed_at IS NULL AND r.reversed_at IS NULL
) p ON true
LEFT JOIN LATERAL (
  SELECT SUM(cn.amount) FILTER (WHERE cn.portion = 'medical_aid') AS medical_aid_credited,
         SUM(cn.amount) FILTER (WHERE cn.portion = 'patient') AS patient_credited
  FROM public.credit_note_lines cn
  JOIN public.invoice_adjustments ad ON ad.id = cn.adjustment_id
  WHERE cn.invoice_id = s.invoice_id AND cn.invoice_line_id = s.id AND ad.reversed_at IS NULL
) c ON true;
COMMENT ON VIEW public.ar_invoice_line_balances IS
  'Per invoice line: billed per portion, paid per portion (allocation lines that still stand), credited per portion (credit note lines that still stand) and unpaid (billed less paid and credited, both portions).';

-- The view keeps the caller's rights and its grants (REPLACE keeps them); nothing for the public key
REVOKE ALL ON public.ar_invoice_line_balances FROM anon;

-- ---------------------------------------------------------------------------------------------
-- 2. The split and the chosen lines: a portion's own part still open subtracts its credits
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old text := $old$CASE v_alloc.portion WHEN 'medical_aid' THEN b.medical_aid_billed - b.medical_aid_paid ELSE b.patient_billed - b.patient_paid END AS portion_unpaid$old$;
  v_new text := $new$CASE v_alloc.portion WHEN 'medical_aid' THEN b.medical_aid_billed - b.medical_aid_paid - b.medical_aid_credited ELSE b.patient_billed - b.patient_paid - b.patient_credited END AS portion_unpaid$new$;
BEGIN
  SELECT pg_get_functiondef('public.ar_split_allocation_over_lines(uuid,text)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'ar_split_allocation_over_lines: the portion still open was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

DO $migration$
DECLARE
  v_def text;
  v_old text := $old$v_room := LEAST(v_room, GREATEST(b.medical_aid_billed - b.medical_aid_paid, 0));$old$;
  v_new text := $new$v_room := LEAST(v_room, GREATEST(b.medical_aid_billed - b.medical_aid_paid - b.medical_aid_credited, 0));$new$;
BEGIN
  SELECT pg_get_functiondef('public.ar_insert_allocation_lines(uuid,jsonb)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'ar_insert_allocation_lines: the fund''s part still open was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad integer;
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ar_invoice_line_balances' AND column_name IN ('medical_aid_credited', 'patient_credited')) <> 2 THEN
    RAISE EXCEPTION 'Check failed: ar_invoice_line_balances has no credit columns';
  END IF;
  IF position('b.patient_billed - b.patient_paid - b.patient_credited' in pg_get_functiondef('public.ar_split_allocation_over_lines(uuid,text)'::regprocedure)) = 0
     OR position('b.medical_aid_billed - b.medical_aid_paid - b.medical_aid_credited' in pg_get_functiondef('public.ar_insert_allocation_lines(uuid,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: the split or the chosen lines still ignore credit notes';
  END IF;
  -- Still the same lines for every allocation (nothing was rewritten)
  SELECT count(*) INTO v_bad
    FROM receipt_allocations ra
    LEFT JOIN (SELECT allocation_id, SUM(amount) AS total FROM receipt_allocation_lines GROUP BY allocation_id) l ON l.allocation_id = ra.id
   WHERE l.total IS DISTINCT FROM ra.amount;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Check failed: the lines of % allocations do not add up to the allocation', v_bad;
  END IF;
  IF has_table_privilege('anon', 'public.ar_invoice_line_balances', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.ar_invoice_line_balances', 'SELECT')
     OR has_function_privilege('authenticated', 'public.ar_split_allocation_over_lines(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ar_insert_allocation_lines(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the rights on the line balances or the internal functions changed';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
