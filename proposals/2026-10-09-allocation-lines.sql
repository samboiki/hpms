-- Applied 2026-10-09 as migration allocation_lines_2026_10_09 (version 20261009103133; stored statement md5 85eb1e6efe43069b1eb24a87fcaf386c = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 of ar_insert_allocations afterwards 7ad5a61d9803fc6d36de6ad625a44c7f. All 2,517 existing allocations split
-- (11,768 line rows, none off a line). Rehearsed (rolled back) with simulated logins: the sums of every receipt's allocated and
-- unallocated and of every invoice's outstanding were the same before and after; a receptionist's chosen lines were kept, an
-- automatic payment went to the oldest line, lines not adding up, a line of another invoice, a write-off without an approver
-- were refused, the same external_ref returned the first receipt with no new lines, reversing restored the line; another
-- practice saw none of the lines and could not post; anon could neither read nor post.
-- =============================================================================================
-- PROPOSAL: what each payment covered, line by line (a receipt allocated per invoice line and portion)
-- File:   proposals/2026-10-09-allocation-lines.sql                     Drafted: 2026-10-09
-- Code:   src/services/ledger/arAllocation.ts (suggestLineSplit: the same rule as section 4, tested),
--         src/components/finance/receipts/arPayloads.ts ("lines" in the payload, tested),
--         src/components/finance/receipts/AllocationLinePicker.tsx (Receive payment), arService.ts (reads),
--         src/services/ledger/arStatement.ts (statements say what a payment covered, tested)
--
-- Why (parity H2): receipt_allocations records which invoice and portion a payment pays, not which invoice line.
-- Eminance allocates per line; staff could not take a payment for one line (the medicine, not the consultation the
-- fund will pay), and the receipt, the invoice and the statement could not say what a payment covered.
--
-- What it does (additive: receipts and receipt_allocations are not changed; every balance stays the same)
--   1. receipt_allocation_lines: how each allocation is spread over the invoice's lines (invoice_services), per
--      portion, with the line's code, description and date as they were. An amount with no line (invoice_line_id
--      NULL) is money on the invoice but on none of its lines: interest, a correction, a total above its lines.
--      Never changed or deleted: a line counts while its allocation and receipt stand, so reversing an allocation
--      (or its receipt) takes its lines off with it. No foreign key to invoice_services: the history outlives a
--      line removed after its payment was reversed (as invoice_audit_events outlives an invoice).
--   2. ar_invoice_line_balances (caller's rights): per invoice line, billed per portion, paid per portion, unpaid.
--   3. The split, in the database, for every way an allocation is made (Receive payment, a fund's payment, the
--      remittance posting, the old status menu, imports):
--        automatic (the default, as before: oldest first): the invoice's lines in date order, each line's own
--        portion first; a patient's payment then pays what is left on a line (a shortfall the fund did not pay,
--        moved to the patient); anything more is "not on a line";
--        chosen: ar_insert_allocations takes "lines": [{ "invoice_line_id", "amount" }] on an allocation; each
--        line is on that invoice, no more than is unpaid on it for that portion, and together they make the
--        allocation's amount exactly.
--   4. ar_insert_allocations (internal; ar_post_receipt and ar_allocate_receipt call it): started from the live
--      definition; only the INSERT changes (it passes the chosen lines on). ar_post_receipt is NOT changed: its
--      practice check, payer and method checks, the future-date check, the external_ref idempotency and the
--      write-off approvals (ar_insert_adjustment) stay exactly as they are.
--   5. Every existing allocation is split over its invoice's lines with the automatic rule (source 'migrated'),
--      oldest allocation first. Section 8 checks that every allocation's lines add up to it.
--   No policy changes on existing tables: the new table gets its own select policy (members of the practice, as
--   receipt_allocations) and the patient app's restrictive guard, on itself only.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration (section 7 writes about one row per existing allocation and line; seconds).
-- Undo, in this order: ar_insert_allocations as in proposals/2026-10-07-receipts-and-allocations.sql; then
--   DROP TRIGGER ar_60_lines ON public.receipt_allocations; DROP VIEW public.ar_invoice_line_balances;
--   DROP FUNCTION public.ar_allocation_lines_after_insert(), public.ar_insert_allocation_lines(uuid, jsonb),
--   public.ar_split_allocation_over_lines(uuid, text), public.ar_allocation_lines_guard();
--   DROP TABLE public.receipt_allocation_lines;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions: the receipts proposal and the invoice line columns this file reads
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.receipts'), ('public.receipt_allocations'), ('public.invoice_services'), ('public.invoices_enhanced')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first (missing: %)', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.ar_insert_allocations(uuid,uuid,jsonb)'), ('public.ar_amount(jsonb)'), ('public.ar_format_nad(numeric)'),
                 ('public.ar_portion_label(text)'), ('public.ar_no_truncate()')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions of the receipts proposal are missing: %', v_missing;
  END IF;
  SELECT string_agg(t.column_name, ', ') INTO v_missing
    FROM (VALUES ('id'), ('invoice_id'), ('code'), ('description'), ('service_date'), ('system_transaction_number'), ('total_price'),
                 ('medical_aid_covered'), ('patient_portion')) AS t(column_name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = 'invoice_services' AND c.column_name = t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: invoice_services has no column(s) %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. receipt_allocation_lines: what each allocation covered, line by line
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_allocation_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id       uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  allocation_id     uuid NOT NULL REFERENCES public.receipt_allocations(id) ON DELETE RESTRICT,
  invoice_id        uuid NOT NULL REFERENCES public.invoices_enhanced(id) ON DELETE RESTRICT,
  -- invoice_services.id; NULL = on the invoice but on none of its lines (interest, a correction)
  invoice_line_id   uuid,
  portion           text NOT NULL CHECK (portion IN ('patient', 'medical_aid')),
  amount            numeric(14,2) NOT NULL CHECK (amount > 0),
  -- The line as it was when it was paid
  line_code         text,
  line_description  text,
  line_date         date,
  -- automatic: split oldest first; chosen: by staff; migrated: an allocation made before this table existed
  source            text NOT NULL CHECK (source IN ('automatic', 'chosen', 'migrated')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipt_allocation_lines_allocation_idx ON public.receipt_allocation_lines (allocation_id);
CREATE INDEX IF NOT EXISTS receipt_allocation_lines_line_idx ON public.receipt_allocation_lines (invoice_line_id) WHERE invoice_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipt_allocation_lines_invoice_idx ON public.receipt_allocation_lines (invoice_id);
COMMENT ON TABLE public.receipt_allocation_lines IS
  'What each receipt allocation covered, per invoice line and portion (amounts add up to the allocation). A row counts while its allocation and receipt are not reversed. Never changed or deleted.';
COMMENT ON COLUMN public.receipt_allocation_lines.invoice_line_id IS
  'invoice_services.id; NULL for money on the invoice but on none of its lines (interest, corrections). No foreign key: the history outlives a line removed after its payment was reversed.';

-- ---------------------------------------------------------------------------------------------
-- 2. Never changed or deleted
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_allocation_lines_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'What a payment covered is never changed or deleted; reverse the allocation instead';
END $$;

DROP TRIGGER IF EXISTS ar_20_append_only ON public.receipt_allocation_lines;
CREATE TRIGGER ar_20_append_only BEFORE UPDATE OR DELETE ON public.receipt_allocation_lines
  FOR EACH ROW EXECUTE FUNCTION public.ar_allocation_lines_guard();
DROP TRIGGER IF EXISTS ar_99_no_truncate ON public.receipt_allocation_lines;
CREATE TRIGGER ar_99_no_truncate BEFORE TRUNCATE ON public.receipt_allocation_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.ar_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 3. ar_invoice_line_balances: per invoice line, billed, paid and unpaid (caller's rights)
--    line_date and line_order are the order "oldest first" uses (suggestLineSplit in arAllocation.ts)
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
       round(COALESCE(s.total_price, 0)::numeric, 2) - COALESCE(p.medical_aid_paid, 0) - COALESCE(p.patient_paid, 0) AS unpaid
FROM public.invoice_services s
JOIN public.invoices_enhanced i ON i.id = s.invoice_id
LEFT JOIN LATERAL (
  SELECT SUM(l.amount) FILTER (WHERE l.portion = 'medical_aid') AS medical_aid_paid,
         SUM(l.amount) FILTER (WHERE l.portion = 'patient') AS patient_paid
  FROM public.receipt_allocation_lines l
  JOIN public.receipt_allocations a ON a.id = l.allocation_id
  JOIN public.receipts r ON r.id = a.receipt_id
  WHERE l.invoice_line_id = s.id AND a.reversed_at IS NULL AND r.reversed_at IS NULL
) p ON true;
COMMENT ON VIEW public.ar_invoice_line_balances IS
  'Per invoice line: billed per portion, paid per portion (allocation lines that still stand) and unpaid (billed less paid, both portions).';

-- ---------------------------------------------------------------------------------------------
-- 4. The split
-- ---------------------------------------------------------------------------------------------

/*
  The automatic split of one allocation (the default, oldest first; the same rule as suggestLineSplit):
  pass 1, each line's own portion still unpaid, lines in date order; pass 2 (a patient's payment only), what is
  still unpaid on a line (the part a fund did not pay and that was moved to the patient); the rest is "not on a
  line". An allocation that was already split is left alone. Returns the rows written.
*/
CREATE OR REPLACE FUNCTION public.ar_split_allocation_over_lines(p_allocation_id uuid, p_source text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alloc    receipt_allocations%ROWTYPE;
  v_counted  boolean;
  v_taken    jsonb := '{}'::jsonb;
  v_left     numeric(14,2);
  v_take     numeric(14,2);
  v_room     numeric(14,2);
  v_rows     integer := 0;
  v_pass     integer;
  r          record;
BEGIN
  IF p_source NOT IN ('automatic', 'migrated') THEN
    RAISE EXCEPTION 'Unknown split %', p_source;
  END IF;
  SELECT * INTO v_alloc FROM receipt_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;
  IF EXISTS (SELECT 1 FROM receipt_allocation_lines WHERE allocation_id = p_allocation_id) THEN
    RETURN 0;
  END IF;
  -- A reversed allocation (only when old ones are split) is not in the view's "paid", so what it takes is kept here
  v_counted := v_alloc.reversed_at IS NULL AND NOT EXISTS (SELECT 1 FROM receipts WHERE id = v_alloc.receipt_id AND reversed_at IS NOT NULL);
  v_left := v_alloc.amount;
  FOR v_pass IN 1..2 LOOP
    EXIT WHEN v_left <= 0 OR (v_pass = 2 AND v_alloc.portion <> 'patient');
    FOR r IN
      SELECT b.invoice_line_id, b.code, b.description, b.line_date, b.unpaid,
             CASE v_alloc.portion WHEN 'medical_aid' THEN b.medical_aid_billed - b.medical_aid_paid ELSE b.patient_billed - b.patient_paid END AS portion_unpaid
        FROM ar_invoice_line_balances b
       WHERE b.invoice_id = v_alloc.invoice_id
       ORDER BY b.line_date NULLS FIRST, b.line_order, b.invoice_line_id
    LOOP
      EXIT WHEN v_left <= 0;
      v_room := GREATEST(r.unpaid - CASE WHEN v_counted THEN 0 ELSE COALESCE((v_taken->>r.invoice_line_id::text)::numeric, 0) END, 0);
      IF v_pass = 1 THEN
        v_room := LEAST(v_room, GREATEST(r.portion_unpaid - CASE WHEN v_counted THEN 0 ELSE COALESCE((v_taken->>r.invoice_line_id::text)::numeric, 0) END, 0));
      END IF;
      v_take := LEAST(v_left, v_room);
      CONTINUE WHEN v_take <= 0;
      INSERT INTO receipt_allocation_lines (practice_id, allocation_id, invoice_id, invoice_line_id, portion, amount,
                                            line_code, line_description, line_date, source)
      VALUES (v_alloc.practice_id, v_alloc.id, v_alloc.invoice_id, r.invoice_line_id, v_alloc.portion, v_take,
              r.code, r.description, r.line_date, p_source);
      v_taken := jsonb_set(v_taken, ARRAY[r.invoice_line_id::text],
                           to_jsonb(COALESCE((v_taken->>r.invoice_line_id::text)::numeric, 0) + v_take));
      v_left := v_left - v_take;
      v_rows := v_rows + 1;
    END LOOP;
  END LOOP;
  IF v_left > 0 THEN
    INSERT INTO receipt_allocation_lines (practice_id, allocation_id, invoice_id, invoice_line_id, portion, amount, source)
    VALUES (v_alloc.practice_id, v_alloc.id, v_alloc.invoice_id, NULL, v_alloc.portion, v_left, p_source);
    v_rows := v_rows + 1;
  END IF;
  RETURN v_rows;
END $$;
COMMENT ON FUNCTION public.ar_split_allocation_over_lines(uuid, text) IS
  'The automatic split of an allocation over its invoice''s lines: oldest line first, each line''s own portion first, a patient''s payment then on what is left on a line, the rest not on a line.';

/*
  Lines chosen by staff for one allocation: [{ "invoice_line_id": uuid, "amount": 120.00 }]. Each line is on the
  allocation's invoice and gets no more than is unpaid on it (for the medical aid portion: no more than the
  fund's part still unpaid); together they make the allocation's amount exactly.
*/
CREATE OR REPLACE FUNCTION public.ar_insert_allocation_lines(p_allocation_id uuid, p_lines jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alloc   receipt_allocations%ROWTYPE;
  v_number  text;
  v_line    jsonb;
  v_line_id uuid;
  v_amount  numeric(14,2);
  v_room    numeric(14,2);
  v_sum     numeric(14,2) := 0;
  v_rows    integer := 0;
  b         record;
BEGIN
  SELECT * INTO v_alloc FROM receipt_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;
  SELECT invoice_number INTO v_number FROM invoices_enhanced WHERE id = v_alloc.invoice_id;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Choose the lines this payment covers';
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_amount := ar_amount(v_line->'amount');
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Each line needs an amount above N$ 0.00';
    END IF;
    BEGIN
      v_line_id := NULLIF(v_line->>'invoice_line_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'That is not a line of invoice %', v_number;
    END;
    SELECT * INTO b FROM ar_invoice_line_balances WHERE invoice_line_id = v_line_id AND invoice_id = v_alloc.invoice_id;
    IF v_line_id IS NULL OR NOT FOUND THEN
      RAISE EXCEPTION 'That is not a line of invoice %', v_number;
    END IF;
    v_room := GREATEST(b.unpaid, 0);
    IF v_alloc.portion = 'medical_aid' THEN
      v_room := LEAST(v_room, GREATEST(b.medical_aid_billed - b.medical_aid_paid, 0));
    END IF;
    IF v_amount > v_room THEN
      RAISE EXCEPTION '% is more than the % still unpaid on line % of invoice % (% portion)',
        ar_format_nad(v_amount), ar_format_nad(v_room), b.code, v_number, ar_portion_label(v_alloc.portion);
    END IF;
    INSERT INTO receipt_allocation_lines (practice_id, allocation_id, invoice_id, invoice_line_id, portion, amount,
                                          line_code, line_description, line_date, source)
    VALUES (v_alloc.practice_id, v_alloc.id, v_alloc.invoice_id, b.invoice_line_id, v_alloc.portion, v_amount,
            b.code, b.description, b.line_date, 'chosen');
    v_sum := v_sum + v_amount;
    v_rows := v_rows + 1;
  END LOOP;
  IF v_sum <> v_alloc.amount THEN
    RAISE EXCEPTION 'The lines add up to %, not the % paid on invoice %', ar_format_nad(v_sum), ar_format_nad(v_alloc.amount), v_number;
  END IF;
  RETURN v_rows;
END $$;

-- Every new allocation is split automatically, unless ar_insert_allocations is writing lines chosen by staff
CREATE OR REPLACE FUNCTION public.ar_allocation_lines_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('hpms.ar_allocation_lines', true), '') = 'chosen' THEN
    RETURN NULL;
  END IF;
  PERFORM ar_split_allocation_over_lines(NEW.id, 'automatic');
  RETURN NULL;
END $$;

-- After the status sync (ar_50) and before the audit (ar_90), in name order
DROP TRIGGER IF EXISTS ar_60_lines ON public.receipt_allocations;
CREATE TRIGGER ar_60_lines AFTER INSERT ON public.receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ar_allocation_lines_after_insert();

-- ---------------------------------------------------------------------------------------------
-- 5. ar_insert_allocations: the live definition; the INSERT passes the chosen lines on
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old_declare text := $old$  v_count integer := 0;
$old$;
  v_new_declare text := $new$  v_count integer := 0;
  v_id     uuid;
  v_chosen boolean;
$new$;
  v_old_insert text := $old$    INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount, external_ref)
    VALUES (p_practice_id, p_receipt_id, (v_line->>'invoice_id')::uuid, v_line->>'portion',
            ar_amount(v_line->'amount'), NULLIF(btrim(v_line->>'external_ref'), ''));$old$;
  v_new_insert text := $new$    -- Lines chosen by staff ("lines": [{ "invoice_line_id", "amount" }], adding up to the amount) replace the
    -- automatic split over the invoice's lines, oldest first (ar_allocation_lines_after_insert)
    v_chosen := CASE WHEN jsonb_typeof(v_line->'lines') = 'array' THEN jsonb_array_length(v_line->'lines') > 0 ELSE false END;
    PERFORM set_config('hpms.ar_allocation_lines', CASE WHEN v_chosen THEN 'chosen' ELSE '' END, true);
    INSERT INTO receipt_allocations (practice_id, receipt_id, invoice_id, portion, amount, external_ref)
    VALUES (p_practice_id, p_receipt_id, (v_line->>'invoice_id')::uuid, v_line->>'portion',
            ar_amount(v_line->'amount'), NULLIF(btrim(v_line->>'external_ref'), ''))
    RETURNING id INTO v_id;
    PERFORM set_config('hpms.ar_allocation_lines', '', true);
    IF v_chosen THEN
      PERFORM ar_insert_allocation_lines(v_id, v_line->'lines');
    END IF;$new$;
BEGIN
  SELECT pg_get_functiondef('public.ar_insert_allocations(uuid,uuid,jsonb)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old_declare, ''))) / length(v_old_declare) <> 1
     OR (length(v_def) - length(replace(v_def, v_old_insert, ''))) / length(v_old_insert) <> 1 THEN
    RAISE EXCEPTION 'ar_insert_allocations: its declarations or its INSERT were not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(replace(v_def, v_old_declare, v_new_declare), v_old_insert, v_new_insert);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 6. Row level security and grants. Read: members of the practice. Write: only the functions above.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.receipt_allocation_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_allocation_lines_select ON public.receipt_allocation_lines;
CREATE POLICY receipt_allocation_lines_select ON public.receipt_allocation_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = receipt_allocation_lines.practice_id));
DO $$
BEGIN
  -- The patient app's logins read none of it (when the patient-portal file is applied); this table only
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.receipt_allocation_lines;
    CREATE POLICY portal_staff_only ON public.receipt_allocation_lines AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

REVOKE ALL ON public.receipt_allocation_lines FROM anon, authenticated;
GRANT SELECT ON public.receipt_allocation_lines TO authenticated;
REVOKE ALL ON public.ar_invoice_line_balances FROM anon, authenticated;
GRANT SELECT ON public.ar_invoice_line_balances TO authenticated;

REVOKE ALL ON FUNCTION public.ar_split_allocation_over_lines(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_insert_allocation_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_allocation_lines_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_allocation_lines_guard() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Every existing allocation, split over its invoice's lines (oldest allocation first)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_id   uuid;
  v_done integer := 0;
BEGIN
  FOR v_id IN
    SELECT ra.id FROM receipt_allocations ra
     WHERE NOT EXISTS (SELECT 1 FROM receipt_allocation_lines l WHERE l.allocation_id = ra.id)
     ORDER BY ra.created_at, ra.id
  LOOP
    PERFORM ar_split_allocation_over_lines(v_id, 'migrated');
    v_done := v_done + 1;
  END LOOP;
  RAISE NOTICE 'Section 7: % existing allocations split over their invoice lines', v_done;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
    FROM receipt_allocations ra
    LEFT JOIN (SELECT allocation_id, SUM(amount) AS total FROM receipt_allocation_lines GROUP BY allocation_id) l ON l.allocation_id = ra.id
   WHERE l.total IS DISTINCT FROM ra.amount;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Check failed: the lines of % allocations do not add up to the allocation', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM receipt_allocation_lines l JOIN receipt_allocations ra ON ra.id = l.allocation_id
   WHERE l.invoice_id <> ra.invoice_id OR l.portion <> ra.portion OR l.practice_id <> ra.practice_id;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Check failed: % allocation lines are on another invoice, portion or practice than their allocation', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM ar_invoice_line_balances WHERE unpaid < 0;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Check failed: % invoice lines are paid more than they bill', v_bad;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.ar_insert_allocations(uuid,uuid,jsonb)'::regprocedure
       AND position('ar_insert_allocation_lines(v_id, v_line->''lines'')' in p.prosrc) > 0
  ) THEN
    RAISE EXCEPTION 'Check failed: ar_insert_allocations does not pass chosen lines on';
  END IF;
  IF has_function_privilege('authenticated', 'public.ar_insert_allocations(uuid,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ar_split_allocation_over_lines(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ar_insert_allocation_lines(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ar_insert_allocation_lines(uuid,jsonb)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.receipt_allocation_lines', 'SELECT')
     OR has_table_privilege('authenticated', 'public.receipt_allocation_lines', 'INSERT')
     OR has_table_privilege('anon', 'public.ar_invoice_line_balances', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: app users can write allocation lines, run the internal functions, or the public key can read them';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
