-- Applied 2026-10-12 as migration finance_reports_stored_practitioner_2026_10_12 (version 20261012201720; stored statement md5 2df2a8a80bbef522c6b79bf4376a9e8e = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed), the second version (see "Versions"); the first went in as finance_reports_2026_10_12 (version 20261012191311, md5 da2cbee62f76c05ad903b2463f238f62).
-- Live prosrc md5 of report_cash_by_practitioner afterwards 2fbfd4579aa5095547ae5051b859c6bf (SECURITY DEFINER; anon cannot run it).
-- Rehearsed with simulated logins (rolled back), both versions: anon and another practice's doctor refused (42501); a
-- reversed period and three years refused (22023); the practice's receptionist got 2,517 rows for the 2,517 standing
-- receipts of two years, every receipt's parts adding up to its amount, the total equal to the receipts, no unknown
-- basis, no practitioner on unallocated or refunded money; second version: every receipt and practitioner equal to the
-- stored allocation lines (0 differences), and a colleague made the line's practitioner after it was paid got none of
-- its money (it stays with whom it paid, as the receipt says).
-- =============================================================================================
-- PROPOSAL: money received per practitioner, by the day it was received (parity R7, Finance > Reports)
-- File:   proposals/2026-10-12-finance-reports.sql                         Drafted: 2026-10-12
-- Code:   src/components/finance/practiceReports/CashByPractitionerReport.tsx (the report),
--         src/components/finance/practiceReports/cashByPractitioner.ts (totals per practitioner and method; tested),
--         src/components/finance/practiceReports/practiceReportsService.ts (loadCashParts)
--
-- Why (parity R7, H4): doctor productivity's "Collected" follows the invoice date, so nothing said how much money came
-- in for each practitioner on the days it came in. One receipt can pay invoices of several practitioners, so the money
-- is split by what it paid: each allocation's lines (receipt_allocation_lines, proposals/2026-10-09-allocation-lines.sql)
-- carry the practitioner of the line they paid, stored when the payment was allocated
-- (receipt_allocation_lines.practitioner_id, proposals/2026-10-12-allocation-practitioner.sql: the invoice line's own
-- practitioner, else the invoice's, the rule claims use). The report sums that stored practitioner, so it always names
-- the same practitioner as the receipt does, even if an invoice's practitioner is changed after it was paid. Doing that
-- in the browser would read every receipt, allocation and allocation line of the period; this function returns one row
-- per receipt and practitioner instead.
--
-- What it does (read only; nothing is written, no table or policy changes)
--   1. report_cash_by_practitioner(practice, from, to): every receipt received from `from` to `to` (received_on,
--      inclusive; at most two years) that is not reversed (reversed receipts never count, as in Daily takings),
--      split into
--        'line'         money allocated to an invoice line, for the practitioner stored with it (NULL: none was);
--        'invoice'      money allocated to the invoice but none of its lines, for the practitioner stored with it, and
--                       an allocation's money on none of its lines (none recorded): the invoice's practitioner;
--        'unallocated'  money still on the receipt (credit not allocated yet), practitioner NULL;
--        'refunded'     money paid back from the receipt (standing refunds), practitioner NULL.
--      A receipt's parts add up to its amount (allocated + refunded + unallocated, as ar_receipt_balances says).
--   Who may call it: staff of the practice who may open Finance (claim_assert_staff: administrators always, other
--   roles as Settings > Users > Screen access says). The public key may not (no grant, 42501).
--
-- Versions: the first version (migration finance_reports_2026_10_12, version 20261012191311, stored statement md5
-- da2cbee62f76c05ad903b2463f238f62) worked the practitioner out when the report ran (the line's own, else the
-- invoice's). Once allocation-practitioner stored it with every part of a payment, this file was changed to read the
-- stored one (one rule for the receipt and the report) and applied again; on the day both gave the same figures (the
-- 11,768 stored practitioners all equalled the rule).
-- Needs: receipts-and-allocations (receipts, receipt_allocations, ar_receipt_balances), allocation-lines
-- (receipt_allocation_lines), allocation-practitioner (receipt_allocation_lines.practitioner_id), claim-corrections
-- (claim_assert_staff).
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration (the file can be applied again). Until then the report says it is not set up yet.
-- Undo:  DROP FUNCTION IF EXISTS public.report_cash_by_practitioner(uuid, date, date);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: what this file reads, as it was on 2026-10-12
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.receipt_allocation_lines') IS NULL OR to_regclass('public.ar_receipt_balances') IS NULL THEN
    RAISE EXCEPTION 'Check failed: receipts and allocation lines are not set up (receipts-and-allocations, allocation-lines)';
  END IF;
  IF to_regprocedure('public.claim_assert_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Check failed: claim_assert_staff(uuid) is missing (claim-corrections)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'receipt_allocation_lines' AND column_name = 'practitioner_id') THEN
    RAISE EXCEPTION 'Check failed: receipt_allocation_lines.practitioner_id is missing (allocation-practitioner)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Money received per practitioner, receipt by receipt
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_cash_by_practitioner(p_practice_id uuid, p_from date, p_to date)
RETURNS TABLE (
  received_on date,
  receipt_id uuid,
  receipt_number text,
  payer_type text,
  patient_id uuid,
  fund_name text,
  method text,
  practitioner_id uuid,
  basis text,
  amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.claim_assert_staff(p_practice_id);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Choose a period: a first and a last day.' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 731 THEN
    RAISE EXCEPTION 'Choose a period of at most two years.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT b.receipt_id AS id, b.receipt_number AS number, b.payer_type AS payer, b.patient_id AS patient, b.fund_name AS fund,
           b.method AS how, b.received_on AS day, b.refunded AS refunded_amount, b.unallocated AS unallocated_amount
      FROM public.ar_receipt_balances b
     WHERE b.practice_id = p_practice_id
       AND b.reversed_at IS NULL
       AND b.received_on BETWEEN p_from AND p_to
  ),
  allocations AS (
    SELECT a.id, a.receipt_id AS receipt, a.invoice_id AS invoice, a.amount AS allocated
      FROM public.receipt_allocations a
      JOIN paid ON paid.id = a.receipt_id
     WHERE a.reversed_at IS NULL
  ),
  parts AS (
    -- What each allocation paid, line by line, for the practitioner stored with it when it was paid
    SELECT al.receipt AS receipt,
           l.practitioner_id AS practitioner,
           CASE WHEN l.invoice_line_id IS NOT NULL THEN 'line' ELSE 'invoice' END AS part_basis,
           l.amount AS part_amount
      FROM allocations al
      JOIN public.receipt_allocation_lines l ON l.allocation_id = al.id
    UNION ALL
    -- An allocation's amount that is on none of its lines (no lines recorded): its invoice's practitioner
    SELECT al.receipt, i.practitioner_id, 'invoice', al.allocated - COALESCE(on_lines.total, 0)
      FROM allocations al
      LEFT JOIN public.invoices_enhanced i ON i.id = al.invoice
      LEFT JOIN LATERAL (SELECT sum(l.amount) AS total FROM public.receipt_allocation_lines l WHERE l.allocation_id = al.id) on_lines ON true
    UNION ALL
    SELECT paid.id, NULL::uuid, 'unallocated', paid.unallocated_amount FROM paid
    UNION ALL
    SELECT paid.id, NULL::uuid, 'refunded', paid.refunded_amount FROM paid
  )
  SELECT paid.day, paid.id, paid.number, paid.payer, paid.patient, paid.fund, paid.how,
         parts.practitioner, parts.part_basis, sum(parts.part_amount)
    FROM parts
    JOIN paid ON paid.id = parts.receipt
   GROUP BY paid.day, paid.id, paid.number, paid.payer, paid.patient, paid.fund, paid.how, parts.practitioner, parts.part_basis
  HAVING sum(parts.part_amount) <> 0
   ORDER BY paid.day, paid.number, paid.id, parts.part_basis, parts.practitioner;
END;
$$;

COMMENT ON FUNCTION public.report_cash_by_practitioner(uuid, date, date) IS
  'Money received per practitioner by the day it was received: each standing receipt split by what its allocations paid, for the practitioner stored with each part (receipt_allocation_lines.practitioner_id), unallocated and refunded. Read only; staff who open Finance. Finance > Reports > Cash flow per practitioner.';

REVOKE ALL ON FUNCTION public.report_cash_by_practitioner(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_cash_by_practitioner(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Result (read only): who may call it
-- ---------------------------------------------------------------------------------------------

SELECT has_function_privilege('anon', 'public.report_cash_by_practitioner(uuid, date, date)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.report_cash_by_practitioner(uuid, date, date)', 'EXECUTE') AS staff_run;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
