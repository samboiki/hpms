-- Applied 2026-10-09 as migration claim_corrections_2026_10_09 (version 20261009104443; md5 of the part between BEGIN;
-- and ROLLBACK; = md5 of the stored statement: 2d1f30eeee739abd333c2d887e9ae11a). Live prosrc md5 afterwards:
-- claim_rejection_act 13e560949c0c30a722ec11cedae8ea51, stock_sync_invoice_line 1b7db7ab3c07127d6e7f95ac750d0858.
-- Rehearsed with simulated logins (rolled back): anon refused everything (42501); another practice's doctor refused every
-- RPC (42501) and saw 0 reversal rows; a receptionist resent an unpaid line (field 32 R, same invoice) and a second
-- resend was skipped ("Already waiting in batch 2"); an admin corrected date, authorisation, practitioner and ICD-10 (the
-- invoice line followed, 1 claim_corrected and 1 line_changed event, no re-batching), the rejection queue resubmitted
-- through the same path, a full line credit made 1 CN on the medical aid portion and 1 queued reversal, the credit file
-- was a C batch with status ready and no invoice id, reversing the CN cancelled the reversal and removed the empty file;
-- every sent batch line and header was byte-for-byte unchanged.
-- =============================================================================================
-- PROPOSAL: claim corrections after sending - credit notes line by line with reversals to the fund,
-- correcting a sent line, and sending unpaid lines again
-- File:   proposals/2026-10-09-claim-corrections.sql                    Drafted: 2026-10-09
-- Code:   src/utils/billing/claimFile.ts (CLAIM_TRANSACTION_TYPES), src/utils/billing/claimValidation.ts,
--         src/components/finance/claims/claimCorrections.ts (+ Service, CorrectClaimLineSheet, UnpaidClaimLines,
--         ReversalsToSend), src/components/finance/receipts/creditNoteLines.ts (+ CreditNoteLinesDialog,
--         creditNoteService), src/components/billing/creditNoteDocument.ts
--
-- Why (parity matrix 2026-10-08):
--   D24/F16  A credit note was one amount on one portion of an invoice, could not be printed, and a credit on a line
--            the fund had already been sent never reached the fund (the claim file header was always D).
--   D23      A sent claim line could only be corrected and sent again after the fund rejected it.
--   F9       Nothing sent again the lines a fund never answered.
--
-- What it adds
--   1. claim_assert_staff(practice): the caller works in the practice and may open Finance there (practice
--      administrators always; other roles as Settings > Users > Screen access says, the app's canOpenScreen rule).
--   2. claim_line_copy and claim_line_resend: the ONE way a claim line is copied into another batch, and the one way
--      a sent line goes to the fund again (into the fund's open batch, claim field 32 set). Never twice for the same
--      line (invoice + system transaction number + code) in one open batch.
--   3. claim_rejection_act('resubmit') now uses claim_line_resend (same rules and messages; it also refuses a line
--      already waiting in the open batch). The rest of the function is unchanged (replaced in place, see section 3).
--   4. credit_note_lines: which invoice lines a credit note credits, how much, which portion, and the line as it was.
--      claim_reversals: a credited medical-aid amount on a line already claimed in a sent batch, waiting for the
--      fund's next credit file; claim_reversal_states (view) says queued / in file / sent / cancelled.
--   5. credit_note_post_lines(payload): credits chosen lines and amounts with one reason. Each line's amount is split
--      over its medical aid and patient portions as the line is split (every line is one portion today); one
--      credit note (CN-) per portion touched, through ar_post_adjustment (its limits and audit apply). A line credited
--      in full returns its stock. Medical-aid credits on lines claimed in a sent batch queue a reversal.
--   6. claim_reversals_to_batch(practice, fund): puts the fund's queued reversals in a credit file: a batch with header
--      transaction type C (QEDI header field 4; D = claims), status 'ready' (never 'active', so the automatic
--      batching never adds claims to it), sent from Claims like any batch. Reversal lines carry no invoice id (the
--      reversal row links them to the invoice, credit note and the sent claim line), so re-batching an invoice can
--      never delete them.
--   7. claim_line_resend_blocker(line): the one rule for whether a sent line may go again (sent, a claim not a
--      reversal, linked to its invoice line, not paid, not refused unless it is being corrected, the latest claim
--      of the service, no medical-aid credit on it).
--      claim_line_correct(line, changes, note): corrects the date, dependant, ICD-10 codes, practitioner or
--      authorisation of a line in a sent batch and sends it again (field 32 R). Date, practitioner and codes are put
--      on the invoice line too (its change history records who and when); every correction is also written to
--      invoice_audit_events as 'claim_corrected'. Open rejection items of that line are marked resubmitted.
--   8. claim_lines_resend(lines, note): sends chosen unpaid lines again (field 32 R), each written to the invoice's
--      history as 'claim_resent'. Lines the fund paid or refused, lines sent again later, credited lines and lines
--      already waiting are skipped with the reason.
--   Sent batches are never rewritten: everything adds lines to open batches or makes a new credit batch.
--
-- Not changed: sync_invoice_to_batch, get_or_create_active_batch_id, ar_post_adjustment, ar_invoice_balances, and the
-- policies of the practice-isolation tables (invoice_services and invoices_enhanced are read and, for a correction,
-- invoice_services is updated by the SECURITY DEFINER function only).
--
-- How to apply: rehearse (scripts/db/rehearsal.ts), then apply the part between BEGIN; and ROLLBACK; as a migration.
-- Until then the screens say the corrections are not set up and credit notes stay per portion, as before.
-- Undo (after a COMMIT):
--   DROP FUNCTION public.claim_lines_resend(uuid[], text), public.claim_line_correct(uuid, jsonb, text),
--     public.claim_reversals_to_batch(uuid, text), public.credit_note_post_lines(jsonb);
--   DROP VIEW public.claim_reversal_states; DROP TABLE public.claim_reversals, public.credit_note_lines;
--   run claim_rejection_act and stock_sync_invoice_line as before (their earlier text: remittances and
--   dispensing-and-stock proposals), then DROP FUNCTION public.credit_note_line_fully_credited(uuid),
--   public.claim_line_resend(uuid, uuid, text, jsonb), public.claim_line_copy(uuid, uuid, jsonb),
--   public.claim_assert_staff(uuid); restore invoice_audit_events_action_check to its four actions.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: what this file builds on, exactly as it was read on 2026-10-09
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(name, ', ') INTO v_missing
    FROM (VALUES ('batch_headers'), ('batch_details'), ('invoices_enhanced'), ('invoice_services'), ('invoice_adjustments'),
                 ('invoice_audit_events'), ('claim_rejections'), ('claim_line_outcomes'), ('practice_settings'), ('patients'),
                 ('medical_aid_details'), ('users'), ('visits')) AS t(name)
   WHERE to_regclass('public.' || name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: tables missing: %', v_missing;
  END IF;
  SELECT string_agg(name, ', ') INTO v_missing
    FROM (VALUES ('public.ar_post_adjustment(jsonb)'), ('public.ar_amount(jsonb)'), ('public.ar_today()'),
                 ('public.ar_is_cancelled(text)'), ('public.ar_format_nad(numeric)'), ('public.claim_rejection_log(public.claim_rejections,text,text,jsonb)'),
                 ('public.get_or_create_active_batch_id(uuid,text)'), ('public.stock_sync_invoice(uuid,text,uuid)'),
                 ('public.portal_is_staff()')) AS t(name)
   WHERE to_regprocedure(name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions missing: %', v_missing;
  END IF;
  -- The two functions changed in place must be the versions this file was written against
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_rejection_act(uuid,text,jsonb)'::regprocedure) <> 'f1ae763832b8d5843d82e51baa966cac' THEN
    RAISE EXCEPTION 'Stopped: claim_rejection_act changed since 2026-10-09; merge section 3 by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.stock_sync_invoice_line(uuid,uuid,text,uuid)'::regprocedure) <> '4cd778d236fdccdf49870d36f83e85e8' THEN
    RAISE EXCEPTION 'Stopped: stock_sync_invoice_line changed since 2026-10-09; merge section 6 by hand';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'invoice_audit_events_action_check' AND conrelid = 'public.invoice_audit_events'::regclass)
     <> 'CHECK ((action = ANY (ARRAY[''invoice_changed''::text, ''line_added''::text, ''line_removed''::text, ''line_changed''::text])))' THEN
    RAISE EXCEPTION 'Stopped: invoice_audit_events_action_check changed since 2026-10-09; merge section 9 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Who may correct claims and issue credit notes
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_assert_staff(p_practice_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_access jsonb;
BEGIN
  SELECT u.role INTO v_role FROM users u
   WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND COALESCE(u.is_active, true);
  IF p_practice_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'You can only work on claims and credit notes of your own practice' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'admin' THEN
    RETURN;
  END IF;
  -- Settings > Users > Screen access (canOpenScreen in src/utils/auth/screenAccess.ts): a practice that chose who opens
  -- Finance lists those roles; a damaged entry opens it to administrators only; no entry opens it to every role
  SELECT s.setting_value INTO v_access FROM practice_settings s
   WHERE s.practice_id = p_practice_id AND s.setting_key = 'screen_access';
  IF jsonb_typeof(v_access) = 'object' AND v_access ? 'finance'
     AND NOT (jsonb_typeof(v_access -> 'finance') = 'array' AND (v_access -> 'finance') ? COALESCE(v_role, '')) THEN
    RAISE EXCEPTION 'Your role does not open Finance in this practice, so it cannot change claims or credit notes' USING ERRCODE = '42501';
  END IF;
END $$;
COMMENT ON FUNCTION public.claim_assert_staff(uuid) IS
  'Raises unless the caller is active staff of the practice who may open Finance (administrators always; others per screen_access). Internal.';

-- ---------------------------------------------------------------------------------------------
-- 2. The one copy of a claim line into another batch, and the one resend
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_line_copy(p_line_id uuid, p_batch_id uuid, p_changes jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detail batch_details%ROWTYPE;
  v_next   integer;
  v_row    jsonb;
  v_cols   text;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_detail FROM batch_details WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The claim line was not found';
  END IF;
  PERFORM 1 FROM batch_headers WHERE id = p_batch_id FOR UPDATE;
  SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_next FROM batch_details WHERE batch_header_id = p_batch_id;
  v_row := (to_jsonb(v_detail) - 'id') || COALESCE(p_changes, '{}'::jsonb) || jsonb_build_object(
    'batch_header_id', p_batch_id, 'transaction_number_in_batch', v_next, 'created_at', now(), 'updated_at', now());
  -- Every column the database does not fill itself (not the id, not generated columns)
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_cols
    FROM pg_attribute a
   WHERE a.attrelid = 'public.batch_details'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND a.attgenerated = '' AND a.attidentity = '' AND a.attname <> 'id';
  EXECUTE format('INSERT INTO public.batch_details (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.batch_details, $1) RETURNING id', v_cols)
    USING v_row INTO v_new_id;
  RETURN v_new_id;
END $$;
COMMENT ON FUNCTION public.claim_line_copy(uuid, uuid, jsonb) IS
  'Copies a claim line (batch_details) into a batch as its next line, with the given column changes. Internal: used by claim_line_resend and claim_reversals_to_batch.';

CREATE OR REPLACE FUNCTION public.claim_line_resend(p_practice_id uuid, p_line_id uuid, p_flag text, p_changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detail  batch_details%ROWTYPE;
  v_batch   uuid;
  v_number  integer;
  v_waiting integer;
  v_flag    text := left(COALESCE(NULLIF(btrim(p_flag), ''), 'R'), 5);
  v_new_id  uuid;
BEGIN
  SELECT d.* INTO v_detail FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id
   WHERE d.id = p_line_id AND h.practice_id = p_practice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The claim line was not found in this practice''s batches';
  END IF;
  v_batch := get_or_create_active_batch_id(p_practice_id, v_detail.medical_aid_reference);
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'No open batch could be opened for %', v_detail.medical_aid_reference;
  END IF;
  IF v_batch = v_detail.batch_header_id THEN
    RAISE EXCEPTION 'This line is still in an unsent batch: correct it there';
  END IF;
  SELECT batch_number INTO v_number FROM batch_headers WHERE id = v_batch FOR UPDATE;
  -- Never twice for the same line in one open batch: the same service of the same invoice
  IF v_detail.invoice_id IS NOT NULL THEN
    SELECT d.transaction_number_in_batch INTO v_waiting FROM batch_details d
     WHERE d.batch_header_id = v_batch AND d.invoice_id = v_detail.invoice_id
       AND d.system_transaction_number IS NOT DISTINCT FROM v_detail.system_transaction_number
       AND d.bhf_tariff_code = v_detail.bhf_tariff_code
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Already waiting in batch % (line %): it goes to the fund with that batch', v_number, v_waiting;
    END IF;
  END IF;
  v_new_id := claim_line_copy(p_line_id, v_batch, COALESCE(p_changes, '{}'::jsonb) || jsonb_build_object('resubmission_flag', v_flag));
  RETURN jsonb_build_object('batch_id', v_batch, 'batch_number', v_number, 'line_id', v_new_id,
    'line_number', (SELECT transaction_number_in_batch FROM batch_details WHERE id = v_new_id), 'flag', v_flag);
END $$;
COMMENT ON FUNCTION public.claim_line_resend(uuid, uuid, text, jsonb) IS
  'Sends a claim line to the fund again: a copy in the fund''s open batch with claim field 32 set, never twice in one open batch. Internal: used by claim_rejection_act, claim_line_correct and claim_lines_resend.';

REVOKE ALL ON FUNCTION public.claim_assert_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_line_copy(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_line_resend(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. claim_rejection_act('resubmit') goes through claim_line_resend. Its live text is read and the block that
--    copied the line is replaced; the block must be found exactly once (checked above: the md5 is the 2026-10-09 one).
--    CREATE OR REPLACE keeps the owner and the grants (authenticated may run it, anon not).
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def   text;
  v_from  text := $f$    SELECT d.* INTO v_detail FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id$f$;
  v_to    text := $t$      USING v_row INTO v_new_id;$t$;
  v_new   text := $n$    v_flag := left(COALESCE(NULLIF(btrim(p_payload->>'flag'), ''), 'R'), 5);
    -- Only these corrections may be typed in the queue; the rest is fixed on the invoice
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_changes
      FROM jsonb_each(COALESCE(p_payload->'changes', '{}'::jsonb))
     WHERE key IN ('tooth_numbers', 'diagnostic_code', 'authorisation_number', 'medical_aid_membership_number', 'free_text')
       AND jsonb_typeof(value) = 'string';
    -- The one way a sent line goes to the fund again (claim_line_resend, proposals/2026-10-09-claim-corrections.sql)
    v_row := claim_line_resend(r.practice_id, r.claim_line_id, v_flag, v_changes);
    v_batch := (v_row->>'batch_id')::uuid;
    v_new_id := (v_row->>'line_id')::uuid;$n$;
  v_start integer;
  v_end   integer;
BEGIN
  SELECT pg_get_functiondef('public.claim_rejection_act(uuid,text,jsonb)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from) <> 1
     OR (length(v_def) - length(replace(v_def, v_to, ''))) / length(v_to) <> 1 THEN
    RAISE EXCEPTION 'claim_rejection_act: the resubmission block was not found exactly once; nothing changed';
  END IF;
  v_start := position(v_from in v_def);
  v_end := position(v_to in v_def) + length(v_to);
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'claim_rejection_act: the resubmission block is not in the expected order; nothing changed';
  END IF;
  EXECUTE left(v_def, v_start - 1) || v_new || substr(v_def, v_end);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 4. Credit note lines and reversals to the fund
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_note_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id         uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- The credit note (invoice_adjustments, kind credit_note) this line belongs to: one per portion
  adjustment_id       uuid NOT NULL REFERENCES public.invoice_adjustments(id) ON DELETE RESTRICT,
  invoice_id          uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  -- The invoice line credited. No foreign key: the line as it was is kept below, also if the line is replaced later
  invoice_line_id     uuid,
  system_transaction_number integer,
  portion             text NOT NULL CHECK (portion IN ('medical_aid', 'patient')),
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  -- Units credited: the line's quantity when credited in full
  quantity            numeric(9,2) NOT NULL CHECK (quantity > 0),
  line_code           text NOT NULL,
  line_description    text,
  service_date        date,
  tooth_number        text,
  practitioner_id     uuid,
  unit_price          numeric(14,2),
  line_quantity       numeric(9,2),
  line_total          numeric(14,2) NOT NULL,
  created_by          uuid DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_note_lines_adjustment_idx ON public.credit_note_lines (adjustment_id);
CREATE INDEX IF NOT EXISTS credit_note_lines_invoice_idx ON public.credit_note_lines (invoice_id, invoice_line_id);
COMMENT ON TABLE public.credit_note_lines IS
  'The invoice lines a credit note credits: amount and portion per line, and the line as it was (printed on the credit note). Written only by credit_note_post_lines.';

CREATE TABLE IF NOT EXISTS public.claim_reversals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id         uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  credit_note_line_id uuid NOT NULL UNIQUE REFERENCES public.credit_note_lines(id) ON DELETE RESTRICT,
  adjustment_id       uuid NOT NULL REFERENCES public.invoice_adjustments(id) ON DELETE RESTRICT,
  invoice_id          uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  patient_id          uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  -- The claim line the fund received (the latest sent claim of the service) and its batch
  claim_line_id       uuid NOT NULL REFERENCES public.batch_details(id) ON DELETE RESTRICT,
  claim_batch_id      uuid NOT NULL REFERENCES public.batch_headers(id) ON DELETE RESTRICT,
  fund_reference      text NOT NULL,
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  quantity            numeric(9,2) NOT NULL CHECK (quantity > 0),
  -- What the claim carried: the service date and the treating practitioner's HPCNA number
  service_date        date,
  hpcna_number        text,
  -- The credit file (batch with transaction type C) and its line, once the reversal is put in one
  batch_id            uuid REFERENCES public.batch_headers(id) ON DELETE SET NULL,
  batch_line_id       uuid REFERENCES public.batch_details(id) ON DELETE SET NULL,
  created_by          uuid DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_reversals_queue_idx ON public.claim_reversals (practice_id, fund_reference, batch_line_id);
CREATE INDEX IF NOT EXISTS claim_reversals_claim_idx ON public.claim_reversals (claim_batch_id, claim_line_id);
CREATE INDEX IF NOT EXISTS claim_reversals_invoice_idx ON public.claim_reversals (invoice_id);
CREATE INDEX IF NOT EXISTS claim_reversals_batch_idx ON public.claim_reversals (batch_id);
COMMENT ON TABLE public.claim_reversals IS
  'A medical-aid credit on a line the fund was already sent, waiting for (or sent in) the fund''s credit file. Written only by credit_note_post_lines and claim_reversals_to_batch.';

ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_reversals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_note_lines_select ON public.credit_note_lines;
CREATE POLICY credit_note_lines_select ON public.credit_note_lines
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = credit_note_lines.practice_id));
DROP POLICY IF EXISTS claim_reversals_select ON public.claim_reversals;
CREATE POLICY claim_reversals_select ON public.claim_reversals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = claim_reversals.practice_id));
DROP POLICY IF EXISTS portal_staff_only ON public.credit_note_lines;
CREATE POLICY portal_staff_only ON public.credit_note_lines
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
DROP POLICY IF EXISTS portal_staff_only ON public.claim_reversals;
CREATE POLICY portal_staff_only ON public.claim_reversals
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
REVOKE ALL ON public.credit_note_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.claim_reversals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.credit_note_lines TO authenticated;
GRANT SELECT ON public.claim_reversals TO authenticated;

-- Where each reversal stands, in one place (the screens show it on the credit note and on the batches)
CREATE OR REPLACE VIEW public.claim_reversal_states WITH (security_invoker = true) AS
SELECT r.id,
       r.practice_id,
       r.credit_note_line_id,
       r.adjustment_id,
       a.adjustment_number,
       r.invoice_id,
       r.patient_id,
       r.claim_line_id,
       r.claim_batch_id,
       ob.batch_number AS claim_batch_number,
       r.fund_reference,
       r.amount,
       r.quantity,
       r.batch_id,
       cb.batch_number AS credit_batch_number,
       cb.sent_at AS credit_sent_at,
       r.batch_line_id,
       l.line_code,
       r.created_at,
       CASE
         WHEN r.batch_line_id IS NOT NULL AND (cb.sent_at IS NOT NULL OR lower(COALESCE(cb.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready')) THEN 'sent'
         WHEN a.reversed_at IS NOT NULL THEN 'cancelled'
         WHEN r.batch_line_id IS NOT NULL THEN 'in_file'
         ELSE 'queued'
       END AS state
  FROM public.claim_reversals r
  JOIN public.invoice_adjustments a ON a.id = r.adjustment_id
  JOIN public.credit_note_lines l ON l.id = r.credit_note_line_id
  JOIN public.batch_headers ob ON ob.id = r.claim_batch_id
  LEFT JOIN public.batch_headers cb ON cb.id = r.batch_id;
COMMENT ON VIEW public.claim_reversal_states IS
  'Each reversal with its state: queued (waiting for a credit file), in_file (in a credit file not sent yet), sent, or cancelled (its credit note was reversed before it was sent).';
REVOKE ALL ON public.claim_reversal_states FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.claim_reversal_states TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Crediting chosen lines with one reason
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_note_post_lines(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practice   uuid := NULLIF(p_payload->>'practice_id', '')::uuid;
  v_reason     text := NULLIF(btrim(COALESCE(p_payload->>'reason', '')), '');
  v_invoice    invoices_enhanced%ROWTYPE;
  v_item       jsonb;
  v_line       invoice_services%ROWTYPE;
  v_seen       uuid[] := '{}';
  v_amount     numeric(14,2);
  v_left       numeric(14,2);
  v_total      numeric(14,2);
  v_aid        numeric(14,2);
  v_qty        numeric(9,2);
  v_unit       numeric(14,2);
  v_parts      jsonb := '[]'::jsonb;
  v_aid_sum    numeric(14,2) := 0;
  v_patient_sum numeric(14,2) := 0;
  v_waiting    integer;
  v_adj_aid    jsonb;
  v_adj_patient jsonb;
  v_part       jsonb;
  v_cnl_id     uuid;
  v_claim      record;
  v_hpcna      text;
  v_reversals  integer := 0;
  v_notes      jsonb := '[]'::jsonb;
BEGIN
  PERFORM claim_assert_staff(v_practice);
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the lines are credited: it is printed on the credit note';
  END IF;
  IF length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Keep the reason under 500 characters';
  END IF;
  SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = NULLIF(p_payload->>'invoice_id', '')::uuid FOR UPDATE;
  IF NOT FOUND OR v_invoice.practice_id IS DISTINCT FROM v_practice THEN
    RAISE EXCEPTION 'Invoice not found in this practice';
  END IF;
  IF ar_is_cancelled(v_invoice.payment_status) THEN
    RAISE EXCEPTION 'Invoice % is cancelled', v_invoice.invoice_number;
  END IF;
  IF jsonb_typeof(p_payload->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'Choose the lines to credit';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'lines') LOOP
    SELECT * INTO v_line FROM invoice_services
     WHERE id = NULLIF(v_item->>'invoice_line_id', '')::uuid AND invoice_id = v_invoice.id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A chosen line is not on invoice %', v_invoice.invoice_number;
    END IF;
    IF v_line.id = ANY (v_seen) THEN
      RAISE EXCEPTION 'Line % is chosen twice', v_line.code;
    END IF;
    v_seen := v_seen || v_line.id;
    v_amount := ar_amount(v_item->'amount');
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Enter the amount to credit on line %', v_line.code;
    END IF;
    v_total := round(COALESCE(v_line.total_price, 0), 2);
    v_left := v_total - COALESCE((
      SELECT sum(c.amount) FROM credit_note_lines c JOIN invoice_adjustments a ON a.id = c.adjustment_id
       WHERE c.invoice_line_id = v_line.id AND a.reversed_at IS NULL), 0);
    IF v_amount > v_left THEN
      RAISE EXCEPTION 'Line % can be credited at most %', v_line.code, ar_format_nad(GREATEST(v_left, 0));
    END IF;
    -- The medical aid and patient parts follow the line's own split
    v_aid := LEAST(round(v_amount * GREATEST(COALESCE(v_line.medical_aid_covered, 0), 0) / v_total, 2), v_amount);
    -- A medical-aid claim not sent yet is corrected in its batch, never credited: the fund would still be claimed
    IF v_aid > 0 THEN
      SELECT b.batch_number INTO v_waiting FROM batch_details d JOIN batch_headers b ON b.id = d.batch_header_id
       WHERE d.invoice_id = v_invoice.id AND d.system_transaction_number IS NOT DISTINCT FROM v_line.system_transaction_number
         AND d.bhf_tariff_code IS NOT NULL
         AND b.sent_at IS NULL AND lower(COALESCE(b.status, 'active')) IN ('active', 'open', 'draft', 'ready')
       LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'Line % is waiting to be claimed in batch % (not sent yet): remove the invoice from that batch and correct it instead of crediting it', v_line.code, v_waiting;
      END IF;
    END IF;
    -- Units credited: all of them for the whole line, else the whole units the amount pays for, else the line's
    v_unit := round(COALESCE(v_line.unit_price, 0), 2);
    v_qty := CASE
      WHEN v_amount = v_total THEN GREATEST(COALESCE(v_line.quantity, 1), 1)
      WHEN v_unit > 0 AND mod(v_amount, v_unit) = 0 AND v_amount / v_unit < COALESCE(v_line.quantity, 1) THEN v_amount / v_unit
      ELSE GREATEST(COALESCE(v_line.quantity, 1), 1)
    END;
    v_parts := v_parts || jsonb_build_object('line_id', v_line.id, 'aid', v_aid, 'patient', v_amount - v_aid, 'quantity', v_qty);
    v_aid_sum := v_aid_sum + v_aid;
    v_patient_sum := v_patient_sum + (v_amount - v_aid);
  END LOOP;

  -- One credit note per portion (the existing limits, numbering, audit and stock trigger apply)
  IF v_aid_sum > 0 THEN
    v_adj_aid := ar_post_adjustment(jsonb_build_object('practice_id', v_practice, 'kind', 'credit_note', 'invoice_id', v_invoice.id,
      'portion', 'medical_aid', 'amount', v_aid_sum, 'reason', v_reason));
    v_notes := v_notes || (v_adj_aid || jsonb_build_object('portion', 'medical_aid', 'amount', v_aid_sum));
  END IF;
  IF v_patient_sum > 0 THEN
    v_adj_patient := ar_post_adjustment(jsonb_build_object('practice_id', v_practice, 'kind', 'credit_note', 'invoice_id', v_invoice.id,
      'portion', 'patient', 'amount', v_patient_sum, 'reason', v_reason));
    v_notes := v_notes || (v_adj_patient || jsonb_build_object('portion', 'patient', 'amount', v_patient_sum));
  END IF;

  FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts) LOOP
    SELECT * INTO v_line FROM invoice_services WHERE id = (v_part->>'line_id')::uuid;
    IF (v_part->>'patient')::numeric > 0 THEN
      INSERT INTO credit_note_lines (practice_id, adjustment_id, invoice_id, invoice_line_id, system_transaction_number, portion, amount, quantity,
                                     line_code, line_description, service_date, tooth_number, practitioner_id, unit_price, line_quantity, line_total)
      VALUES (v_practice, (v_adj_patient->>'id')::uuid, v_invoice.id, v_line.id, v_line.system_transaction_number, 'patient',
              (v_part->>'patient')::numeric, (v_part->>'quantity')::numeric, v_line.code, v_line.description, v_line.service_date,
              v_line.tooth_number, v_line.practitioner_id, v_line.unit_price, v_line.quantity, round(COALESCE(v_line.total_price, 0), 2));
    END IF;
    IF (v_part->>'aid')::numeric > 0 THEN
      INSERT INTO credit_note_lines (practice_id, adjustment_id, invoice_id, invoice_line_id, system_transaction_number, portion, amount, quantity,
                                     line_code, line_description, service_date, tooth_number, practitioner_id, unit_price, line_quantity, line_total)
      VALUES (v_practice, (v_adj_aid->>'id')::uuid, v_invoice.id, v_line.id, v_line.system_transaction_number, 'medical_aid',
              (v_part->>'aid')::numeric, (v_part->>'quantity')::numeric, v_line.code, v_line.description, v_line.service_date,
              v_line.tooth_number, v_line.practitioner_id, v_line.unit_price, v_line.quantity, round(COALESCE(v_line.total_price, 0), 2))
      RETURNING id INTO v_cnl_id;
      -- The latest claim of this service the fund received, if any: the fund is told with a reversal
      SELECT d.id, d.batch_header_id, d.medical_aid_reference, d.service_date, d.treating_doctor_hpcsa_number, d.visit_id INTO v_claim
        FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id
       WHERE d.invoice_id = v_invoice.id AND d.system_transaction_number IS NOT DISTINCT FROM v_line.system_transaction_number
         AND d.bhf_tariff_code IS NOT NULL
         AND (h.sent_at IS NOT NULL OR lower(COALESCE(h.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
         AND upper(COALESCE(h.transaction_type, 'D')) = 'D'
       ORDER BY h.sent_at DESC NULLS LAST, d.created_at DESC
       LIMIT 1;
      IF FOUND THEN
        -- As the claim file carried it: the line's own practitioner, else the visit's, else what the batch row holds
        SELECT NULLIF(btrim(u.hpcsa_number), '') INTO v_hpcna FROM users u
         WHERE u.id = COALESCE(v_line.practitioner_id, (SELECT v.doctor_id FROM visits v WHERE v.id = v_claim.visit_id));
        INSERT INTO claim_reversals (practice_id, credit_note_line_id, adjustment_id, invoice_id, patient_id, claim_line_id, claim_batch_id,
                                     fund_reference, amount, quantity, service_date, hpcna_number)
        VALUES (v_practice, v_cnl_id, (v_adj_aid->>'id')::uuid, v_invoice.id, v_invoice.patient_id, v_claim.id, v_claim.batch_header_id,
                v_claim.medical_aid_reference, (v_part->>'aid')::numeric, (v_part->>'quantity')::numeric,
                COALESCE(v_line.service_date, (SELECT v.visit_date FROM visits v WHERE v.id = v_claim.visit_id),
                         CASE WHEN v_claim.service_date ~ '^\d{8}$' THEN to_date(v_claim.service_date, 'YYYYMMDD') END),
                COALESCE(v_hpcna, NULLIF(btrim(v_claim.treating_doctor_hpcsa_number), '')));
        v_reversals := v_reversals + 1;
      END IF;
    END IF;
  END LOOP;

  -- A line credited in full returns its stock (stock_sync_invoice_line, section 6)
  PERFORM stock_sync_invoice(v_invoice.id, 'Credited by credit note ' || COALESCE(v_adj_aid->>'number', v_adj_patient->>'number'),
                             COALESCE((v_adj_aid->>'id')::uuid, (v_adj_patient->>'id')::uuid));

  RETURN jsonb_build_object('invoice_id', v_invoice.id, 'credit_notes', v_notes, 'reversals', v_reversals);
END $$;
COMMENT ON FUNCTION public.credit_note_post_lines(jsonb) IS
  'Credits chosen invoice lines and amounts with one reason: {practice_id, invoice_id, reason, lines: [{invoice_line_id, amount}]}. One credit note per portion; reversals queued for lines the fund was sent.';

-- ---------------------------------------------------------------------------------------------
-- 6. A line credited in full returns its stock: stock_sync_invoice_line also treats such a line as not sold.
--    Its live text is read and one condition is added (found exactly once; md5 checked above).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_note_line_fully_credited(p_line_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT round(COALESCE(s.total_price, 0), 2) FROM invoice_services s WHERE s.id = p_line_id), 0) > 0
     AND COALESCE((SELECT sum(c.amount) FROM credit_note_lines c JOIN invoice_adjustments a ON a.id = c.adjustment_id
                    WHERE c.invoice_line_id = p_line_id AND a.reversed_at IS NULL), 0)
         >= (SELECT round(COALESCE(s.total_price, 0), 2) FROM invoice_services s WHERE s.id = p_line_id)
$$;
COMMENT ON FUNCTION public.credit_note_line_fully_credited(uuid) IS
  'True when credit notes that are not reversed credit the whole invoice line. Internal: used by stock_sync_invoice_line.';
REVOKE ALL ON FUNCTION public.credit_note_line_fully_credited(uuid) FROM PUBLIC, anon, authenticated;

DO $migration$
DECLARE
  v_def text;
  v_old text := $o$AND NOT stock_invoice_fully_credited(p_invoice_id, v_invoice.total);$o$;
  v_new text := $n$AND NOT stock_invoice_fully_credited(p_invoice_id, v_invoice.total)
              -- A line credited in full by credit note lines comes back to stock too (2026-10-09-claim-corrections.sql)
              AND NOT credit_note_line_fully_credited(p_line_id);$n$;
BEGIN
  SELECT pg_get_functiondef('public.stock_sync_invoice_line(uuid,uuid,text,uuid)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'stock_sync_invoice_line: the condition was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 7. The fund's credit file: queued reversals go into a batch with transaction type C
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_reversals_to_batch(p_practice_id uuid, p_fund text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fund    text := upper(btrim(COALESCE(p_fund, '')));
  v_batch   batch_headers%ROWTYPE;
  v_number  text;
  r         record;
  v_line    uuid;
  v_added   integer := 0;
  v_removed integer := 0;
BEGIN
  PERFORM claim_assert_staff(p_practice_id);
  IF v_fund = '' THEN
    RAISE EXCEPTION 'Choose the fund';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('claim_reversals:' || p_practice_id::text || ':' || v_fund));

  -- The fund's credit file that is not sent yet, if there is one
  SELECT * INTO v_batch FROM batch_headers
   WHERE practice_id = p_practice_id AND upper(medical_aid_reference) = v_fund AND upper(COALESCE(transaction_type, 'D')) = 'C'
     AND sent_at IS NULL AND lower(COALESCE(status, 'active')) IN ('active', 'open', 'draft', 'ready')
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  -- Reversals whose credit note was reversed before the file went: taken out of it
  IF v_batch.id IS NOT NULL THEN
    FOR r IN
      SELECT cr.id, cr.batch_line_id FROM claim_reversals cr JOIN invoice_adjustments a ON a.id = cr.adjustment_id
       WHERE cr.batch_id = v_batch.id AND cr.batch_line_id IS NOT NULL AND a.reversed_at IS NOT NULL
       FOR UPDATE OF cr
    LOOP
      UPDATE claim_reversals SET batch_id = NULL, batch_line_id = NULL WHERE id = r.id;
      DELETE FROM batch_details WHERE id = r.batch_line_id AND batch_header_id = v_batch.id;
      v_removed := v_removed + 1;
    END LOOP;
  END IF;

  FOR r IN
    SELECT cr.* FROM claim_reversals cr JOIN invoice_adjustments a ON a.id = cr.adjustment_id
     WHERE cr.practice_id = p_practice_id AND upper(cr.fund_reference) = v_fund AND cr.batch_line_id IS NULL AND a.reversed_at IS NULL
     ORDER BY cr.created_at, cr.id
     FOR UPDATE OF cr
  LOOP
    IF v_batch.id IS NULL THEN
      SELECT NULLIF(btrim(practice_number), '') INTO v_number FROM practices WHERE id = p_practice_id;
      IF v_number IS NULL THEN
        RAISE EXCEPTION 'The practice has no practice number: add it to the practice''s details first';
      END IF;
      -- Status 'ready', never 'active': the automatic batching (get_or_create_active_batch_id) only uses 'active' batches
      INSERT INTO batch_headers (practice_id, practice_number, batch_number, batch_date, medical_aid_reference, status, transaction_type)
      VALUES (p_practice_id, v_number, 0, ar_today(), (SELECT medical_aid_reference FROM batch_headers WHERE id = r.claim_batch_id), 'ready', 'C')
      RETURNING * INTO v_batch;
    END IF;
    -- The line as the fund received it, for the amount credited; no invoice or visit id (the reversal row links them),
    -- so re-batching the invoice never touches it
    v_line := claim_line_copy(r.claim_line_id, v_batch.id, jsonb_build_object(
      'invoice_id', NULL, 'visit_id', NULL, 'visit_service_id', NULL,
      'service_amount', r.amount, 'discount_amount', 0, 'number_of_services', r.quantity, 'resubmission_flag', '',
      'service_date', COALESCE(to_char(r.service_date, 'YYYYMMDD'), (SELECT service_date FROM batch_details WHERE id = r.claim_line_id)),
      'treating_doctor_hpcsa_number', COALESCE(r.hpcna_number, (SELECT treating_doctor_hpcsa_number FROM batch_details WHERE id = r.claim_line_id))));
    UPDATE claim_reversals SET batch_id = v_batch.id, batch_line_id = v_line WHERE id = r.id;
    v_added := v_added + 1;
  END LOOP;

  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'No reversals are waiting to be sent to %', v_fund;
  END IF;
  -- A credit file left empty (every reversal in it was cancelled) is removed
  IF NOT EXISTS (SELECT 1 FROM batch_details WHERE batch_header_id = v_batch.id) THEN
    DELETE FROM batch_headers WHERE id = v_batch.id;
    RETURN jsonb_build_object('batch_id', NULL, 'batch_number', NULL, 'added', 0, 'removed', v_removed);
  END IF;
  RETURN jsonb_build_object('batch_id', v_batch.id, 'batch_number', v_batch.batch_number, 'added', v_added, 'removed', v_removed);
END $$;
COMMENT ON FUNCTION public.claim_reversals_to_batch(uuid, text) IS
  'Puts the fund''s queued reversals in its credit file (a batch with transaction type C, status ready), made if needed; takes out reversals of credit notes reversed since. Sent from Claims like any batch.';

-- ---------------------------------------------------------------------------------------------
-- 8. Correcting a sent line, and sending unpaid lines again
-- ---------------------------------------------------------------------------------------------
-- Why a sent line may not go to the fund again (NULL: it may). One rule for both screens.
CREATE OR REPLACE FUNCTION public.claim_line_resend_blocker(p_line_id uuid, p_allow_refused boolean)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detail  batch_details%ROWTYPE;
  v_batch   batch_headers%ROWTYPE;
  v_outcome text;
  v_newer   integer;
  v_line_id uuid;
BEGIN
  SELECT * INTO v_detail FROM batch_details WHERE id = p_line_id;
  IF NOT FOUND THEN
    RETURN 'The claim line was not found';
  END IF;
  SELECT * INTO v_batch FROM batch_headers WHERE id = v_detail.batch_header_id;
  IF v_batch.sent_at IS NULL AND lower(COALESCE(v_batch.status, 'active')) IN ('active', 'open', 'draft', 'ready') THEN
    RETURN format('Batch %s has not been sent yet: correct the invoice before it is sent', v_batch.batch_number);
  END IF;
  IF upper(COALESCE(v_batch.transaction_type, 'D')) <> 'D' THEN
    RETURN 'It is a reversal in a credit file';
  END IF;
  IF v_detail.invoice_id IS NULL OR v_detail.system_transaction_number IS NULL THEN
    RETURN 'It is not linked to an invoice line';
  END IF;
  SELECT o.outcome INTO v_outcome FROM claim_line_outcomes o WHERE o.claim_line_id = p_line_id;
  IF v_outcome IN ('paid', 'part_paid') THEN
    RETURN 'The fund paid it: sending it again would claim it twice';
  END IF;
  IF v_outcome = 'rejected' AND NOT p_allow_refused THEN
    RETURN 'The fund refused it: correct it first';
  END IF;
  -- Only the latest claim of a service goes again
  SELECT h.batch_number INTO v_newer FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id
   WHERE d.invoice_id = v_detail.invoice_id AND d.system_transaction_number = v_detail.system_transaction_number
     AND d.id <> v_detail.id AND upper(COALESCE(h.transaction_type, 'D')) = 'D'
     AND (h.sent_at IS NOT NULL OR lower(COALESCE(h.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
     AND COALESCE(h.sent_at, h.created_at) > COALESCE(v_batch.sent_at, v_batch.created_at)
   LIMIT 1;
  IF FOUND THEN
    RETURN format('It was already sent again in batch %s', v_newer);
  END IF;
  -- A line with a medical-aid credit is not claimed again blindly
  SELECT s.id INTO v_line_id FROM invoice_services s
   WHERE s.invoice_id = v_detail.invoice_id AND s.system_transaction_number = v_detail.system_transaction_number LIMIT 1;
  IF EXISTS (SELECT 1 FROM credit_note_lines c JOIN invoice_adjustments a ON a.id = c.adjustment_id
              WHERE c.invoice_id = v_detail.invoice_id AND c.portion = 'medical_aid' AND a.reversed_at IS NULL
                AND (c.invoice_line_id = v_line_id OR c.system_transaction_number = v_detail.system_transaction_number)) THEN
    RETURN 'It has a credit note: check the invoice before claiming it again';
  END IF;
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.claim_line_resend_blocker(uuid, boolean) IS
  'Why a line may not go to the fund again (not sent, a reversal, not linked, paid, refused unless allowed, sent again later, credited), or NULL. Internal.';
REVOKE ALL ON FUNCTION public.claim_line_resend_blocker(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_line_correct(p_line_id uuid, p_changes jsonb, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes  jsonb := COALESCE(p_changes, '{}'::jsonb);
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_detail   batch_details%ROWTYPE;
  v_batch    batch_headers%ROWTYPE;
  v_invoice  invoices_enhanced%ROWTYPE;
  v_line     invoice_services%ROWTYPE;
  v_has_line boolean;
  v_unknown  text;
  v_visit    visits%ROWTYPE;
  v_date     date;
  v_new_date date;
  v_pract    uuid;
  v_new_pract users%ROWTYPE;
  v_codes    text[];
  v_new_codes text[];
  v_patient  patients%ROWTYPE;
  v_auth     text;
  v_copy     jsonb := '{}'::jsonb;
  v_before   jsonb;
  v_after    jsonb := '{}'::jsonb;
  v_result   jsonb;
  v_rej      claim_rejections%ROWTYPE;
  v_closed   integer := 0;
  v_hpcna    text;
  v_block    text;
BEGIN
  SELECT * INTO v_detail FROM batch_details WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The claim line was not found';
  END IF;
  SELECT * INTO v_batch FROM batch_headers WHERE id = v_detail.batch_header_id;
  PERFORM claim_assert_staff(v_batch.practice_id);
  -- A refused line may be corrected here (that is what a correction is for); the other reasons stop it
  v_block := claim_line_resend_blocker(p_line_id, true);
  IF v_block IS NOT NULL THEN
    RAISE EXCEPTION '%', v_block;
  END IF;
  SELECT string_agg(key, ', ') INTO v_unknown FROM jsonb_object_keys(v_changes) AS key
   WHERE key NOT IN ('service_date', 'patient_id', 'icd10', 'practitioner_id', 'authorisation_number');
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Only the date, dependant, ICD-10 codes, practitioner and authorisation can be corrected here (not %)', v_unknown;
  END IF;
  SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = v_detail.invoice_id FOR UPDATE;
  IF NOT FOUND OR v_invoice.practice_id IS DISTINCT FROM v_batch.practice_id THEN
    RAISE EXCEPTION 'The invoice of this claim line was not found in this practice';
  END IF;
  -- The invoice must stay in its sent batch while its line changes, so the automatic batching leaves it alone
  IF v_invoice.batch_id IS NULL OR EXISTS (
       SELECT 1 FROM batch_headers b WHERE b.id = v_invoice.batch_id
          AND b.sent_at IS NULL AND lower(COALESCE(b.status, 'active')) IN ('active', 'open', 'draft', 'ready')) THEN
    RAISE EXCEPTION 'Invoice % is not in a sent batch: correct it on the visit and claim it from Claims', v_invoice.invoice_number;
  END IF;
  SELECT * INTO v_line FROM invoice_services
   WHERE invoice_id = v_invoice.id AND system_transaction_number = v_detail.system_transaction_number
   LIMIT 1
   FOR UPDATE;
  v_has_line := FOUND;
  SELECT * INTO v_visit FROM visits WHERE id = v_detail.visit_id;

  -- What the fund received (as the claim file is built: the invoice line first, then the visit, then the batch row)
  v_date := COALESCE(CASE WHEN v_has_line THEN v_line.service_date END, v_visit.visit_date,
                     CASE WHEN v_detail.service_date ~ '^\d{8}$' THEN to_date(v_detail.service_date, 'YYYYMMDD') END);
  v_pract := COALESCE(CASE WHEN v_has_line THEN v_line.practitioner_id END, v_visit.doctor_id);
  SELECT NULLIF(btrim(hpcsa_number), '') INTO v_hpcna FROM users WHERE id = v_pract;
  v_codes := COALESCE(string_to_array(NULLIF(btrim(v_detail.diagnostic_code), ''), '/'), '{}');
  v_before := jsonb_build_object(
    'batch_id', v_batch.id, 'batch_number', v_batch.batch_number, 'line_number', v_detail.transaction_number_in_batch,
    'service_date', v_date, 'patient_id', v_detail.patient_id, 'patient_name', v_detail.patient_name, 'icd10', to_jsonb(v_codes),
    'practitioner_id', v_pract, 'hpcna', COALESCE(v_hpcna, v_detail.treating_doctor_hpcsa_number),
    'authorisation_number', COALESCE(v_detail.authorisation_number, ''));

  -- Date of service
  IF v_changes ? 'service_date' THEN
    BEGIN
      v_new_date := (v_changes->>'service_date')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'The date of service is not a valid date';
    END;
    IF v_new_date IS NULL OR v_new_date > ar_today() THEN
      RAISE EXCEPTION 'The date of service cannot be empty or in the future';
    END IF;
    IF v_new_date IS DISTINCT FROM v_date THEN
      IF NOT v_has_line THEN
        RAISE EXCEPTION 'This claim line is not linked to its invoice line, so its date cannot be corrected here';
      END IF;
      v_copy := v_copy || jsonb_build_object('service_date', to_char(v_new_date, 'YYYYMMDD'));
      v_after := v_after || jsonb_build_object('service_date', v_new_date);
    END IF;
  END IF;

  -- Treating practitioner: a colleague of the practice with an HPCNA number (field 36)
  IF v_changes ? 'practitioner_id' THEN
    SELECT * INTO v_new_pract FROM users
     WHERE id = NULLIF(v_changes->>'practitioner_id', '')::uuid AND practice_id = v_batch.practice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a practitioner of this practice';
    END IF;
    IF NULLIF(btrim(v_new_pract.hpcsa_number), '') IS NULL THEN
      RAISE EXCEPTION '% has no HPCNA number on record: add it under Settings > Users first', COALESCE(v_new_pract.full_name, 'This practitioner');
    END IF;
    IF v_new_pract.id IS DISTINCT FROM v_pract THEN
      IF NOT v_has_line THEN
        RAISE EXCEPTION 'This claim line is not linked to its invoice line, so its practitioner cannot be corrected here';
      END IF;
      v_copy := v_copy || jsonb_build_object('treating_doctor_hpcsa_number', btrim(v_new_pract.hpcsa_number));
      v_after := v_after || jsonb_build_object('practitioner_id', v_new_pract.id, 'hpcna', btrim(v_new_pract.hpcsa_number));
    END IF;
  END IF;

  -- ICD-10 codes (field 33): the main code first, at most 5, each once
  IF v_changes ? 'icd10' THEN
    IF jsonb_typeof(v_changes->'icd10') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'The ICD-10 codes must be a list';
    END IF;
    SELECT array_agg(code ORDER BY first_pos) INTO v_new_codes
      FROM (SELECT upper(btrim(value)) AS code, min(ordinality) AS first_pos
              FROM jsonb_array_elements_text(v_changes->'icd10') WITH ORDINALITY
             WHERE NULLIF(btrim(value), '') IS NOT NULL
             GROUP BY upper(btrim(value))) c;
    IF v_new_codes IS NULL OR cardinality(v_new_codes) = 0 THEN
      RAISE EXCEPTION 'A claim needs at least one ICD-10 code';
    END IF;
    IF cardinality(v_new_codes) > 5 THEN
      RAISE EXCEPTION 'A claim line carries at most 5 ICD-10 codes';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_new_codes) AS code WHERE code !~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$') THEN
      RAISE EXCEPTION 'An ICD-10 code is not in the right form (for example J06.9)';
    END IF;
    IF v_new_codes IS DISTINCT FROM v_codes THEN
      v_copy := v_copy || jsonb_build_object('diagnostic_code', array_to_string(v_new_codes, '/'), 'diagnostic_code_type', 'D');
      v_after := v_after || jsonb_build_object('icd10', to_jsonb(v_new_codes));
    END IF;
  END IF;

  -- Authorisation number (field 31)
  IF v_changes ? 'authorisation_number' THEN
    v_auth := upper(btrim(COALESCE(v_changes->>'authorisation_number', '')));
    IF length(v_auth) > 21 OR v_auth !~ '^[A-Z0-9/-]*$' THEN
      RAISE EXCEPTION 'The authorisation number may only hold letters, digits, "/" and "-" (at most 21)';
    END IF;
    IF v_auth IS DISTINCT FROM upper(btrim(COALESCE(v_detail.authorisation_number, ''))) THEN
      v_copy := v_copy || jsonb_build_object('authorisation_number', v_auth);
      v_after := v_after || jsonb_build_object('authorisation_number', v_auth);
    END IF;
  END IF;

  -- Dependant: another member of the same family on the same membership number
  IF v_changes ? 'patient_id' THEN
    SELECT p.* INTO v_patient FROM patients p
     WHERE p.id = NULLIF(v_changes->>'patient_id', '')::uuid AND p.practice_id = v_batch.practice_id
       AND EXISTS (SELECT 1 FROM medical_aid_details m WHERE m.patient_id = p.id
                    AND upper(regexp_replace(COALESCE(m.membership_number, ''), '[\s/-]', '', 'g'))
                      = upper(regexp_replace(COALESCE(v_detail.medical_aid_membership_number, ''), '[\s/-]', '', 'g'))
                    AND NULLIF(btrim(COALESCE(m.membership_number, '')), '') IS NOT NULL);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a patient of this practice on the same membership number';
    END IF;
    IF v_patient.id IS DISTINCT FROM v_detail.patient_id THEN
      IF NULLIF(btrim(COALESCE(v_patient.gender, '')), '') IS NULL OR v_patient.date_of_birth IS NULL THEN
        RAISE EXCEPTION 'Add the date of birth and gender to that patient''s file first';
      END IF;
      v_copy := v_copy || jsonb_build_object(
        'patient_id', v_patient.id,
        'patient_name', replace(upper(COALESCE(v_patient.first_name, '')), ',', ''),
        'member_surname', replace(upper(COALESCE(v_patient.last_name, '')), ',', ''),
        'member_initials', COALESCE((SELECT string_agg(upper(left(part, 1)), '') FROM unnest(string_to_array(btrim(COALESCE(v_patient.first_name, '')), ' ')) AS part WHERE length(btrim(part)) > 0), ''),
        'patient_date_of_birth', to_char(v_patient.date_of_birth, 'YYYYMMDD'),
        'patient_id_number', replace(COALESCE(v_patient.id_number, ''), ',', ''),
        'gender', upper(left(btrim(v_patient.gender), 1)),
        'system_patient_reference_number', v_patient.system_patient_reference_number::text);
      v_after := v_after || jsonb_build_object('patient_id', v_patient.id, 'patient_name', replace(upper(COALESCE(v_patient.first_name, '')), ',', ''));
    END IF;
  END IF;

  IF v_after = '{}'::jsonb THEN
    RAISE EXCEPTION 'Nothing was changed: correct at least one of the date, dependant, ICD-10 codes, practitioner or authorisation';
  END IF;

  -- The invoice line says the same as the corrected claim (its change history records who and when). The invoice stays
  -- in its sent batch, so sync_invoice_to_batch leaves its claim lines alone.
  IF v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10']) THEN
    UPDATE invoice_services
       SET service_date = CASE WHEN v_after ? 'service_date' THEN v_new_date ELSE service_date END,
           practitioner_id = CASE WHEN v_after ? 'practitioner_id' THEN v_new_pract.id ELSE practitioner_id END,
           icd10_primary = CASE WHEN v_after ? 'icd10' THEN v_new_codes[1] ELSE icd10_primary END,
           icd10_secondary = CASE WHEN v_after ? 'icd10' THEN v_new_codes[2:] ELSE icd10_secondary END,
           updated_at = now()
     WHERE id = v_line.id;
  END IF;

  v_result := claim_line_resend(v_batch.practice_id, p_line_id, 'R', v_copy);

  -- A rejection of this line waiting in Remittances > Rejections is done: it was corrected and sent again
  FOR v_rej IN SELECT * FROM claim_rejections WHERE claim_line_id = p_line_id AND status IN ('open', 'waiting') FOR UPDATE LOOP
    UPDATE claim_rejections
       SET status = 'resubmitted', resubmitted_batch_id = (v_result->>'batch_id')::uuid, resubmitted_line_id = (v_result->>'line_id')::uuid,
           resubmission_flag = 'R', updated_at = now(), updated_by = auth.uid()
     WHERE id = v_rej.id RETURNING * INTO v_rej;
    PERFORM claim_rejection_log(v_rej, 'resubmitted', COALESCE(v_note, 'Corrected and sent again from the claim batch'),
      jsonb_build_object('batch_id', v_result->>'batch_id', 'line_id', v_result->>'line_id', 'flag', 'R', 'changes', v_copy));
    v_closed := v_closed + 1;
  END LOOP;

  INSERT INTO invoice_audit_events (practice_id, invoice_id, action, field, new_value, line_id, line_code, line_before, line_after)
  VALUES (v_batch.practice_id, v_invoice.id, 'claim_corrected', 'claim_line', v_note, CASE WHEN v_has_line THEN v_line.id END,
          v_detail.bhf_tariff_code, v_before,
          v_after || jsonb_build_object('batch_id', v_result->'batch_id', 'batch_number', v_result->'batch_number',
                                        'line_number', v_result->'line_number', 'flag', 'R'));

  RETURN v_result || jsonb_build_object('invoice_line_updated', v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10']),
                                        'rejections_resubmitted', v_closed);
END $$;
COMMENT ON FUNCTION public.claim_line_correct(uuid, jsonb, text) IS
  'Corrects the date, dependant, ICD-10 codes, practitioner or authorisation of a line in a sent batch and sends it again (field 32 R); the invoice line follows; recorded in invoice_audit_events.';

CREATE OR REPLACE FUNCTION public.claim_lines_resend(p_line_ids uuid[], p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_ids      uuid[];
  v_id       uuid;
  v_detail   batch_details%ROWTYPE;
  v_batch    batch_headers%ROWTYPE;
  v_practice uuid;
  v_block    text;
  v_line_id  uuid;
  v_result   jsonb;
  v_resent   jsonb := '[]'::jsonb;
  v_skipped  jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(COALESCE(p_line_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'Choose the lines to send again';
  END IF;
  IF cardinality(v_ids) > 200 THEN
    RAISE EXCEPTION 'Send at most 200 lines at a time';
  END IF;
  -- One practice per call, and the caller works there
  SELECT DISTINCT h.practice_id INTO v_practice FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id WHERE d.id = ANY (v_ids) LIMIT 1;
  IF (SELECT count(DISTINCT h.practice_id) FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id WHERE d.id = ANY (v_ids)) > 1 THEN
    RAISE EXCEPTION 'The lines must all be from one practice';
  END IF;
  PERFORM claim_assert_staff(v_practice);

  FOREACH v_id IN ARRAY v_ids LOOP
    v_block := claim_line_resend_blocker(v_id, false);
    IF v_block IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_object('line_id', v_id, 'reason', v_block);
      CONTINUE;
    END IF;
    SELECT * INTO v_detail FROM batch_details WHERE id = v_id;
    SELECT * INTO v_batch FROM batch_headers WHERE id = v_detail.batch_header_id;
    SELECT s.id INTO v_line_id FROM invoice_services s
     WHERE s.invoice_id = v_detail.invoice_id AND s.system_transaction_number = v_detail.system_transaction_number LIMIT 1;
    BEGIN
      v_result := claim_line_resend(v_batch.practice_id, v_id, 'R', '{}'::jsonb);
    EXCEPTION WHEN raise_exception THEN
      v_skipped := v_skipped || jsonb_build_object('line_id', v_id, 'reason', SQLERRM);
      CONTINUE;
    END;
    INSERT INTO invoice_audit_events (practice_id, invoice_id, action, field, new_value, line_id, line_code, line_before, line_after)
    VALUES (v_batch.practice_id, v_detail.invoice_id, 'claim_resent', 'claim_line', v_note, v_line_id, v_detail.bhf_tariff_code,
            jsonb_build_object('batch_id', v_batch.id, 'batch_number', v_batch.batch_number, 'line_number', v_detail.transaction_number_in_batch,
                               'sent_at', v_batch.sent_at),
            jsonb_build_object('batch_id', v_result->'batch_id', 'batch_number', v_result->'batch_number',
                               'line_number', v_result->'line_number', 'flag', 'R'));
    v_resent := v_resent || (v_result || jsonb_build_object('from_line_id', v_id));
  END LOOP;

  RETURN jsonb_build_object('resent', v_resent, 'skipped', v_skipped);
END $$;
COMMENT ON FUNCTION public.claim_lines_resend(uuid[], text) IS
  'Sends chosen sent lines the fund has not paid again (field 32 R), into each fund''s open batch; skips paid, refused, credited, newer and waiting lines with the reason.';

-- ---------------------------------------------------------------------------------------------
-- 9. The invoice's history also records claim corrections and lines sent again
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.invoice_audit_events DROP CONSTRAINT invoice_audit_events_action_check;
ALTER TABLE public.invoice_audit_events ADD CONSTRAINT invoice_audit_events_action_check
  CHECK (action IN ('invoice_changed', 'line_added', 'line_removed', 'line_changed', 'claim_corrected', 'claim_resent'));

-- ---------------------------------------------------------------------------------------------
-- 10. Who runs what
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.credit_note_post_lines(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_reversals_to_batch(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_line_correct(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_lines_resend(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_note_post_lines(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reversals_to_batch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_line_correct(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lines_resend(uuid[], text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 11. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF position('claim_line_resend(r.practice_id, r.claim_line_id, v_flag, v_changes)' in
              (SELECT prosrc FROM pg_proc WHERE oid = 'public.claim_rejection_act(uuid,text,jsonb)'::regprocedure)) = 0
     OR position('jsonb_populate_record' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.claim_rejection_act(uuid,text,jsonb)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'Check failed: claim_rejection_act must resubmit through claim_line_resend only';
  END IF;
  IF position('credit_note_line_fully_credited(p_line_id)' in
              (SELECT prosrc FROM pg_proc WHERE oid = 'public.stock_sync_invoice_line(uuid,uuid,text,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: stock_sync_invoice_line does not return a fully credited line to stock';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.claim_assert_staff(uuid)', 'public.claim_line_copy(uuid,uuid,jsonb)',
                              'public.claim_line_resend(uuid,uuid,text,jsonb)', 'public.credit_note_line_fully_credited(uuid)',
                              'public.claim_line_resend_blocker(uuid,boolean)'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is internal', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.credit_note_post_lines(jsonb)', 'public.claim_reversals_to_batch(uuid,text)',
                              'public.claim_line_correct(uuid,jsonb,text)', 'public.claim_lines_resend(uuid[],text)',
                              'public.claim_rejection_act(uuid,text,jsonb)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in users only', v_fn;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid IN ('public.claim_assert_staff(uuid)'::regprocedure, 'public.claim_line_copy(uuid,uuid,jsonb)'::regprocedure,
                   'public.claim_line_resend(uuid,uuid,text,jsonb)'::regprocedure, 'public.credit_note_post_lines(jsonb)'::regprocedure,
                   'public.claim_reversals_to_batch(uuid,text)'::regprocedure, 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure,
                   'public.claim_lines_resend(uuid[],text)'::regprocedure, 'public.credit_note_line_fully_credited(uuid)'::regprocedure,
                   'public.claim_line_resend_blocker(uuid,boolean)'::regprocedure)
       AND NOT (prosecdef AND proconfig @> ARRAY['search_path=public'])
  ) THEN
    RAISE EXCEPTION 'Check failed: the functions must run as their owner with search_path public';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.credit_note_lines'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.claim_reversals'::regclass) THEN
    RAISE EXCEPTION 'Check failed: row-level security is off on the new tables';
  END IF;
  IF has_table_privilege('anon', 'public.credit_note_lines', 'SELECT') OR has_table_privilege('anon', 'public.claim_reversals', 'SELECT')
     OR has_table_privilege('anon', 'public.claim_reversal_states', 'SELECT')
     OR has_table_privilege('authenticated', 'public.credit_note_lines', 'INSERT') OR has_table_privilege('authenticated', 'public.claim_reversals', 'INSERT')
     OR has_table_privilege('authenticated', 'public.claim_reversals', 'UPDATE') OR has_table_privilege('authenticated', 'public.credit_note_lines', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: the new tables must be read-only for signed-in users and closed to anon';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.claim_reversal_states'::regclass AND reloptions @> ARRAY['security_invoker=true']) THEN
    RAISE EXCEPTION 'Check failed: claim_reversal_states must run with the caller''s rights';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
