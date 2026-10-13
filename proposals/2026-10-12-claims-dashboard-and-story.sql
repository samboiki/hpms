-- Applied 2026-10-12 as migration claims_dashboard_and_story_2026_10_12 (version 20261012191421; stored statement md5 15bfbac7a07198830fa2f8f4d9559e44 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: report_claims_by_month ccf7f03300c2eaa3b7f86a68f80c0e98, claim_line_story 0c883be13f2fe0c74b00650adc3a9b72.
-- Rehearsed with simulated logins (rolled back): anon and another practice's doctor refused both (42501); a reversed
-- period and an unknown line refused (22023); for the practice's receptionist the dashboard's lines and claimed amount
-- equalled the 41 sent claim lines of two years, every row's outcomes added up to its lines, every batch id was a sent
-- batch of the practice. A line refused by the fund (invented remittance line), put in the queue with a note, sent
-- again through claim_line_resend and recorded as claim_resent told one story of 6 events (both claim lines, the copy
-- flagged R, the answer, the queue item, the note, the resend), the same from the copy; a payment allocated to the
-- invoice line showed as one 'payment' with its portion and receipt number.
-- =============================================================================================
-- PROPOSAL: the claims dashboard's figures per month and fund (parity G10), and one claim line's whole story on one
--           timeline (parity F10)
-- File:   proposals/2026-10-12-claims-dashboard-and-story.sql              Drafted: 2026-10-12
-- Code:   src/components/finance/practiceReports/ClaimsDashboard.tsx and ClaimLineStorySheet.tsx (screens),
--         src/components/finance/practiceReports/claimsDashboard.ts and claimLineStory.ts (figures and timeline in words;
--         tested), the story's links on a sent batch's line (BatchReview), an invoice (InvoiceDetailModal) and a rejection,
--         src/components/finance/practiceReports/practiceReportsService.ts (loadClaimsByMonth, loadClaimLineStory)
--
-- Why (parity G10): Finance shows what funds still owe and each sent batch's answers, but not how much was claimed
-- against how much was paid per month and per fund, nor how long each fund takes to pay. The figures come from every
-- claim line sent in the period with the fund's answers (claim_line_outcomes); reading those in the browser would
-- mean every line of every batch, so they are added up here, per month and fund, keeping the batch ids so each
-- figure opens its batches.
-- Why (parity F10): one claim line's story (sent, the fund's answers, corrections, resends, reversals, payments) is
-- spread over the batches, the remittances, the rejection queue, the invoice history and the receipts. A service is
-- claimed again as a copy of its line (claim_line_copy: same invoice and system transaction number), so the story
-- follows every claim line of the same service.
--
-- What it does (read only; nothing is written, no table or policy changes)
--   1. report_claims_by_month(practice, from, to): per month (the day a batch was sent, Windhoek time) and fund
--      reference as stored on the batch (the app merges aliases: MAG1 = PSEMAS): the batches, their claim lines, what
--      was claimed (service amount less discount, as claim_line_outcomes judges "paid in full"), what the fund paid on
--      them (all answers), lines paid, part paid, rejected, pended (the fund is still processing) and unanswered, lines
--      that were sent again (field 32), and for paid and part-paid lines the days from sending to the fund's latest
--      answer (sum and count, so the app can average per fund). Credit files (reversals, header type C) are left out.
--      At most two years.
--   2. claim_line_story(claim line): the events of every claim line of the same service (same invoice, system
--      transaction number and tariff code; a credit file's reversal line opens the story of the line it reverses):
--        'claimed'         each claim line: its batch, number, file and sent day (or waiting in an unsent batch);
--        'answer'          each posted remittance line that answered it (status, paid, the fund's reason codes);
--        'fund_payment'    each fund payment keyed by hand that paid it (posted fund_payment_drafts);
--        'rejection'       each rejection queue item, and 'rejection_step' every action taken on it;
--        'correction'      each correction and each resend recorded in the invoice history (claim_corrected,
--                          claim_resent: the app words them as the invoice history does);
--        'reversal'        each credit-note reversal of it and where it stands (claim_reversal_states);
--        'payment'         each standing receipt allocation that paid the invoice line (either portion).
--   Who may call them: staff of the practice who may open Finance (claim_assert_staff). The public key may not.
--
-- Needs: claims-follow-up (claim_line_outcomes, fund_payment_drafts), remittances (remittance_lines, claim_rejections,
-- claim_rejection_events), claim-corrections (claim_reversal_states, claim_assert_staff), invoicing
-- (invoice_audit_events), allocation-lines (receipt_allocation_lines).
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the dashboard and the story say they are not set up yet.
-- Undo:  DROP FUNCTION IF EXISTS public.claim_line_story(uuid);
--        DROP FUNCTION IF EXISTS public.report_claims_by_month(uuid, date, date);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: what this file reads, as it was on 2026-10-12
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.claim_line_outcomes') IS NULL OR to_regclass('public.fund_payment_drafts') IS NULL THEN
    RAISE EXCEPTION 'Check failed: claim_line_outcomes or fund_payment_drafts is missing (claims-follow-up)';
  END IF;
  IF to_regclass('public.claim_reversal_states') IS NULL OR to_regprocedure('public.claim_assert_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Check failed: claim_reversal_states or claim_assert_staff is missing (claim-corrections)';
  END IF;
  IF to_regclass('public.invoice_audit_events') IS NULL OR to_regclass('public.receipt_allocation_lines') IS NULL
     OR to_regclass('public.claim_rejection_events') IS NULL THEN
    RAISE EXCEPTION 'Check failed: invoice_audit_events, receipt_allocation_lines or claim_rejection_events is missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Claimed against paid, per month and fund
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_claims_by_month(p_practice_id uuid, p_from date, p_to date)
RETURNS TABLE (
  month date,
  fund_reference text,
  batch_ids uuid[],
  lines integer,
  claimed numeric,
  paid numeric,
  paid_lines integer,
  part_paid_lines integer,
  rejected_lines integer,
  waiting_lines integer,
  unanswered_lines integer,
  resent_lines integer,
  days_to_pay_total bigint,
  days_to_pay_lines integer
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
  WITH sent AS (
    SELECT h.id AS batch, h.medical_aid_reference AS fund, (h.sent_at AT TIME ZONE 'Africa/Windhoek')::date AS sent_on
      FROM public.batch_headers h
     WHERE h.practice_id = p_practice_id
       AND h.sent_at IS NOT NULL
       AND upper(btrim(COALESCE(h.transaction_type::text, ''))) <> 'C'
       AND (h.sent_at AT TIME ZONE 'Africa/Windhoek')::date BETWEEN p_from AND p_to
  ),
  claim_lines AS (
    SELECT sent.batch, sent.fund, sent.sent_on,
           COALESCE(d.service_amount, 0) - COALESCE(d.discount_amount, 0) AS line_claimed,
           o.outcome AS line_outcome,
           COALESCE(o.paid, 0) AS line_paid,
           o.answered_on AS line_answered_on,
           NULLIF(btrim(COALESCE(d.resubmission_flag, '')), '') IS NOT NULL AS line_resent
      FROM sent
      JOIN public.batch_details d ON d.batch_header_id = sent.batch
      LEFT JOIN public.claim_line_outcomes o ON o.claim_line_id = d.id
  )
  SELECT date_trunc('month', cl.sent_on)::date,
         cl.fund::text,
         array_agg(DISTINCT cl.batch),
         count(*)::integer,
         sum(cl.line_claimed),
         sum(cl.line_paid),
         (count(*) FILTER (WHERE cl.line_outcome = 'paid'))::integer,
         (count(*) FILTER (WHERE cl.line_outcome = 'part_paid'))::integer,
         (count(*) FILTER (WHERE cl.line_outcome = 'rejected'))::integer,
         (count(*) FILTER (WHERE cl.line_outcome = 'waiting'))::integer,
         (count(*) FILTER (WHERE cl.line_outcome IS NULL))::integer,
         (count(*) FILTER (WHERE cl.line_resent))::integer,
         (COALESCE(sum(cl.line_answered_on - cl.sent_on) FILTER (WHERE cl.line_outcome IN ('paid', 'part_paid') AND cl.line_answered_on IS NOT NULL), 0))::bigint,
         (count(*) FILTER (WHERE cl.line_outcome IN ('paid', 'part_paid') AND cl.line_answered_on IS NOT NULL))::integer
    FROM claim_lines cl
   GROUP BY date_trunc('month', cl.sent_on)::date, cl.fund
   ORDER BY 1, 2;
END;
$$;

COMMENT ON FUNCTION public.report_claims_by_month(uuid, date, date) IS
  'Claim lines sent in the period per month and fund reference: claimed, paid, answers by outcome, lines sent again and days to pay (sum and count). Credit files excluded. Read only; staff who open Finance. Finance > Reports > Claims dashboard.';

-- ---------------------------------------------------------------------------------------------
-- 2. One claim line's story: every event of every claim line of the same service
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_line_story(p_claim_line_id uuid)
RETURNS TABLE (
  kind text,
  occurred_at timestamptz,
  on_date date,
  claim_line_id uuid,
  batch_id uuid,
  batch_number integer,
  document_id uuid,
  receipt_id uuid,
  rejection_id uuid,
  invoice_id uuid,
  actor uuid,
  amount numeric,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_line     public.batch_details%ROWTYPE;
  v_practice uuid;
  v_original uuid;
  v_lines    uuid[];
  v_inv_line uuid;
BEGIN
  SELECT d.* INTO v_line FROM public.batch_details d WHERE d.id = p_claim_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The claim line was not found.' USING ERRCODE = '22023';
  END IF;
  SELECT h.practice_id INTO v_practice FROM public.batch_headers h WHERE h.id = v_line.batch_header_id;
  PERFORM public.claim_assert_staff(v_practice);

  -- A credit file's reversal line carries no invoice: its story is the story of the claim line it reverses
  IF v_line.invoice_id IS NULL THEN
    SELECT r.claim_line_id INTO v_original FROM public.claim_reversals r WHERE r.batch_line_id = v_line.id LIMIT 1;
    IF v_original IS NOT NULL THEN
      SELECT d.* INTO v_line FROM public.batch_details d WHERE d.id = v_original;
    END IF;
  END IF;

  -- Every claim line of the service: copies made to send it again keep the invoice, transaction number and code
  SELECT array_agg(d.id) INTO v_lines
    FROM public.batch_details d
    JOIN public.batch_headers h ON h.id = d.batch_header_id
   WHERE h.practice_id = v_practice
     AND (d.id = v_line.id
          OR (v_line.invoice_id IS NOT NULL
              AND d.invoice_id = v_line.invoice_id
              AND d.system_transaction_number IS NOT DISTINCT FROM v_line.system_transaction_number
              AND d.bhf_tariff_code IS NOT DISTINCT FROM v_line.bhf_tariff_code));

  -- The invoice line the service bills (corrections, resends and payments are recorded against it)
  IF v_line.invoice_id IS NOT NULL AND v_line.system_transaction_number IS NOT NULL THEN
    SELECT s.id INTO v_inv_line FROM public.invoice_services s
     WHERE s.invoice_id = v_line.invoice_id AND s.system_transaction_number = v_line.system_transaction_number
     LIMIT 1;
  END IF;

  RETURN QUERY
  -- Each claim line: where and when it was sent (or that it waits in an unsent batch)
  SELECT 'claimed'::text,
         COALESCE(h.sent_at, d.created_at),
         COALESCE((h.sent_at AT TIME ZONE 'Africa/Windhoek')::date, (d.created_at AT TIME ZONE 'Africa/Windhoek')::date),
         d.id, h.id, h.batch_number, NULL::uuid, NULL::uuid, NULL::uuid, d.invoice_id, NULL::uuid,
         COALESCE(d.service_amount, 0) - COALESCE(d.discount_amount, 0),
         jsonb_build_object(
           'sent', h.sent_at IS NOT NULL,
           'status', h.status,
           'fund', h.medical_aid_reference,
           'line_number', d.transaction_number_in_batch,
           'flag', NULLIF(btrim(COALESCE(d.resubmission_flag, '')), ''),
           'tariff_code', d.bhf_tariff_code,
           'service_date', d.service_date,
           'file_name', sub.file_name,
           'submission_status', sub.status)
    FROM public.batch_details d
    JOIN public.batch_headers h ON h.id = d.batch_header_id
    LEFT JOIN LATERAL (
      SELECT s.file_name, s.status FROM public.batch_submissions s
       WHERE s.batch_header_id = h.id
       ORDER BY s.submitted_at DESC NULLS LAST
       LIMIT 1) sub ON true
   WHERE d.id = ANY (v_lines)
  UNION ALL
  -- The fund's answers: posted remittance and response lines matched to one of the service's claim lines
  SELECT 'answer', l.posted_at,
         COALESCE(doc.payment_date, doc.document_date, (l.posted_at AT TIME ZONE 'Africa/Windhoek')::date),
         matched.id, NULL, NULL, doc.id, doc.receipt_id, NULL, l.invoice_id, doc.posted_by,
         CASE WHEN l.claim_line_id = matched.id THEN l.paid ELSE 0 END,
         jsonb_build_object(
           'status', l.line_status,
           'claimed', l.claimed,
           'reason_codes', to_jsonb(l.reason_codes),
           'reason_texts', to_jsonb(l.reason_texts),
           'fund', COALESCE(doc.fund_code, doc.fund_name),
           'document_kind', doc.kind,
           'file_name', doc.file_name)
    FROM public.remittance_lines l
    JOIN public.remittance_documents doc ON doc.id = l.document_id
    CROSS JOIN LATERAL (
      SELECT x AS id FROM unnest(array_append(l.claim_line_ids, l.claim_line_id)) AS x
       WHERE x = ANY (v_lines)
       LIMIT 1) matched
   WHERE l.practice_id = v_practice AND l.posted_at IS NOT NULL
  UNION ALL
  -- Fund payments keyed by hand, line by line (the claims follow-up's fund payment sheet)
  SELECT 'fund_payment', f.posted_at, f.received_on,
         keyed.line, NULL, NULL, NULL, f.receipt_id, NULL, NULL, f.posted_by,
         (e.value ->> 'paid')::numeric,
         jsonb_build_object('fund', COALESCE(f.fund_code, f.fund_name), 'reference', f.reference)
    FROM public.fund_payment_drafts f
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(f.lines) = 'array' THEN f.lines ELSE '[]'::jsonb END) e(value)
    -- Only a well-formed id is read as one (a cast in the WHERE clause could run before the shape is checked)
    CROSS JOIN LATERAL (
      SELECT CASE WHEN (e.value ->> 'claim_line_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN (e.value ->> 'claim_line_id')::uuid END AS line) keyed
   WHERE f.practice_id = v_practice AND f.status = 'posted'
     AND keyed.line = ANY (v_lines)
  UNION ALL
  -- The rejection queue: what the fund refused and what is done about it
  SELECT 'rejection', cr.created_at, (cr.created_at AT TIME ZONE 'Africa/Windhoek')::date,
         cr.claim_line_id, cr.resubmitted_batch_id, NULL, cr.document_id, NULL, cr.id, cr.invoice_id, cr.created_by,
         cr.at_stake,
         jsonb_build_object(
           'category', cr.category,
           'plain_reason', cr.plain_reason,
           'status', cr.status,
           'reason_codes', to_jsonb(cr.reason_codes),
           'claimed', cr.claimed,
           'paid', cr.paid)
    FROM public.claim_rejections cr
   WHERE cr.practice_id = v_practice AND cr.claim_line_id = ANY (v_lines)
  UNION ALL
  SELECT 'rejection_step', ev.occurred_at, (ev.occurred_at AT TIME ZONE 'Africa/Windhoek')::date,
         cr.claim_line_id, NULL, NULL, NULL, NULL, cr.id, cr.invoice_id, ev.actor, NULL,
         jsonb_build_object('action', ev.action, 'note', ev.note)
    FROM public.claim_rejection_events ev
    JOIN public.claim_rejections cr ON cr.id = ev.rejection_id
   WHERE cr.practice_id = v_practice AND cr.claim_line_id = ANY (v_lines)
  UNION ALL
  -- Corrections and resends, as the invoice history records them (the app words them as that history does)
  SELECT 'correction', e.changed_at, (e.changed_at AT TIME ZONE 'Africa/Windhoek')::date,
         NULL, NULL, NULL, NULL, NULL, NULL, e.invoice_id, e.changed_by, NULL,
         jsonb_build_object(
           'id', e.id, 'action', e.action, 'field', e.field, 'old_value', e.old_value, 'new_value', e.new_value,
           'line_code', e.line_code, 'line_before', e.line_before, 'line_after', e.line_after)
    FROM public.invoice_audit_events e
   WHERE e.practice_id = v_practice
     AND v_inv_line IS NOT NULL
     AND e.invoice_id = v_line.invoice_id
     AND e.line_id = v_inv_line
     AND e.action IN ('claim_corrected', 'claim_resent')
  UNION ALL
  -- Credit notes on the line taken back from the fund in a credit file
  SELECT 'reversal', rs.created_at, (rs.created_at AT TIME ZONE 'Africa/Windhoek')::date,
         rs.claim_line_id, rs.batch_id, rs.credit_batch_number, NULL, NULL, NULL, rs.invoice_id, NULL, rs.amount,
         jsonb_build_object('state', rs.state, 'credit_note', rs.adjustment_number, 'credit_sent_at', rs.credit_sent_at)
    FROM public.claim_reversal_states rs
   WHERE rs.practice_id = v_practice AND rs.claim_line_id = ANY (v_lines)
  UNION ALL
  -- Money allocated to the invoice line from a receipt (the fund's portion or the patient's)
  SELECT 'payment', a.created_at, r.received_on,
         NULL, NULL, NULL, NULL, r.id, NULL, a.invoice_id, a.created_by, sum(al.amount),
         jsonb_build_object('portion', al.portion, 'receipt_number', r.receipt_number, 'method', r.method, 'payer_type', r.payer_type)
    FROM public.receipt_allocation_lines al
    JOIN public.receipt_allocations a ON a.id = al.allocation_id AND a.reversed_at IS NULL
    JOIN public.receipts r ON r.id = a.receipt_id AND r.reversed_at IS NULL
   WHERE al.practice_id = v_practice AND v_inv_line IS NOT NULL AND al.invoice_line_id = v_inv_line
   GROUP BY a.id, a.created_at, a.invoice_id, a.created_by, al.portion, r.id, r.received_on, r.receipt_number, r.method, r.payer_type
   ORDER BY 2, 1;
END;
$$;

COMMENT ON FUNCTION public.claim_line_story(uuid) IS
  'One claim line''s story: every claim line of the same service (sent, answered, rejected and acted on, corrected, sent again, reversed, paid). Read only; staff who open Finance. Opened from a claim line, an invoice or a rejection.';

REVOKE ALL ON FUNCTION public.report_claims_by_month(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_line_story(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_claims_by_month(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_line_story(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Result (read only): who may call them
-- ---------------------------------------------------------------------------------------------

SELECT has_function_privilege('anon', 'public.report_claims_by_month(uuid, date, date)', 'EXECUTE') AS anon_runs_dashboard,
       has_function_privilege('anon', 'public.claim_line_story(uuid)', 'EXECUTE') AS anon_runs_story,
       has_function_privilege('authenticated', 'public.claim_line_story(uuid)', 'EXECUTE') AS staff_run_story;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
