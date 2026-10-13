-- Applied 2026-10-07 as migration remittances_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: remittance import, matching, posting and the claim rejection queue
-- File:   proposals/2026-10-07-remittances.sql                      Drafted: 2026-10-07
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- Requires: proposals/2026-10-07-receipts-and-allocations.sql applied first (receipts, allocations,
-- adjustments and the ar_* functions). Section 1 stops with a clear message when it is missing.
--
-- How to apply
--   1. Run the whole file once as it is on a Supabase branch (or in the SQL editor): it must finish
--      without an error. Read the NOTICE lines: section 1 says whether the batch function used for
--      resubmissions exists, section 9 runs the checks.
--   2. Change the final ROLLBACK to COMMIT and run it again. It only creates new tables, functions
--      and policies; nothing existing is changed, so any hour is fine.
--   3. Nothing to deploy. Finance > Remittances looks for these tables and switches from "read and
--      check only" to saving, posting and the rejection queue by itself.
--   Undo after a COMMIT: see the end of the file.
--
-- What it adds
--   remittance_documents     one row per payment or response read from a file: the file's SHA-256
--                            (the same file is never imported twice), format, fund, payment
--                            reference, dates, totals, the reconciliation result, and once posted
--                            the receipt it became. Only the last 4 digits of a bank account.
--   remittance_lines         the lines read, with what the fund paid and why, the claim line and
--                            invoice they were matched to (and how sure), and what posting did.
--   claim_rejections         the work queue: one row per line the fund did not pay that needs
--                            someone (fix and resubmit, wait, bill the patient, write off, decide),
--                            with the reason in plain English, who did what and when.
--   claim_rejection_events   append-only trail of every action on the queue.
--   RPCs                     remittance_save_document, remittance_save_matches,
--                            remittance_post_document, claim_rejection_act.
--
-- Decisions
--   * The browser reads the file (src/utils/remittance/*, tested) and sends the parsed result; the
--     database checks membership, limits and idempotency again. The file itself is not stored, only
--     its hash and name (open decision: a private storage bucket for the originals).
--   * Posting is one transaction (remittance_post_document): reversals of provisional shortfalls or
--     write-offs the fund has now paid, the receipt (ar_post_receipt, source remittance_import,
--     external_ref = the payment key, so the same payment can never be posted twice, even from a
--     remittance advice and its monthly statement), the line results, the queue items and the
--     rejections the payment settles. Nothing posts from a document that does not add up.
--   * A line rejected with a reason that forbids charging the patient (category write_off, e.g.
--     Methealth 202) or already paid (duplicate) can never be moved to the patient: a CHECK on the
--     queue and claim_rejection_act both refuse it.
--   * Resubmission copies the claim line into the fund's open batch (the same
--     get_or_create_active_batch_id the screens use) with field 32 (resubmission flag) set, plus the
--     corrections staff typed (tooth numbers, ICD-10 code, authorisation, membership number,
--     note); the original sent batch is never changed.
--   * Access: practice members read their practice's rows (the usual
--     EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = ...) rule).
--     Nobody writes the tables directly; every write goes through the RPCs (SECURITY DEFINER, which
--     check the same membership rule; write-offs also need an admin or doctor, as in receivables).
--
-- Money is numeric(14,2) in NAD. Dates are Africa/Windhoek calendar dates.
-- Used by: src/components/finance/remittances/* (screens), src/utils/remittance/* (parsing, matching
--          and posting rules, tested).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Preconditions
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(name, ', ') INTO v_missing
  FROM (VALUES
    ('receipts'), ('receipt_allocations'), ('invoice_adjustments'), ('invoices_enhanced'), ('patients'), ('practices'),
    ('users'), ('batch_headers'), ('batch_details')
  ) AS t(name)
  WHERE to_regclass('public.' || name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: tables missing: %. Apply proposals/2026-10-07-receipts-and-allocations.sql first.', v_missing;
  END IF;

  SELECT string_agg(name, ', ') INTO v_missing
  FROM (VALUES
    ('public.ar_post_receipt(jsonb)'), ('public.ar_post_adjustment(jsonb)'), ('public.ar_reverse_adjustment(uuid,text)'),
    ('public.ar_assert_member(uuid)'), ('public.ar_is_approver(uuid)'), ('public.ar_amount(jsonb)'), ('public.ar_today()')
  ) AS t(name)
  WHERE to_regprocedure(name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions missing: %. Apply proposals/2026-10-07-receipts-and-allocations.sql first.', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
  FROM (VALUES
    ('batch_details', 'id'), ('batch_details', 'batch_header_id'), ('batch_details', 'transaction_number_in_batch'),
    ('batch_details', 'medical_aid_reference'), ('batch_details', 'resubmission_flag'), ('batch_details', 'tooth_numbers'),
    ('batch_details', 'diagnostic_code'), ('batch_details', 'authorisation_number'), ('batch_details', 'medical_aid_membership_number'),
    ('batch_details', 'free_text'), ('batch_details', 'invoice_id'), ('batch_headers', 'id'), ('batch_headers', 'practice_id'),
    ('batch_headers', 'sent_at'), ('users', 'role')
  ) AS t(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %. Adjust this script before applying it.', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batch_details' AND column_name = 'id' AND data_type = 'uuid' AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Stopped: batch_details.id is not a uuid with a default; resubmission copies a line and needs the database to give the copy its id.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_or_create_active_batch_id') THEN
    RAISE NOTICE 'Section 1: get_or_create_active_batch_id was not found. Everything works except "Resubmit" in the rejection queue, which needs it.';
  ELSE
    RAISE NOTICE 'Section 1: get_or_create_active_batch_id found; resubmission can open the fund''s batch.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remittance_documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id            uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  file_name              text NOT NULL CHECK (btrim(file_name) <> ''),
  file_sha256            text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  -- A file can hold more than one payment (a monthly statement, several schemes): 1, 2, ...
  part_number            smallint NOT NULL DEFAULT 1 CHECK (part_number >= 1),
  format                 text NOT NULL CHECK (format IN ('methealth_statement', 'medscheme_advice', 'medscheme_monthly', 'nmc_response_csv', 'switchon_status_csv', 'nhp_acknowledgement')),
  kind                   text NOT NULL CHECK (kind IN ('payment', 'month_summary', 'adjudication', 'acknowledgement', 'claim_status')),
  administrator          text NOT NULL CHECK (administrator IN ('methealth', 'medscheme', 'switchon', 'unknown')),
  fund_code              text,
  fund_name              text,
  practice_number_on_doc text,
  payment_reference      text,
  statement_number       text,
  -- The payment's idempotency key (src/utils/remittance/posting.ts paymentKeyOf); null for responses
  payment_key            text,
  document_date          date,
  payment_date           date,
  total_paid             numeric(14,2),
  total_claimed          numeric(14,2),
  bank_account_last4     text CHECK (bank_account_last4 IS NULL OR bank_account_last4 ~ '^[0-9]{1,4}$'),
  reconciled             boolean NOT NULL DEFAULT false,
  reconciliation         jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_legend          jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings               jsonb NOT NULL DEFAULT '[]'::jsonb,
  parser_version         text NOT NULL,
  -- imported: read and saved; posted: money and outcomes posted; duplicate: its payment was already posted from another file
  status                 text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'posted', 'duplicate')),
  receipt_id             uuid REFERENCES public.receipts(id) ON DELETE RESTRICT,
  posted_by              uuid,
  posted_at              timestamptz,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remittance_documents_file_unique UNIQUE (practice_id, file_sha256, part_number),
  CONSTRAINT remittance_documents_posted_when CHECK ((posted_at IS NOT NULL) = (status = 'posted'))
);
-- One posted receipt per payment, whichever file it came from
CREATE UNIQUE INDEX IF NOT EXISTS remittance_documents_payment_posted
  ON public.remittance_documents (practice_id, payment_key)
  WHERE status = 'posted' AND payment_key IS NOT NULL AND receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS remittance_documents_practice_idx ON public.remittance_documents (practice_id, created_at DESC);
COMMENT ON TABLE public.remittance_documents IS
  'Fund payments and responses imported from files (remittance statements and advices, assessment CSVs, acknowledgements). Never posted twice: unique by file hash, and by payment key once posted.';

CREATE TABLE IF NOT EXISTS public.remittance_lines (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id               uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  document_id               uuid NOT NULL REFERENCES public.remittance_documents(id) ON DELETE CASCADE,
  seq                       integer NOT NULL CHECK (seq > 0),
  page                      smallint,
  member_number             text,
  dependant_code            text,
  patient_name              text,
  member_name               text,
  practice_reference        text,
  invoice_reference         text,
  service_date              date,
  tariff_code               text,
  description               text,
  quantity                  numeric(9,2),
  claimed                   numeric(14,2),
  tariff_amount             numeric(14,2),
  -- Paid to the practice; negative when the fund took money back
  paid                      numeric(14,2) NOT NULL DEFAULT 0,
  member_portion            numeric(14,2),
  levy                      numeric(14,2) NOT NULL DEFAULT 0,
  member_not_liable         numeric(14,2) NOT NULL DEFAULT 0,
  paid_to_member            numeric(14,2) NOT NULL DEFAULT 0,
  line_status               text NOT NULL CHECK (line_status IN ('paid', 'part_paid', 'rejected', 'pended', 'accepted', 'info')),
  reason_codes              text[] NOT NULL DEFAULT '{}',
  reason_texts              text[] NOT NULL DEFAULT '{}',
  fund_claim_ref            text,
  system_transaction_number text,
  -- Matching: exact (posted without review), likely (needs a person), confirmed (a person agreed), unmatched
  match_status              text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('exact', 'likely', 'confirmed', 'unmatched')),
  match_rule                text,
  -- batch_details.id of the claim line(s) (several when a line and its add-on were paid as one)
  claim_line_id             uuid,
  claim_line_ids            uuid[] NOT NULL DEFAULT '{}',
  invoice_id                uuid REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  patient_id                uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  matched_by                uuid,
  matched_at                timestamptz,
  posting_status            text NOT NULL DEFAULT 'pending' CHECK (posting_status IN ('pending', 'allocated', 'shortfall', 'written_off', 'queued', 'held', 'suspense', 'duplicate', 'recorded', 'no_action')),
  allocated                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  shortfall                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (shortfall >= 0),
  written_off               numeric(14,2) NOT NULL DEFAULT 0 CHECK (written_off >= 0),
  posted_at                 timestamptz,
  CONSTRAINT remittance_lines_seq_unique UNIQUE (document_id, seq)
);
CREATE INDEX IF NOT EXISTS remittance_lines_document_idx ON public.remittance_lines (document_id, seq);
CREATE INDEX IF NOT EXISTS remittance_lines_claim_line_idx ON public.remittance_lines (claim_line_id) WHERE claim_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS remittance_lines_invoice_idx ON public.remittance_lines (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS remittance_lines_service_idx ON public.remittance_lines (practice_id, service_date);
COMMENT ON TABLE public.remittance_lines IS
  'Lines of imported fund documents: what was claimed, paid and why, the claim line they were matched to, and what posting did. patient_name is the fund''s wording, kept for matching only.';

CREATE TABLE IF NOT EXISTS public.claim_rejections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id          uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  remittance_line_id   uuid NOT NULL REFERENCES public.remittance_lines(id) ON DELETE RESTRICT,
  document_id          uuid NOT NULL REFERENCES public.remittance_documents(id) ON DELETE RESTRICT,
  claim_line_id        uuid,
  invoice_id           uuid REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  patient_id           uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  fund_code            text,
  service_date         date,
  tariff_code          text,
  claimed              numeric(14,2) NOT NULL DEFAULT 0,
  paid                 numeric(14,2) NOT NULL DEFAULT 0,
  -- What is still at stake on the line (claimed minus paid, or the part waiting for approval)
  at_stake             numeric(14,2) NOT NULL DEFAULT 0 CHECK (at_stake >= 0),
  reason_codes         text[] NOT NULL DEFAULT '{}',
  fund_reason          text,
  category             text NOT NULL CHECK (category IN ('fixable', 'hold', 'patient_liable', 'write_off', 'duplicate', 'rate_shortfall', 'review')),
  plain_reason         text NOT NULL CHECK (btrim(plain_reason) <> ''),
  suggested_action     text NOT NULL CHECK (suggested_action IN ('resubmit', 'wait', 'bill_patient', 'write_off', 'review', 'none')),
  fix_hint             text,
  -- A write-off that waits for an admin or doctor
  needs_approval       boolean NOT NULL DEFAULT false,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'resubmitted', 'billed_patient', 'written_off', 'resolved_by_payment', 'closed')),
  follow_up_on         date,
  resubmit_by          date,
  resubmitted_batch_id uuid,
  resubmitted_line_id  uuid,
  resubmission_flag    text,
  adjustment_id        uuid REFERENCES public.invoice_adjustments(id) ON DELETE RESTRICT,
  adjustment_kind      text CHECK (adjustment_kind IN ('shortfall_transfer', 'write_off')),
  -- The earlier queue item of the same claim line this one replaced (rejected again)
  previous_id          uuid REFERENCES public.claim_rejections(id) ON DELETE RESTRICT,
  resolved_by_line_id  uuid REFERENCES public.remittance_lines(id) ON DELETE RESTRICT,
  notes                text,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  resolved_by          uuid,
  resolved_at          timestamptz,
  CONSTRAINT claim_rejections_line_unique UNIQUE (remittance_line_id),
  -- The patient is never charged for what the fund says may not be charged (202) or already paid
  CONSTRAINT claim_rejections_never_bill_forbidden CHECK (
    category NOT IN ('write_off', 'duplicate') OR (suggested_action <> 'bill_patient' AND status <> 'billed_patient')
  )
);
CREATE INDEX IF NOT EXISTS claim_rejections_queue_idx ON public.claim_rejections (practice_id, status, resubmit_by);
CREATE INDEX IF NOT EXISTS claim_rejections_claim_line_idx ON public.claim_rejections (claim_line_id) WHERE claim_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS claim_rejections_resubmitted_idx ON public.claim_rejections (resubmitted_line_id) WHERE resubmitted_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS claim_rejections_invoice_idx ON public.claim_rejections (invoice_id) WHERE invoice_id IS NOT NULL;
COMMENT ON TABLE public.claim_rejections IS
  'Work queue of claim lines a fund did not pay: the reason in plain English, the suggested action, and what staff did (resubmitted, billed the patient, wrote off, waited) with who and when.';

CREATE TABLE IF NOT EXISTS public.claim_rejection_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id  uuid NOT NULL,
  rejection_id uuid NOT NULL REFERENCES public.claim_rejections(id) ON DELETE CASCADE,
  action       text NOT NULL,
  note         text,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor        uuid,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_rejection_events_rejection_idx ON public.claim_rejection_events (rejection_id, occurred_at);
COMMENT ON TABLE public.claim_rejection_events IS 'Append-only: every action on the rejection queue, who and when.';

CREATE OR REPLACE FUNCTION public.remittance_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The rejection queue history cannot be changed';
END $$;
DROP TRIGGER IF EXISTS claim_rejection_events_append_only ON public.claim_rejection_events;
CREATE TRIGGER claim_rejection_events_append_only BEFORE UPDATE OR DELETE ON public.claim_rejection_events
  FOR EACH ROW EXECUTE FUNCTION public.remittance_append_only();

-- ---------------------------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------------------------

-- An amount from a payload, or NULL when it is missing (fund documents leave some columns blank)
CREATE OR REPLACE FUNCTION public.remittance_amount(p_value jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_value IS NULL OR jsonb_typeof(p_value) = 'null' OR btrim(p_value #>> '{}') = '' THEN NULL ELSE ar_amount(p_value) END
$$;

CREATE OR REPLACE FUNCTION public.remittance_text_array(p_value jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(ARRAY(SELECT btrim(v) FROM jsonb_array_elements_text(COALESCE(p_value, '[]'::jsonb)) AS v WHERE btrim(v) <> ''), '{}')
$$;

CREATE OR REPLACE FUNCTION public.claim_rejection_log(p_rejection public.claim_rejections, p_action text, p_note text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO claim_rejection_events (practice_id, rejection_id, action, note, details, actor)
  VALUES (p_rejection.practice_id, p_rejection.id, p_action, NULLIF(btrim(COALESCE(p_note, '')), ''), COALESCE(p_details, '{}'::jsonb), auth.uid())
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. remittance_save_document(payload): a parsed document and its lines, once per file and part
--    { practice_id, file_name, file_sha256, part_number, format, kind, administrator, fund_code?,
--      fund_name?, practice_number_on_doc?, payment_reference?, statement_number?, payment_key?,
--      document_date?, payment_date?, total_paid?, total_claimed?, bank_account_last4?, reconciled,
--      reconciliation[], reason_legend{}, warnings[], parser_version,
--      lines: [{ seq, page?, member_number?, dependant_code?, patient_name?, member_name?,
--                practice_reference?, invoice_reference?, service_date?, tariff_code?, description?,
--                quantity?, claimed?, tariff_amount?, paid, member_portion?, levy?, member_not_liable?,
--                paid_to_member?, line_status, reason_codes[], reason_texts[], fund_claim_ref?,
--                system_transaction_number? }] }
--    Returns { document_id, duplicate (this file was imported before), status,
--              posted_from (file name, when its payment was already posted), lines: [{ seq, id }] }
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remittance_save_document(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload->>'practice_id', '')::uuid;
  v_sha      text := lower(btrim(COALESCE(p_payload->>'file_sha256', '')));
  v_part     smallint := COALESCE(NULLIF(p_payload->>'part_number', '')::smallint, 1);
  v_key      text := NULLIF(btrim(COALESCE(p_payload->>'payment_key', '')), '');
  v_doc      remittance_documents%ROWTYPE;
  v_posted   remittance_documents%ROWTYPE;
  v_line     jsonb;
  v_last4    text := NULLIF(regexp_replace(COALESCE(p_payload->>'bank_account_last4', ''), '\D', '', 'g'), '');
BEGIN
  PERFORM ar_assert_member(v_practice);
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'The file fingerprint (SHA-256) is missing or not valid';
  END IF;
  IF jsonb_typeof(COALESCE(p_payload->'lines', 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'The document has no lines';
  END IF;

  SELECT * INTO v_doc FROM remittance_documents WHERE practice_id = v_practice AND file_sha256 = v_sha AND part_number = v_part;
  IF FOUND THEN
    RETURN jsonb_build_object('document_id', v_doc.id, 'duplicate', true, 'status', v_doc.status, 'posted_from', NULL,
      'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object('seq', l.seq, 'id', l.id) ORDER BY l.seq) FROM remittance_lines l WHERE l.document_id = v_doc.id), '[]'::jsonb));
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT * INTO v_posted FROM remittance_documents
     WHERE practice_id = v_practice AND payment_key = v_key AND status = 'posted' AND receipt_id IS NOT NULL
     ORDER BY posted_at LIMIT 1;
  END IF;

  INSERT INTO remittance_documents (
    practice_id, file_name, file_sha256, part_number, format, kind, administrator, fund_code, fund_name,
    practice_number_on_doc, payment_reference, statement_number, payment_key, document_date, payment_date,
    total_paid, total_claimed, bank_account_last4, reconciled, reconciliation, reason_legend, warnings,
    parser_version, status, created_by
  ) VALUES (
    v_practice, left(btrim(p_payload->>'file_name'), 255), v_sha, v_part, p_payload->>'format', p_payload->>'kind',
    COALESCE(NULLIF(p_payload->>'administrator', ''), 'unknown'), NULLIF(btrim(p_payload->>'fund_code'), ''), NULLIF(btrim(p_payload->>'fund_name'), ''),
    NULLIF(btrim(p_payload->>'practice_number_on_doc'), ''), NULLIF(btrim(p_payload->>'payment_reference'), ''),
    NULLIF(btrim(p_payload->>'statement_number'), ''), v_key, NULLIF(p_payload->>'document_date', '')::date,
    NULLIF(p_payload->>'payment_date', '')::date, remittance_amount(p_payload->'total_paid'), remittance_amount(p_payload->'total_claimed'),
    CASE WHEN v_last4 IS NULL THEN NULL ELSE right(v_last4, 4) END,
    COALESCE((p_payload->>'reconciled')::boolean, false), COALESCE(p_payload->'reconciliation', '[]'::jsonb),
    COALESCE(p_payload->'reason_legend', '{}'::jsonb), COALESCE(p_payload->'warnings', '[]'::jsonb),
    COALESCE(NULLIF(p_payload->>'parser_version', ''), 'unknown'),
    CASE WHEN v_posted.id IS NOT NULL THEN 'duplicate' ELSE 'imported' END,
    auth.uid()
  ) RETURNING * INTO v_doc;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
    INSERT INTO remittance_lines (
      practice_id, document_id, seq, page, member_number, dependant_code, patient_name, member_name, practice_reference,
      invoice_reference, service_date, tariff_code, description, quantity, claimed, tariff_amount, paid, member_portion,
      levy, member_not_liable, paid_to_member, line_status, reason_codes, reason_texts, fund_claim_ref, system_transaction_number
    ) VALUES (
      v_practice, v_doc.id, (v_line->>'seq')::integer, NULLIF(v_line->>'page', '')::smallint,
      NULLIF(btrim(v_line->>'member_number'), ''), NULLIF(btrim(v_line->>'dependant_code'), ''), NULLIF(btrim(v_line->>'patient_name'), ''),
      NULLIF(btrim(v_line->>'member_name'), ''), NULLIF(btrim(v_line->>'practice_reference'), ''), NULLIF(btrim(v_line->>'invoice_reference'), ''),
      NULLIF(v_line->>'service_date', '')::date, NULLIF(btrim(v_line->>'tariff_code'), ''), NULLIF(btrim(v_line->>'description'), ''),
      NULLIF(v_line->>'quantity', '')::numeric, remittance_amount(v_line->'claimed'), remittance_amount(v_line->'tariff_amount'),
      COALESCE(remittance_amount(v_line->'paid'), 0), remittance_amount(v_line->'member_portion'),
      COALESCE(remittance_amount(v_line->'levy'), 0), COALESCE(remittance_amount(v_line->'member_not_liable'), 0),
      COALESCE(remittance_amount(v_line->'paid_to_member'), 0), v_line->>'line_status',
      remittance_text_array(v_line->'reason_codes'), remittance_text_array(v_line->'reason_texts'),
      NULLIF(btrim(v_line->>'fund_claim_ref'), ''), NULLIF(btrim(v_line->>'system_transaction_number'), '')
    );
  END LOOP;

  RETURN jsonb_build_object('document_id', v_doc.id, 'duplicate', false, 'status', v_doc.status, 'posted_from', v_posted.file_name,
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object('seq', l.seq, 'id', l.id) ORDER BY l.seq) FROM remittance_lines l WHERE l.document_id = v_doc.id), '[]'::jsonb));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. remittance_save_matches(document_id, matches): what each line was matched to, before posting
--    [{ line_id, match_status: exact|likely|confirmed|unmatched, match_rule?, claim_line_ids[], invoice_id?, patient_id? }]
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remittance_save_matches(p_document_id uuid, p_matches jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc     remittance_documents%ROWTYPE;
  v_match   jsonb;
  v_invoice uuid;
  v_count   integer := 0;
  v_ids     uuid[];
BEGIN
  SELECT * INTO v_doc FROM remittance_documents WHERE id = p_document_id FOR UPDATE;
  PERFORM ar_assert_member(v_doc.practice_id);
  IF v_doc.status = 'posted' THEN
    RAISE EXCEPTION 'This document is posted; its matches can no longer change';
  END IF;
  FOR v_match IN SELECT * FROM jsonb_array_elements(COALESCE(p_matches, '[]'::jsonb)) LOOP
    v_invoice := NULLIF(v_match->>'invoice_id', '')::uuid;
    IF v_invoice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.id = v_invoice AND i.practice_id = v_doc.practice_id) THEN
      RAISE EXCEPTION 'An invoice of another practice cannot be matched';
    END IF;
    v_ids := ARRAY(SELECT (value)::uuid FROM jsonb_array_elements_text(COALESCE(v_match->'claim_line_ids', '[]'::jsonb)) AS value);
    UPDATE remittance_lines
       SET match_status = COALESCE(NULLIF(v_match->>'match_status', ''), 'unmatched'),
           match_rule = NULLIF(btrim(v_match->>'match_rule'), ''),
           claim_line_ids = v_ids,
           claim_line_id = v_ids[1],
           invoice_id = v_invoice,
           patient_id = NULLIF(v_match->>'patient_id', '')::uuid,
           matched_by = auth.uid(),
           matched_at = now()
     WHERE id = NULLIF(v_match->>'line_id', '')::uuid AND document_id = v_doc.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('document_id', v_doc.id, 'saved', v_count);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. remittance_post_document(document_id, post): everything posting does, in one transaction
--    { receipt?: ar_post_receipt payload (allocations with external_ref = remittance line id,
--                shortfalls[], write_offs[]); practice, payer, source, external_ref, amount and
--                date are taken from the document, not from the caller,
--      adjustments?: [{ kind: shortfall_transfer|write_off, invoice_id, portion?, amount, reason,
--                       reason_code?, external_ref }]   (when nothing was paid, there is no receipt),
--      reversals?: [{ adjustment_id, reason }]          (provisional shortfalls/write-offs the fund now paid),
--      lines: [{ line_id, posting_status, allocated, shortfall, written_off, match_status?, match_rule?,
--                claim_line_ids[]?, invoice_id?, patient_id? }],
--      rejections: [{ line_id, invoice_id?, claim_line_id?, patient_id?, category, suggested_action,
--                     plain_reason, fix_hint?, fund_reason?, reason_codes[], at_stake, follow_up_on?,
--                     resubmit_by?, needs_approval?, supersedes_id? }],
--      resolves: [{ rejection_id, line_id }] }
--    Returns { document_id, receipt_id, receipt_number, allocated, unallocated, adjustments,
--              rejections_created, resolved, already_posted }
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remittance_post_document(p_document_id uuid, p_post jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    v_result := ar_post_receipt(v_receipt || jsonb_build_object(
      'practice_id', v_doc.practice_id,
      'payer_type', 'medical_aid',
      'fund_name', COALESCE(NULLIF(btrim(v_receipt->>'fund_name'), ''), v_doc.fund_name, v_doc.fund_code, 'Medical aid'),
      'method', CASE WHEN v_receipt->>'method' IN ('eft', 'medical_aid') THEN v_receipt->>'method' ELSE 'medical_aid' END,
      'amount', v_doc.total_paid,
      'received_on', v_doc.payment_date,
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
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'adjustments', '[]'::jsonb)) LOOP
      IF v_item->>'kind' NOT IN ('shortfall_transfer', 'write_off') THEN
        RAISE EXCEPTION 'Only shortfalls and write-offs are posted from a remittance';
      END IF;
      v_adj := ar_post_adjustment(v_item || jsonb_build_object('practice_id', v_doc.practice_id, 'effective_on', LEAST(COALESCE(v_doc.payment_date, v_doc.document_date, ar_today()), ar_today())));
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

  UPDATE remittance_documents
     SET status = 'posted', receipt_id = NULLIF(v_result->>'receipt_id', '')::uuid, posted_by = auth.uid(), posted_at = now()
   WHERE id = v_doc.id;

  RETURN jsonb_build_object(
    'document_id', v_doc.id, 'already_posted', false,
    'receipt_id', v_result->'receipt_id', 'receipt_number', v_result->'receipt_number',
    'allocated', v_result->'allocated', 'unallocated', v_result->'unallocated',
    'adjustments', v_adjs, 'rejections_created', v_created, 'resolved', v_resolved
  );
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. claim_rejection_act(rejection_id, action, payload): the queue's actions
--    resubmit     { flag?: 'R' or the fund's code, changes?: { tooth_numbers, diagnostic_code,
--                   authorisation_number, medical_aid_membership_number, free_text }, note? }
--                 Copies the claim line into the fund's open batch with field 32 set. For a reason a
--                 correction cannot change (patient liable, may not be charged, already paid) a note
--                 saying what changed is required.
--    bill_patient { amount, note? }  shortfall transfer to the patient; refused for write_off/duplicate
--    write_off    { amount, reason_code?, note? }  admin or doctor only (ar_post_adjustment checks)
--    wait         { until, note? }
--    reopen       { note? }   back to open (a reversed shortfall or write-off may be reopened)
--    close        { note }    done outside the queue
--    note         { note }
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_rejection_act(p_rejection_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          claim_rejections%ROWTYPE;
  v_note     text := NULLIF(btrim(COALESCE(p_payload->>'note', '')), '');
  v_detail   batch_details%ROWTYPE;
  v_batch    uuid;
  v_next     integer;
  v_row      jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_cols     text;
  v_new_id   uuid;
  v_flag     text;
  v_adj      jsonb;
  v_amount   numeric(14,2);
  v_reversed boolean;
BEGIN
  SELECT * INTO r FROM claim_rejections WHERE id = p_rejection_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;
  PERFORM ar_assert_member(r.practice_id);

  IF p_action IN ('resubmit', 'bill_patient', 'write_off', 'wait') AND r.status NOT IN ('open', 'waiting') THEN
    RAISE EXCEPTION 'This item is already %', replace(r.status, '_', ' ');
  END IF;

  IF p_action = 'resubmit' THEN
    IF r.claim_line_id IS NULL THEN
      RAISE EXCEPTION 'Match the line to a claim line before resubmitting it';
    END IF;
    IF r.category IN ('patient_liable', 'write_off', 'duplicate') AND v_note IS NULL THEN
      RAISE EXCEPTION 'The fund refused this for a reason a correction does not change. Say what changed (for example the membership) before resubmitting';
    END IF;
    SELECT d.* INTO v_detail FROM batch_details d JOIN batch_headers h ON h.id = d.batch_header_id
     WHERE d.id = r.claim_line_id AND h.practice_id = r.practice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The claim line was not found in this practice''s batches';
    END IF;
    v_batch := get_or_create_active_batch_id(r.practice_id, v_detail.medical_aid_reference);
    IF v_batch IS NULL THEN
      RAISE EXCEPTION 'No open batch could be opened for %', v_detail.medical_aid_reference;
    END IF;
    IF v_batch = v_detail.batch_header_id THEN
      RAISE EXCEPTION 'This line is still in an unsent batch: correct it there';
    END IF;
    PERFORM 1 FROM batch_headers WHERE id = v_batch FOR UPDATE;
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_next FROM batch_details WHERE batch_header_id = v_batch;
    v_flag := left(COALESCE(NULLIF(btrim(p_payload->>'flag'), ''), 'R'), 5);
    -- Only these corrections may be typed in the queue; the rest is fixed on the invoice
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_changes
      FROM jsonb_each(COALESCE(p_payload->'changes', '{}'::jsonb))
     WHERE key IN ('tooth_numbers', 'diagnostic_code', 'authorisation_number', 'medical_aid_membership_number', 'free_text')
       AND jsonb_typeof(value) = 'string';
    v_row := (to_jsonb(v_detail) - 'id') || v_changes || jsonb_build_object(
      'batch_header_id', v_batch, 'transaction_number_in_batch', v_next, 'resubmission_flag', v_flag,
      'created_at', now(), 'updated_at', now());
    -- Every column the database does not fill itself (not the id, not generated columns)
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_cols
      FROM pg_attribute a
     WHERE a.attrelid = 'public.batch_details'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attgenerated = '' AND a.attidentity = '' AND a.attname <> 'id';
    EXECUTE format('INSERT INTO public.batch_details (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.batch_details, $1) RETURNING id', v_cols)
      USING v_row INTO v_new_id;
    UPDATE claim_rejections
       SET status = 'resubmitted', resubmitted_batch_id = v_batch, resubmitted_line_id = v_new_id, resubmission_flag = v_flag,
           updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'resubmitted', v_note, jsonb_build_object('batch_id', v_batch, 'line_id', v_new_id, 'flag', v_flag, 'changes', v_changes));
    RETURN jsonb_build_object('id', r.id, 'status', r.status, 'batch_id', v_batch, 'line_id', v_new_id);

  ELSIF p_action = 'bill_patient' THEN
    IF r.category IN ('write_off', 'duplicate') THEN
      RAISE EXCEPTION 'The fund says the patient may not be charged for this line. Write it off instead';
    END IF;
    IF r.invoice_id IS NULL THEN
      RAISE EXCEPTION 'Match the line to an invoice first';
    END IF;
    v_amount := COALESCE(remittance_amount(p_payload->'amount'), r.at_stake);
    v_adj := ar_post_adjustment(jsonb_build_object(
      'practice_id', r.practice_id, 'kind', 'shortfall_transfer', 'invoice_id', r.invoice_id, 'amount', v_amount,
      'reason', left(concat_ws(' - ', 'Not paid by the medical aid: ' || r.plain_reason, v_note), 500),
      'reason_code', NULLIF(array_to_string(r.reason_codes, '/'), ''),
      'external_ref', 'claim_rejection:' || r.id));
    UPDATE claim_rejections
       SET status = 'billed_patient', adjustment_id = (v_adj->>'id')::uuid, adjustment_kind = 'shortfall_transfer',
           resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'billed_patient', v_note, jsonb_build_object('adjustment', v_adj, 'amount', v_amount));
    RETURN jsonb_build_object('id', r.id, 'status', r.status, 'adjustment', v_adj);

  ELSIF p_action = 'write_off' THEN
    IF r.invoice_id IS NULL THEN
      RAISE EXCEPTION 'Match the line to an invoice first';
    END IF;
    IF COALESCE(NULLIF(p_payload->>'reason_code', ''), 'other') NOT IN ('scheme_rate', 'claim_expired', 'bad_debt', 'small_balance', 'courtesy', 'deceased', 'other') THEN
      RAISE EXCEPTION 'Choose why it is written off (scheme rate, claim deadline missed, other ...)';
    END IF;
    v_amount := COALESCE(remittance_amount(p_payload->'amount'), r.at_stake);
    v_adj := ar_post_adjustment(jsonb_build_object(
      'practice_id', r.practice_id, 'kind', 'write_off', 'portion', 'medical_aid', 'invoice_id', r.invoice_id, 'amount', v_amount,
      'reason_code', COALESCE(NULLIF(p_payload->>'reason_code', ''), CASE r.category WHEN 'rate_shortfall' THEN 'scheme_rate' ELSE 'other' END),
      'reason', left(concat_ws(' - ', 'Medical aid will not pay: ' || r.plain_reason, NULLIF(array_to_string(r.reason_codes, '/'), ''), v_note), 500),
      'external_ref', 'claim_rejection:' || r.id));
    UPDATE claim_rejections
       SET status = 'written_off', adjustment_id = (v_adj->>'id')::uuid, adjustment_kind = 'write_off', needs_approval = false,
           resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'written_off', v_note, jsonb_build_object('adjustment', v_adj, 'amount', v_amount));
    RETURN jsonb_build_object('id', r.id, 'status', r.status, 'adjustment', v_adj);

  ELSIF p_action = 'wait' THEN
    UPDATE claim_rejections
       SET status = 'waiting', follow_up_on = COALESCE(NULLIF(p_payload->>'until', '')::date, ar_today() + 21),
           updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'waiting', v_note, jsonb_build_object('until', r.follow_up_on));
    RETURN jsonb_build_object('id', r.id, 'status', r.status, 'follow_up_on', r.follow_up_on);

  ELSIF p_action = 'reopen' THEN
    IF r.status IN ('billed_patient', 'written_off') THEN
      SELECT reversed_at IS NOT NULL INTO v_reversed FROM invoice_adjustments WHERE id = r.adjustment_id;
      IF NOT COALESCE(v_reversed, false) THEN
        RAISE EXCEPTION 'Reverse the % in Finance first; then the item can be reopened', CASE r.adjustment_kind WHEN 'write_off' THEN 'write-off' ELSE 'shortfall' END;
      END IF;
    ELSIF r.status NOT IN ('waiting', 'closed', 'resubmitted') THEN
      RAISE EXCEPTION 'This item is %', replace(r.status, '_', ' ');
    END IF;
    UPDATE claim_rejections
       SET status = 'open', adjustment_id = CASE WHEN r.status IN ('billed_patient', 'written_off') THEN NULL ELSE adjustment_id END,
           adjustment_kind = CASE WHEN r.status IN ('billed_patient', 'written_off') THEN NULL ELSE adjustment_kind END,
           resolved_at = NULL, resolved_by = NULL, updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'reopened', v_note);
    RETURN jsonb_build_object('id', r.id, 'status', r.status);

  ELSIF p_action = 'close' THEN
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'Say why it is closed: it is kept with the item';
    END IF;
    IF r.status IN ('resolved_by_payment', 'closed') THEN
      RAISE EXCEPTION 'This item is already %', replace(r.status, '_', ' ');
    END IF;
    UPDATE claim_rejections
       SET status = 'closed', resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'closed', v_note);
    RETURN jsonb_build_object('id', r.id, 'status', r.status);

  ELSIF p_action = 'note' THEN
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'The note is empty';
    END IF;
    UPDATE claim_rejections
       SET notes = concat_ws(E'\n', notes, to_char(ar_today(), 'YYYY-MM-DD') || ': ' || v_note), updated_at = now(), updated_by = auth.uid()
     WHERE id = r.id RETURNING * INTO r;
    PERFORM claim_rejection_log(r, 'note', v_note);
    RETURN jsonb_build_object('id', r.id, 'status', r.status);
  END IF;

  RAISE EXCEPTION 'Unknown action %', p_action;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Row level security and grants
--    Read: members of the practice. Write: only through the RPCs above.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.remittance_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_rejections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_rejection_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remittance_documents_select ON public.remittance_documents;
CREATE POLICY remittance_documents_select ON public.remittance_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = remittance_documents.practice_id));

DROP POLICY IF EXISTS remittance_lines_select ON public.remittance_lines;
CREATE POLICY remittance_lines_select ON public.remittance_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = remittance_lines.practice_id));

DROP POLICY IF EXISTS claim_rejections_select ON public.claim_rejections;
CREATE POLICY claim_rejections_select ON public.claim_rejections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = claim_rejections.practice_id));

DROP POLICY IF EXISTS claim_rejection_events_select ON public.claim_rejection_events;
CREATE POLICY claim_rejection_events_select ON public.claim_rejection_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = claim_rejection_events.practice_id));

REVOKE ALL ON public.remittance_documents, public.remittance_lines, public.claim_rejections, public.claim_rejection_events FROM anon, authenticated;
GRANT SELECT ON public.remittance_documents, public.remittance_lines, public.claim_rejections, public.claim_rejection_events TO authenticated;

-- Internal helpers are not callable from the API
REVOKE ALL ON FUNCTION public.claim_rejection_log(public.claim_rejections, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remittance_amount(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remittance_text_array(jsonb) FROM PUBLIC, anon, authenticated;

-- The API
REVOKE ALL ON FUNCTION public.remittance_save_document(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remittance_save_matches(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remittance_post_document(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_rejection_act(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remittance_save_document(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remittance_save_matches(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remittance_post_document(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rejection_act(uuid, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('remittance_documents', 'remittance_lines', 'claim_rejections', 'claim_rejection_events')
     AND c.relrowsecurity;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Check failed: row level security is not on for all four tables';
  END IF;

  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('remittance_save_document', 'remittance_save_matches', 'remittance_post_document', 'claim_rejection_act')
     AND p.prosecdef AND array_to_string(p.proconfig, ',') LIKE '%search_path=public%';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Check failed: the four RPCs must be SECURITY DEFINER with search_path = public';
  END IF;

  IF has_table_privilege('authenticated', 'public.claim_rejections', 'INSERT')
     OR has_table_privilege('authenticated', 'public.remittance_lines', 'UPDATE')
     OR has_table_privilege('anon', 'public.remittance_documents', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: the tables must only be readable by signed-in staff and written through the RPCs';
  END IF;

  -- The queue refuses to bill a patient for a line the fund says may not be charged (202) or already paid
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claim_rejections_never_bill_forbidden' AND conrelid = 'public.claim_rejections'::regclass
  ) THEN
    RAISE EXCEPTION 'Check failed: the never-bill rule is missing';
  END IF;

  RAISE NOTICE 'Section 9: checks passed. Finance > Remittances can save, post and queue from now on.';
END $$;

-- PostgREST: pick up the new tables and functions
NOTIFY pgrst, 'reload schema';

-- Undo after a COMMIT (receipts, allocations and adjustments that postings made stay: they are
-- money records; reverse them in Finance if needed):
--   DROP FUNCTION IF EXISTS public.claim_rejection_act(uuid, text, jsonb), public.remittance_post_document(uuid, jsonb),
--     public.remittance_save_matches(uuid, jsonb), public.remittance_save_document(jsonb),
--     public.claim_rejection_log(public.claim_rejections, text, text, jsonb), public.remittance_text_array(jsonb),
--     public.remittance_amount(jsonb);
--   DROP TABLE IF EXISTS public.claim_rejection_events, public.claim_rejections, public.remittance_lines, public.remittance_documents;
--   DROP FUNCTION IF EXISTS public.remittance_append_only();
--   Resubmitted lines copied into open batches stay in those batches (remove them there before sending if unwanted).

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
