-- Applied 2026-10-09 as migration claims_follow_up_2026_10_08 (version 20261009004519; md5 of the part between BEGIN;
-- and ROLLBACK; = md5 of the stored statement: d01a066dc98a67adc1aaa9e687dfa2d8)
-- Rehearsed with simulated logins (rolled back): practice A's staff keyed, saved, posted (one receipt, one allocation,
-- the rest to the patient) and the batch went sent -> partially_paid -> paid; practice B's staff and anon were refused
-- everything; unbalanced, stale-version, duplicate-line and 3-decimal saves refused; an open batch never moved.
-- =============================================================================================
-- PROPOSAL: claim batches move on with the funds' answers; a fund payment is keyed line by line
-- against its total and can be saved and finished later (by the same person or a colleague)
-- File:   proposals/2026-10-08-claims-follow-up.sql                     Drafted: 2026-10-08
-- Code:   src/components/finance/claims/* (status.ts, batchFollowUp.ts, claimsService.ts loadLineOutcomes, ClaimsBatches,
--         BatchReview, BatchHistory), src/components/finance/receipts/* (fundPaymentKeying.ts, fundPaymentService.ts,
--         FundPaymentSheet.tsx, FundKeyingList.tsx)
--
-- Why (parity matrix 2026-10-08):
--   F6  Live batches are only 'active' or 'sent': remittance_post_document never moved a batch on, so the
--       statuses the claims screens know (claims/status.ts: confirmed, partially_paid, paid, unpaid,
--       rejected) were never set, and no screen showed which claim lines a fund paid.
--   G1  Payments > "Medical aid payment" spread a fund's lump sum per invoice only, against no total that
--       had to balance, and a long remittance had to be keyed in one sitting.
--
-- What it adds
--   1. fund_payment_drafts: a fund payment being keyed: the amount received (the control total), date,
--      reference, the amount the fund paid per claim line (0.00 = the fund paid nothing on it), money kept
--      as credit on purpose, and the invoices whose unpaid rest moves to the patient. Staff of the practice
--      read their practice's drafts; nobody writes the table directly.
--   2. claim_line_outcomes (view, caller's rights): per claim line (batch_details row), what the fund
--      answered: paid, part_paid, rejected (nothing paid) or waiting (pended, accepted, a note only), from
--      posted remittance lines and from posted keyed payments (not when that receipt was reversed). Money
--      counts first: a line paid in full on any answer is paid, then part paid; otherwise the latest answer
--      counts (pended then refused = refused).
--   3. claim_batch_refresh_status(batch ids): a sent batch's status from its lines' outcomes: no answer ->
--      sent; every line paid -> paid; any money -> partially_paid; every line refused -> rejected; some
--      refused and nothing paid -> unpaid; answered, nothing decided -> confirmed. Open (unsent) batches and
--      statuses it does not know are never touched. Internal: only the two posting functions call it.
--   4. remittance_post_document: the LIVE definition (pg_get_functiondef, md5 b805af1ed57069fa94983aaa45d2e0e4,
--      = proposals/2026-10-07-claims-flags-and-closed-months.sql), unchanged except one block, marked
--      "claims follow-up", before the document is marked posted: the statuses of this practice's batches its
--      lines were matched to are refreshed. Every guard stays (reconciled, already posted, invoices of this
--      practice only, claim responses move no money, closed months post on the first open day, a payment
--      posted once, rejections queued once).
--   5. fund_payment_draft_save(draft)          create or update; a version number means two people never
--                                              overwrite each other's keying
--      fund_payment_draft_discard(id, version)
--      fund_payment_draft_post(id, version)    only when the keyed lines plus the credit kept equal the
--                                              amount received: one receipt (ar_post_receipt, source batch,
--                                              external_ref fund_payment_draft:<id>, so it can never post
--                                              twice), one allocation per invoice (the sum of its keyed
--                                              lines), the unpaid rest to the patient where asked, then the
--                                              batches of the keyed lines move on.
--      All three: SECURITY DEFINER, membership checked (ar_assert_member), signed-in users only.
--
-- Requires: 2026-10-07-receipts-and-allocations.sql (ar_post_receipt, ar_assert_member, ar_invoice_balances),
--   2026-10-07-remittances.sql and 2026-10-07-claims-flags-and-closed-months.sql (remittance_post_document,
--   dc_first_open_day), the portal guard (portal_is_staff). Section 0 stops when one is missing or when
--   remittance_post_document changed since this file was written.
-- Access: no policy changes on existing tables. The new table: staff of the practice read it (the usual
--   EXISTS ... users.practice_id rule) under the restrictive portal_staff_only guard; writes only through the
--   functions above. Nothing is granted to anon.
-- How to apply: rehearse (scripts/db/rehearsal.ts runs it in one rolled-back transaction), then apply the
--   part between BEGIN; and ROLLBACK; as a migration. Until then the claims screens show no answers per line
--   and the fund payment keying says it is not set up yet.
-- Undo:
--   remittance_post_document: delete the block marked "claims follow-up" in section 4 and run it again;
--   DROP FUNCTION public.fund_payment_draft_post(uuid, integer), public.fund_payment_draft_discard(uuid, integer),
--     public.fund_payment_draft_save(jsonb), public.claim_batch_refresh_status(uuid[]);
--   DROP VIEW public.claim_line_outcomes; DROP TABLE public.fund_payment_drafts;
--   Statuses already moved stay; to put them back:
--   UPDATE batch_headers SET status = 'sent' WHERE status IN ('confirmed', 'partially_paid', 'paid', 'unpaid', 'rejected');
-- =============================================================================================

BEGIN;
-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(name, ', ') INTO v_missing
    FROM (VALUES ('public.remittance_documents'), ('public.remittance_lines'), ('public.claim_rejections'),
                 ('public.batch_headers'), ('public.batch_details'), ('public.receipts'), ('public.invoices_enhanced'),
                 ('public.ar_invoice_balances'), ('public.users'), ('public.practices')) AS t(name)
   WHERE to_regclass(name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: missing %. Apply the receipts and remittances proposals first.', v_missing;
  END IF;
  SELECT string_agg(sig, ', ') INTO v_missing
    FROM (VALUES ('public.ar_post_receipt(jsonb)'), ('public.ar_assert_member(uuid)'), ('public.remittance_amount(jsonb)'),
                 ('public.dc_first_open_day(uuid,date)'), ('public.portal_is_staff()'),
                 ('public.remittance_post_document(uuid,jsonb)')) AS t(sig)
   WHERE to_regprocedure(sig) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions missing: %', v_missing;
  END IF;
  -- Section 4 replaces the live remittance_post_document: stop when it changed since this file was written
  -- (the second value is this file's own version, so the file can run again)
  IF md5(pg_get_functiondef('public.remittance_post_document(uuid,jsonb)'::regprocedure))
     NOT IN ('b805af1ed57069fa94983aaa45d2e0e4', '90237b308c8242b3957c3d607276a553') THEN
    RAISE EXCEPTION 'Stopped: remittance_post_document changed since 2026-10-08; merge its new version into section 4 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. A fund payment being keyed
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fund_payment_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- The fund's claim-file code (MAG1 = PSEMAS, NMC1, NHPM, NAMM, PROS); empty for patients with no medical aid on file
  fund_code       text CHECK (fund_code IS NULL OR fund_code ~ '^[A-Z0-9]{2,10}$'),
  -- The payer printed on the receipt
  fund_name       text NOT NULL CHECK (btrim(fund_name) <> ''),
  -- The amount received: the control total the keyed lines must add up to
  amount          numeric(14,2) CHECK (amount IS NULL OR amount > 0),
  received_on     date,
  reference       text,
  method          text NOT NULL DEFAULT 'medical_aid' CHECK (method IN ('medical_aid', 'eft')),
  notes           text,
  -- [{ "claim_line_id": uuid or null (a claim with no claim lines is keyed as a whole), "invoice_id": uuid, "paid": "123.45" }]
  lines           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines) = 'array'),
  -- Money not matched to a claim, kept on the receipt as credit on purpose
  unmatched       numeric(14,2) NOT NULL DEFAULT 0 CHECK (unmatched >= 0),
  -- Invoices whose unpaid rest moves to the patient when the payment is posted
  rest_to_patient uuid[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'discarded')),
  receipt_id      uuid REFERENCES public.receipts(id) ON DELETE RESTRICT,
  -- Goes up with every save: a save or post from an older version is refused
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  posted_by       uuid,
  posted_at       timestamptz,
  discarded_by    uuid,
  discarded_at    timestamptz,
  CONSTRAINT fund_payment_drafts_posted_receipt CHECK ((status = 'posted') = (receipt_id IS NOT NULL AND posted_at IS NOT NULL)),
  CONSTRAINT fund_payment_drafts_discarded_when CHECK ((status = 'discarded') = (discarded_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS fund_payment_drafts_practice_idx ON public.fund_payment_drafts (practice_id, status, updated_at DESC);
COMMENT ON TABLE public.fund_payment_drafts IS
  'A medical aid payment keyed line by line (Payments > Medical aid payment): saved while keying, posted as one receipt once the lines add up to the amount received. Written only through fund_payment_draft_save, _discard and _post.';

ALTER TABLE public.fund_payment_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fund_payment_drafts_select ON public.fund_payment_drafts;
CREATE POLICY fund_payment_drafts_select ON public.fund_payment_drafts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = fund_payment_drafts.practice_id));
DROP POLICY IF EXISTS portal_staff_only ON public.fund_payment_drafts;
CREATE POLICY portal_staff_only ON public.fund_payment_drafts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
REVOKE ALL ON public.fund_payment_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fund_payment_drafts TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. What the fund answered per claim line
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.claim_line_outcomes WITH (security_invoker = true) AS
WITH answers AS (
  -- Posted remittance and claim-response lines, for every claim line they were matched to. A line matched to
  -- several claim lines (a fund folding two lines into one) counts its money once, on the first of them.
  SELECT ids.claim_line_id,
         l.practice_id,
         l.line_status AS status,
         CASE WHEN ids.claim_line_id = l.claim_line_id THEN l.paid ELSE 0 END AS paid,
         COALESCE(d.payment_date, d.document_date, (l.posted_at AT TIME ZONE 'Africa/Windhoek')::date) AS answered_on,
         l.posted_at AS recorded_at,
         d.id AS document_id,
         NULL::uuid AS receipt_id
    FROM public.remittance_lines l
    JOIN public.remittance_documents d ON d.id = l.document_id
    CROSS JOIN LATERAL (
      SELECT DISTINCT x AS claim_line_id FROM unnest(array_append(l.claim_line_ids, l.claim_line_id)) AS x WHERE x IS NOT NULL
    ) ids
   WHERE l.posted_at IS NOT NULL
  UNION ALL
  -- Fund payments keyed line by line; a reversed receipt no longer counts
  SELECT d.id,
         f.practice_id,
         CASE WHEN (e.value ->> 'paid')::numeric <= 0 THEN 'rejected'
              WHEN (e.value ->> 'paid')::numeric >= COALESCE(d.service_amount, 0) - COALESCE(d.discount_amount, 0) THEN 'paid'
              ELSE 'part_paid' END,
         (e.value ->> 'paid')::numeric,
         f.received_on,
         f.posted_at,
         NULL::uuid,
         f.receipt_id
    FROM public.fund_payment_drafts f
    CROSS JOIN LATERAL jsonb_array_elements(f.lines) AS e(value)
    JOIN public.batch_details d ON d.id = NULLIF(e.value ->> 'claim_line_id', '')::uuid
    JOIN public.receipts r ON r.id = f.receipt_id AND r.reversed_at IS NULL
   WHERE f.status = 'posted'
)
SELECT a.claim_line_id,
       bd.batch_header_id AS batch_id,
       h.practice_id,
       CASE WHEN bool_or(a.status = 'paid') THEN 'paid'
            WHEN bool_or(a.status = 'part_paid') THEN 'part_paid'
            WHEN (array_agg(a.status ORDER BY a.answered_on DESC NULLS LAST, a.recorded_at DESC NULLS LAST))[1] = 'rejected' THEN 'rejected'
            ELSE 'waiting' END AS outcome,
       sum(a.paid) AS paid,
       max(a.answered_on) AS answered_on,
       count(*)::integer AS answers,
       (array_agg(a.document_id ORDER BY a.answered_on DESC NULLS LAST, a.recorded_at DESC NULLS LAST)
          FILTER (WHERE a.document_id IS NOT NULL))[1] AS document_id,
       (array_agg(a.receipt_id ORDER BY a.answered_on DESC NULLS LAST, a.recorded_at DESC NULLS LAST)
          FILTER (WHERE a.receipt_id IS NOT NULL))[1] AS receipt_id
  FROM answers a
  JOIN public.batch_details bd ON bd.id = a.claim_line_id
  -- Only answers recorded by the practice the batch belongs to
  JOIN public.batch_headers h ON h.id = bd.batch_header_id AND h.practice_id = a.practice_id
 GROUP BY a.claim_line_id, bd.batch_header_id, h.practice_id;
COMMENT ON VIEW public.claim_line_outcomes IS
  'Per claim line: paid, part_paid, rejected or waiting, from posted remittance lines and posted keyed fund payments (money counts first, otherwise the latest answer). Caller''s rights.';
REVOKE ALL ON public.claim_line_outcomes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.claim_line_outcomes TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. A sent batch's status from its lines' outcomes (src/components/finance/claims/status.ts)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_batch_refresh_status(p_batch_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch record;
  v_new   text;
  v_moved integer := 0;
BEGIN
  FOR v_batch IN
    SELECT h.id,
           count(bd.id) AS lines,
           count(o.claim_line_id) AS answered,
           count(*) FILTER (WHERE o.outcome = 'paid') AS paid,
           count(*) FILTER (WHERE o.outcome = 'part_paid') AS part_paid,
           count(*) FILTER (WHERE o.outcome = 'rejected') AS refused
      FROM batch_headers h
      JOIN batch_details bd ON bd.batch_header_id = h.id
      LEFT JOIN claim_line_outcomes o ON o.claim_line_id = bd.id
     WHERE h.id = ANY (COALESCE(p_batch_ids, '{}'::uuid[]))
       -- Sent batches only (an open batch can still change), and only the statuses this function sets
       AND (h.sent_at IS NOT NULL OR lower(COALESCE(h.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
       AND lower(COALESCE(h.status, 'sent')) IN ('sent', 'confirmed', 'partially_paid', 'paid', 'unpaid', 'rejected')
     GROUP BY h.id
  LOOP
    v_new := CASE
      WHEN v_batch.answered = 0 THEN 'sent'
      WHEN v_batch.paid = v_batch.lines THEN 'paid'
      WHEN v_batch.paid + v_batch.part_paid > 0 THEN 'partially_paid'
      WHEN v_batch.refused = v_batch.lines THEN 'rejected'
      WHEN v_batch.refused > 0 THEN 'unpaid'
      ELSE 'confirmed'
    END;
    UPDATE batch_headers SET status = v_new, updated_at = now()
     WHERE id = v_batch.id AND status IS DISTINCT FROM v_new;
    IF FOUND THEN
      v_moved := v_moved + 1;
    END IF;
  END LOOP;
  RETURN v_moved;
END;
$$;
COMMENT ON FUNCTION public.claim_batch_refresh_status(uuid[]) IS
  'Sets a sent claim batch''s status from what the funds answered on its lines (claim_line_outcomes). Internal: called by remittance_post_document and fund_payment_draft_post.';

-- ---------------------------------------------------------------------------------------------
-- 4. remittance_post_document: the live definition plus the "claims follow-up" block
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remittance_post_document(p_document_id uuid, p_post jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_doc        remittance_documents%ROWTYPE;
  v_other      remittance_documents%ROWTYPE;
  v_receipt    jsonb := NULLIF(p_post->'receipt', 'null'::jsonb);
  v_result     jsonb := '{}'::jsonb;
  v_adjs       jsonb := '[]'::jsonb;
  v_item       jsonb;
  v_adj        jsonb;
  v_rejection  claim_rejections%ROWTYPE;
  v_line       remittance_lines%ROWTYPE;
  v_created    integer := 0;
  v_resolved   integer := 0;
  v_ids        uuid[];
  -- The day the money counts on: the fund's date, or the first open day when its month is closed
  v_base       date;
  v_post_on    date;
BEGIN
  SELECT * INTO v_doc FROM remittance_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remittance document not found';
  END IF;
  PERFORM ar_assert_member(v_doc.practice_id);
  IF v_doc.status = 'posted' THEN
    RETURN jsonb_build_object('document_id', v_doc.id, 'receipt_id', v_doc.receipt_id, 'already_posted', true);
  END IF;
  IF NOT v_doc.reconciled THEN
    RAISE EXCEPTION 'This document does not add up (its lines do not match its totals), so nothing can be posted from it';
  END IF;

  -- What happened to each line
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'lines', '[]'::jsonb)) LOOP
    v_ids := ARRAY(SELECT (value)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'claim_line_ids', '[]'::jsonb)) AS value);
    UPDATE remittance_lines
       SET posting_status = COALESCE(NULLIF(v_item->>'posting_status', ''), 'no_action'),
           allocated = COALESCE(remittance_amount(v_item->'allocated'), 0),
           shortfall = COALESCE(remittance_amount(v_item->'shortfall'), 0),
           written_off = COALESCE(remittance_amount(v_item->'written_off'), 0),
           match_status = COALESCE(NULLIF(v_item->>'match_status', ''), match_status),
           match_rule = COALESCE(NULLIF(btrim(v_item->>'match_rule'), ''), match_rule),
           claim_line_ids = CASE WHEN v_item ? 'claim_line_ids' THEN v_ids ELSE claim_line_ids END,
           claim_line_id = CASE WHEN v_item ? 'claim_line_ids' THEN v_ids[1] ELSE claim_line_id END,
           invoice_id = CASE WHEN v_item ? 'invoice_id' THEN NULLIF(v_item->>'invoice_id', '')::uuid ELSE invoice_id END,
           patient_id = CASE WHEN v_item ? 'patient_id' THEN NULLIF(v_item->>'patient_id', '')::uuid ELSE patient_id END,
           posted_at = now()
     WHERE id = NULLIF(v_item->>'line_id', '')::uuid AND document_id = v_doc.id;
  END LOOP;

  -- Lines matched to invoices of this practice only
  IF EXISTS (
    SELECT 1 FROM remittance_lines l JOIN invoices_enhanced i ON i.id = l.invoice_id
    WHERE l.document_id = v_doc.id AND i.practice_id IS DISTINCT FROM v_doc.practice_id
  ) THEN
    RAISE EXCEPTION 'A line is matched to an invoice of another practice';
  END IF;

  -- Money may only move on invoices this document's lines are matched to
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value->>'invoice_id' AS invoice_id FROM jsonb_array_elements(COALESCE(v_receipt->'allocations', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(v_receipt->'shortfalls', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(v_receipt->'write_offs', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(p_post->'adjustments', '[]'::jsonb))
    ) moved
    WHERE NOT EXISTS (
      SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.invoice_id = NULLIF(moved.invoice_id, '')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Money can only be posted to invoices this remittance''s lines are matched to';
  END IF;
  IF v_doc.kind NOT IN ('payment', 'month_summary') AND (v_receipt IS NOT NULL OR jsonb_array_length(COALESCE(p_post->'adjustments', '[]'::jsonb)) > 0) THEN
    RAISE EXCEPTION 'A claim response moves no money: record its outcomes only';
  END IF;

  -- Undo provisional shortfalls and write-offs first: the fund has now paid those lines
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'reversals', '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM claim_rejections r
      WHERE r.practice_id = v_doc.practice_id AND r.adjustment_id = NULLIF(v_item->>'adjustment_id', '')::uuid
        AND EXISTS (SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.invoice_id = r.invoice_id)
    ) THEN
      RAISE EXCEPTION 'Only a shortfall or write-off made from the rejection queue, on an invoice this remittance pays, can be undone here';
    END IF;
    PERFORM ar_reverse_adjustment(NULLIF(v_item->>'adjustment_id', '')::uuid, COALESCE(NULLIF(btrim(v_item->>'reason'), ''), 'The medical aid paid this line after all'));
  END LOOP;

  IF v_receipt IS NOT NULL THEN
    IF v_doc.kind NOT IN ('payment', 'month_summary') THEN
      RAISE EXCEPTION 'Only a payment can be posted as a receipt';
    END IF;
    IF v_doc.status = 'duplicate' THEN
      RAISE EXCEPTION 'This payment was already posted from another file';
    END IF;
    IF COALESCE(v_doc.total_paid, 0) <= 0 THEN
      RAISE EXCEPTION 'This document paid nothing to the practice';
    END IF;
    IF v_doc.payment_date IS NULL OR v_doc.payment_date > ar_today() THEN
      RAISE EXCEPTION 'The fund pays this on %; post it on or after that day', COALESCE(v_doc.payment_date::text, 'an unknown date');
    END IF;
    IF v_doc.payment_key IS NOT NULL THEN
      SELECT * INTO v_other FROM remittance_documents
       WHERE practice_id = v_doc.practice_id AND payment_key = v_doc.payment_key AND status = 'posted' AND receipt_id IS NOT NULL AND id <> v_doc.id
       LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'This payment was already posted from %', v_other.file_name;
      END IF;
    END IF;
    -- Every allocation must point at a line of this document
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_receipt->'allocations', '[]'::jsonb)) LOOP
      IF v_item->>'portion' <> 'medical_aid' OR NOT EXISTS (
        SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.id = NULLIF(v_item->>'external_ref', '')::uuid
      ) THEN
        RAISE EXCEPTION 'An allocation does not belong to a line of this remittance';
      END IF;
    END LOOP;
    v_base := v_doc.payment_date;
    v_post_on := dc_first_open_day(v_doc.practice_id, v_base);
    v_result := ar_post_receipt(v_receipt || jsonb_build_object(
      'practice_id', v_doc.practice_id,
      'payer_type', 'medical_aid',
      'fund_name', COALESCE(NULLIF(btrim(v_receipt->>'fund_name'), ''), v_doc.fund_name, v_doc.fund_code, 'Medical aid'),
      'method', CASE WHEN v_receipt->>'method' IN ('eft', 'medical_aid') THEN v_receipt->>'method' ELSE 'medical_aid' END,
      'amount', v_doc.total_paid,
      'received_on', v_post_on,
      'reference', COALESCE(v_doc.payment_reference, v_doc.statement_number),
      'source', 'remittance_import',
      'external_ref', COALESCE(v_doc.payment_key, 'sha256:' || v_doc.file_sha256 || ':' || v_doc.part_number)
    ));
    IF (v_result->>'duplicate')::boolean THEN
      RAISE EXCEPTION 'This payment was already posted (receipt %)', v_result->>'receipt_number';
    END IF;
    v_adjs := COALESCE(v_result->'adjustments', '[]'::jsonb);
  ELSE
    -- Nothing paid to the practice (e.g. the fund paid the member): adjustments on their own
    IF jsonb_array_length(COALESCE(p_post->'adjustments', '[]'::jsonb)) > 0 THEN
      v_base := LEAST(COALESCE(v_doc.payment_date, v_doc.document_date, ar_today()), ar_today());
      v_post_on := dc_first_open_day(v_doc.practice_id, v_base);
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'adjustments', '[]'::jsonb)) LOOP
      IF v_item->>'kind' NOT IN ('shortfall_transfer', 'write_off') THEN
        RAISE EXCEPTION 'Only shortfalls and write-offs are posted from a remittance';
      END IF;
      v_adj := ar_post_adjustment(v_item || jsonb_build_object('practice_id', v_doc.practice_id, 'effective_on', v_post_on));
      v_adjs := v_adjs || v_adj;
    END LOOP;
  END IF;

  -- New items in the rejection queue (a line already queued is not queued twice)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'rejections', '[]'::jsonb)) LOOP
    SELECT * INTO v_line FROM remittance_lines WHERE id = NULLIF(v_item->>'line_id', '')::uuid AND document_id = v_doc.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A rejection does not belong to a line of this remittance';
    END IF;
    INSERT INTO claim_rejections (
      practice_id, remittance_line_id, document_id, claim_line_id, invoice_id, patient_id, fund_code, service_date,
      tariff_code, claimed, paid, at_stake, reason_codes, fund_reason, category, plain_reason, suggested_action, fix_hint,
      needs_approval, follow_up_on, resubmit_by, previous_id, status, created_by, updated_by
    ) VALUES (
      v_doc.practice_id, v_line.id, v_doc.id, NULLIF(v_item->>'claim_line_id', '')::uuid, NULLIF(v_item->>'invoice_id', '')::uuid,
      NULLIF(v_item->>'patient_id', '')::uuid, v_doc.fund_code, v_line.service_date, v_line.tariff_code,
      COALESCE(v_line.claimed, 0), v_line.paid, GREATEST(COALESCE(remittance_amount(v_item->'at_stake'), 0), 0),
      remittance_text_array(v_item->'reason_codes'), NULLIF(btrim(v_item->>'fund_reason'), ''), v_item->>'category',
      COALESCE(NULLIF(btrim(v_item->>'plain_reason'), ''), 'The fund did not pay this line.'), v_item->>'suggested_action',
      NULLIF(btrim(v_item->>'fix_hint'), ''), COALESCE((v_item->>'needs_approval')::boolean, false),
      NULLIF(v_item->>'follow_up_on', '')::date, NULLIF(v_item->>'resubmit_by', '')::date,
      (SELECT r.id FROM claim_rejections r WHERE r.id = NULLIF(v_item->>'supersedes_id', '')::uuid AND r.practice_id = v_doc.practice_id),
      CASE WHEN v_item->>'suggested_action' = 'wait' THEN 'waiting' ELSE 'open' END,
      auth.uid(), auth.uid()
    )
    ON CONFLICT (remittance_line_id) DO NOTHING
    RETURNING * INTO v_rejection;
    IF v_rejection.id IS NOT NULL THEN
      v_created := v_created + 1;
      PERFORM claim_rejection_log(v_rejection, 'created', v_rejection.plain_reason, jsonb_build_object('document_id', v_doc.id, 'codes', v_rejection.reason_codes));
      -- The fund rejected the same claim line again: the earlier item is closed, this one carries on
      IF v_rejection.previous_id IS NOT NULL THEN
        UPDATE claim_rejections SET status = 'closed', resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
         WHERE id = v_rejection.previous_id AND status IN ('open', 'waiting', 'resubmitted')
        RETURNING * INTO v_rejection;
        IF FOUND THEN
          PERFORM claim_rejection_log(v_rejection, 'closed', 'Rejected again on ' || v_doc.file_name, jsonb_build_object('document_id', v_doc.id));
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Rejections this payment settles
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'resolves', '[]'::jsonb)) LOOP
    UPDATE claim_rejections
       SET status = 'resolved_by_payment', resolved_by_line_id = NULLIF(v_item->>'line_id', '')::uuid,
           resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
     WHERE id = NULLIF(v_item->>'rejection_id', '')::uuid AND practice_id = v_doc.practice_id
       AND status IN ('open', 'waiting', 'resubmitted', 'billed_patient', 'written_off')
       AND EXISTS (SELECT 1 FROM remittance_lines l WHERE l.id = NULLIF(v_item->>'line_id', '')::uuid AND l.document_id = v_doc.id)
    RETURNING * INTO v_rejection;
    IF FOUND THEN
      v_resolved := v_resolved + 1;
      PERFORM claim_rejection_log(v_rejection, 'resolved_by_payment', 'Paid on ' || v_doc.file_name, jsonb_build_object('document_id', v_doc.id));
    END IF;
  END LOOP;

  -- claims follow-up: the batches these lines were claimed in move on with the fund's answer (paid, part paid,
  -- not paid; src/components/finance/claims/status.ts). Only this practice's sent batches.
  PERFORM claim_batch_refresh_status(ARRAY(
    SELECT DISTINCT d.batch_header_id
      FROM remittance_lines l
      CROSS JOIN LATERAL unnest(array_append(l.claim_line_ids, l.claim_line_id)) AS ids(claim_line_id)
      JOIN batch_details d ON d.id = ids.claim_line_id
      JOIN batch_headers h ON h.id = d.batch_header_id
     WHERE l.document_id = v_doc.id AND l.posted_at IS NOT NULL AND h.practice_id = v_doc.practice_id
  ));

  UPDATE remittance_documents
     SET status = 'posted', receipt_id = NULLIF(v_result->>'receipt_id', '')::uuid, posted_by = auth.uid(), posted_at = now()
   WHERE id = v_doc.id;

  RETURN jsonb_build_object(
    'document_id', v_doc.id, 'already_posted', false,
    'receipt_id', v_result->'receipt_id', 'receipt_number', v_result->'receipt_number',
    'allocated', v_result->'allocated', 'unallocated', v_result->'unallocated',
    'adjustments', v_adjs, 'rejections_created', v_created, 'resolved', v_resolved,
    'posted_on', v_post_on, 'closed_month', CASE WHEN v_post_on IS DISTINCT FROM v_base THEN dc_month_label(v_base) END
  );
END $function$;

-- ---------------------------------------------------------------------------------------------
-- 5. Keying a fund payment: save, discard, post
-- ---------------------------------------------------------------------------------------------
-- Refuses a save, discard or post from an older version than the one stored
CREATE OR REPLACE FUNCTION public.fund_payment_draft_assert_version(p_row public.fund_payment_drafts, p_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_who text;
BEGIN
  IF p_row.status = 'posted' THEN
    RAISE EXCEPTION 'This payment was already posted' USING ERRCODE = '55000';
  END IF;
  IF p_row.status = 'discarded' THEN
    RAISE EXCEPTION 'This payment draft was discarded' USING ERRCODE = '55000';
  END IF;
  IF p_row.version IS DISTINCT FROM p_version THEN
    SELECT full_name INTO v_who FROM users WHERE id = p_row.updated_by;
    RAISE EXCEPTION 'Someone else saved this payment after you opened it (%, %). Open it again to carry on from their version.',
      COALESCE(NULLIF(btrim(v_who), ''), 'a colleague'), to_char(p_row.updated_at AT TIME ZONE 'Africa/Windhoek', 'FMDD Mon HH24:MI')
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fund_payment_draft_save(p_draft jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_uuid     constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_id       uuid;
  v_row      fund_payment_drafts%ROWTYPE;
  v_practice uuid;
  v_lines    jsonb := COALESCE(p_draft->'lines', '[]'::jsonb);
  v_rest     uuid[];
  v_problem  text;
BEGIN
  IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR jsonb_typeof(v_lines) <> 'array' THEN
    RAISE EXCEPTION 'The keyed payment could not be read' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_draft->>'id', '') IS NOT NULL THEN
    IF (p_draft->>'id') !~ c_uuid THEN
      RAISE EXCEPTION 'The keyed payment could not be read' USING ERRCODE = '22023';
    END IF;
    v_id := (p_draft->>'id')::uuid;
    SELECT * INTO v_row FROM fund_payment_drafts WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This payment draft no longer exists' USING ERRCODE = 'P0002';
    END IF;
    v_practice := v_row.practice_id;
  ELSIF (p_draft->>'practice_id') ~ c_uuid THEN
    v_practice := (p_draft->>'practice_id')::uuid;
  END IF;
  PERFORM ar_assert_member(v_practice);
  IF v_id IS NOT NULL THEN
    PERFORM fund_payment_draft_assert_version(v_row, NULLIF(p_draft->>'version', '')::integer);
  END IF;
  IF NULLIF(btrim(p_draft->>'fund_name'), '') IS NULL THEN
    RAISE EXCEPTION 'Choose the medical aid fund that paid' USING ERRCODE = '22023';
  END IF;

  -- Every line: an invoice of this practice; the claim line, when given, of that invoice in one of this practice's
  -- batches; what the fund paid in N$ and cents (0.00 when it paid nothing); each claim line once
  SELECT string_agg(DISTINCT problem, '; ') INTO v_problem FROM (
    SELECT CASE
      WHEN jsonb_typeof(e.value) <> 'object' OR COALESCE(e.value->>'invoice_id', '') !~ c_uuid THEN 'a line has no invoice'
      WHEN COALESCE(e.value->>'paid', '') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' THEN 'an amount is not in N$ and cents'
      WHEN NULLIF(e.value->>'claim_line_id', '') IS NOT NULL AND (e.value->>'claim_line_id') !~ c_uuid THEN 'a claim line could not be read'
      WHEN NOT EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.id = (e.value->>'invoice_id')::uuid AND i.practice_id = v_practice)
        THEN 'a line is on an invoice of another practice'
      WHEN NULLIF(e.value->>'claim_line_id', '') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id
         WHERE d.id = (e.value->>'claim_line_id')::uuid AND d.invoice_id = (e.value->>'invoice_id')::uuid AND h.practice_id = v_practice
      ) THEN 'a claim line is not on that invoice in this practice''s batches'
    END AS problem
    FROM jsonb_array_elements(v_lines) AS e(value)
  ) checked
  WHERE problem IS NOT NULL;
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'The keyed payment was not saved: %', v_problem USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) AS e(value)
     GROUP BY COALESCE(NULLIF(e.value->>'claim_line_id', ''), 'invoice:' || (e.value->>'invoice_id'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'The keyed payment was not saved: a claim line was keyed twice' USING ERRCODE = '22023';
  END IF;

  v_rest := ARRAY(
    SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(COALESCE(p_draft->'rest_to_patient', '[]'::jsonb)) AS value
     WHERE value ~ c_uuid
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_rest) AS r(id)
     WHERE NOT EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.id = r.id AND i.practice_id = v_practice)
  ) THEN
    RAISE EXCEPTION 'The keyed payment was not saved: an invoice of another practice' USING ERRCODE = '22023';
  END IF;

  -- Kept as given (claim line, invoice, amount as typed), unknown keys dropped
  v_lines := COALESCE((
    SELECT jsonb_agg(jsonb_build_object('claim_line_id', NULLIF(e.value->>'claim_line_id', ''), 'invoice_id', e.value->>'invoice_id',
                                        'paid', e.value->>'paid') ORDER BY e.ordinality)
      FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS e(value, ordinality)
  ), '[]'::jsonb);

  IF v_id IS NULL THEN
    INSERT INTO fund_payment_drafts (practice_id, fund_code, fund_name, amount, received_on, reference, method, notes, lines,
                                     unmatched, rest_to_patient, created_by, updated_by)
    VALUES (
      v_practice,
      NULLIF(upper(btrim(COALESCE(p_draft->>'fund_code', ''))), ''),
      btrim(p_draft->>'fund_name'),
      CASE WHEN NULLIF(btrim(COALESCE(p_draft->>'amount', '')), '') IS NULL THEN NULL ELSE ar_amount(p_draft->'amount') END,
      NULLIF(p_draft->>'received_on', '')::date,
      NULLIF(btrim(p_draft->>'reference'), ''),
      CASE WHEN p_draft->>'method' = 'eft' THEN 'eft' ELSE 'medical_aid' END,
      NULLIF(btrim(p_draft->>'notes'), ''),
      v_lines,
      CASE WHEN NULLIF(btrim(COALESCE(p_draft->>'unmatched', '')), '') IS NULL THEN 0 ELSE ar_amount(p_draft->'unmatched') END,
      v_rest,
      auth.uid(), auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE fund_payment_drafts
       SET fund_code = NULLIF(upper(btrim(COALESCE(p_draft->>'fund_code', ''))), ''),
           fund_name = btrim(p_draft->>'fund_name'),
           amount = CASE WHEN NULLIF(btrim(COALESCE(p_draft->>'amount', '')), '') IS NULL THEN NULL ELSE ar_amount(p_draft->'amount') END,
           received_on = NULLIF(p_draft->>'received_on', '')::date,
           reference = NULLIF(btrim(p_draft->>'reference'), ''),
           method = CASE WHEN p_draft->>'method' = 'eft' THEN 'eft' ELSE 'medical_aid' END,
           notes = NULLIF(btrim(p_draft->>'notes'), ''),
           lines = v_lines,
           unmatched = CASE WHEN NULLIF(btrim(COALESCE(p_draft->>'unmatched', '')), '') IS NULL THEN 0 ELSE ar_amount(p_draft->'unmatched') END,
           rest_to_patient = v_rest,
           version = version + 1,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'version', v_row.version, 'updated_at', v_row.updated_at, 'status', v_row.status);
END;
$$;
COMMENT ON FUNCTION public.fund_payment_draft_save(jsonb) IS
  'Creates or updates a fund payment being keyed (staff of its practice; refused from an older version).';

CREATE OR REPLACE FUNCTION public.fund_payment_draft_discard(p_draft_id uuid, p_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row fund_payment_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM fund_payment_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payment draft no longer exists' USING ERRCODE = 'P0002';
  END IF;
  PERFORM ar_assert_member(v_row.practice_id);
  PERFORM fund_payment_draft_assert_version(v_row, p_version);
  UPDATE fund_payment_drafts
     SET status = 'discarded', discarded_at = now(), discarded_by = auth.uid(), version = version + 1,
         updated_at = now(), updated_by = auth.uid()
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'version', v_row.version, 'status', v_row.status);
END;
$$;
COMMENT ON FUNCTION public.fund_payment_draft_discard(uuid, integer) IS
  'Discards a fund payment being keyed (staff of its practice; refused from an older version or once posted).';

CREATE OR REPLACE FUNCTION public.fund_payment_draft_post(p_draft_id uuid, p_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    fund_payment_drafts%ROWTYPE;
  v_keyed  numeric;
  v_alloc  jsonb;
  v_rest   jsonb;
  v_result jsonb;
  v_moved  integer;
BEGIN
  SELECT * INTO v_row FROM fund_payment_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payment draft no longer exists' USING ERRCODE = 'P0002';
  END IF;
  PERFORM ar_assert_member(v_row.practice_id);
  IF v_row.status = 'posted' THEN
    RETURN jsonb_build_object('draft_id', v_row.id, 'already_posted', true, 'receipt_id', v_row.receipt_id,
                              'receipt_number', (SELECT receipt_number FROM receipts WHERE id = v_row.receipt_id));
  END IF;
  PERFORM fund_payment_draft_assert_version(v_row, p_version);
  IF v_row.amount IS NULL THEN
    RAISE EXCEPTION 'Type the amount the fund paid before posting' USING ERRCODE = '22023';
  END IF;
  IF v_row.received_on IS NULL THEN
    RAISE EXCEPTION 'Choose the date the money came in before posting' USING ERRCODE = '22023';
  END IF;

  -- The control total: the keyed lines plus the credit kept on purpose are exactly the amount received
  SELECT COALESCE(sum((e.value->>'paid')::numeric), 0) + v_row.unmatched INTO v_keyed
    FROM jsonb_array_elements(v_row.lines) AS e(value);
  IF v_keyed <> v_row.amount THEN
    RAISE EXCEPTION 'The keyed lines and credit add up to N$ %, not the N$ % the fund paid. Key the difference before posting.',
      to_char(v_keyed, 'FM999999990.00'), to_char(v_row.amount, 'FM999999990.00') USING ERRCODE = '22023';
  END IF;

  -- One allocation per invoice: the sum of its keyed lines
  SELECT COALESCE(jsonb_agg(jsonb_build_object('invoice_id', s.invoice_id, 'portion', 'medical_aid', 'amount', s.total::text)
                            ORDER BY s.invoice_id), '[]'::jsonb)
    INTO v_alloc
    FROM (SELECT e.value->>'invoice_id' AS invoice_id, sum((e.value->>'paid')::numeric) AS total
            FROM jsonb_array_elements(v_row.lines) AS e(value) GROUP BY 1) s
   WHERE s.total > 0;

  -- Where staff asked: what the fund still owed before this payment, less what it paid now, moves to the patient
  SELECT COALESCE(jsonb_agg(jsonb_build_object('invoice_id', b.invoice_id,
                                               'amount', (b.medical_aid_outstanding - COALESCE(p.total, 0))::text)
                            ORDER BY b.invoice_id), '[]'::jsonb)
    INTO v_rest
    FROM ar_invoice_balances b
    LEFT JOIN (SELECT (e.value->>'invoice_id')::uuid AS invoice_id, sum((e.value->>'paid')::numeric) AS total
                 FROM jsonb_array_elements(v_row.lines) AS e(value) GROUP BY 1) p ON p.invoice_id = b.invoice_id
   WHERE b.invoice_id = ANY (v_row.rest_to_patient) AND b.practice_id = v_row.practice_id
     AND b.medical_aid_outstanding - COALESCE(p.total, 0) > 0;

  v_result := ar_post_receipt(jsonb_build_object(
    'practice_id', v_row.practice_id,
    'payer_type', 'medical_aid',
    'fund_name', v_row.fund_name,
    'method', v_row.method,
    'amount', v_row.amount::text,
    'received_on', v_row.received_on,
    'reference', v_row.reference,
    'notes', v_row.notes,
    'source', 'batch',
    'external_ref', 'fund_payment_draft:' || v_row.id,
    'allocations', v_alloc,
    'shortfalls', v_rest
  ));
  IF COALESCE((v_result->>'duplicate')::boolean, false) THEN
    RAISE EXCEPTION 'This payment was already posted (receipt %)', v_result->>'receipt_number';
  END IF;

  UPDATE fund_payment_drafts
     SET status = 'posted', receipt_id = (v_result->>'receipt_id')::uuid, posted_at = now(), posted_by = auth.uid(),
         version = version + 1, updated_at = now(), updated_by = auth.uid()
   WHERE id = v_row.id;

  -- The batches of the keyed claim lines move on (paid, part paid, not paid)
  v_moved := claim_batch_refresh_status(ARRAY(
    SELECT DISTINCT d.batch_header_id
      FROM jsonb_array_elements(v_row.lines) AS e(value)
      JOIN batch_details d ON d.id = NULLIF(e.value->>'claim_line_id', '')::uuid
      JOIN batch_headers h ON h.id = d.batch_header_id
     WHERE h.practice_id = v_row.practice_id
  ));

  RETURN v_result || jsonb_build_object('draft_id', v_row.id, 'already_posted', false, 'batches_moved', v_moved);
END;
$$;
COMMENT ON FUNCTION public.fund_payment_draft_post(uuid, integer) IS
  'Posts a keyed fund payment as one receipt once its lines and credit add up to the amount received; then moves the batches of its claim lines on.';

-- ---------------------------------------------------------------------------------------------
-- 6. Who may call what
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_batch_refresh_status(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fund_payment_draft_assert_version(public.fund_payment_drafts, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fund_payment_draft_save(jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.fund_payment_draft_discard(uuid, integer) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.fund_payment_draft_post(uuid, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fund_payment_draft_save(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_payment_draft_discard(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_payment_draft_post(uuid, integer) TO authenticated;
-- remittance_post_document keeps its grants (CREATE OR REPLACE does not change them): signed-in users only
REVOKE ALL ON FUNCTION public.remittance_post_document(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remittance_post_document(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.fund_payment_drafts'::regclass) THEN
    RAISE EXCEPTION 'Check failed: row-level security is off on fund_payment_drafts';
  END IF;
  IF has_table_privilege('anon', 'public.fund_payment_drafts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.fund_payment_drafts', 'INSERT')
     OR has_table_privilege('authenticated', 'public.fund_payment_drafts', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.fund_payment_drafts', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: fund_payment_drafts must be read-only for signed-in users and closed to anon';
  END IF;
  IF has_table_privilege('anon', 'public.claim_line_outcomes', 'SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.claim_line_outcomes'::regclass AND reloptions @> ARRAY['security_invoker=true']) THEN
    RAISE EXCEPTION 'Check failed: claim_line_outcomes must run with the caller''s rights and be closed to anon';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.claim_batch_refresh_status(uuid[])',
                              'public.fund_payment_draft_assert_version(public.fund_payment_drafts,integer)'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is internal', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.fund_payment_draft_save(jsonb)', 'public.fund_payment_draft_discard(uuid,integer)',
                              'public.fund_payment_draft_post(uuid,integer)', 'public.remittance_post_document(uuid,jsonb)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in users only', v_fn;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid IN ('public.claim_batch_refresh_status(uuid[])'::regprocedure, 'public.fund_payment_draft_save(jsonb)'::regprocedure,
                   'public.fund_payment_draft_discard(uuid,integer)'::regprocedure, 'public.fund_payment_draft_post(uuid,integer)'::regprocedure,
                   'public.remittance_post_document(uuid,jsonb)'::regprocedure)
       AND NOT (prosecdef AND proconfig @> ARRAY['search_path=public'])
  ) THEN
    RAISE EXCEPTION 'Check failed: the functions must run as their owner with search_path public';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
