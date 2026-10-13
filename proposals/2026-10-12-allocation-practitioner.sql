-- Applied 2026-10-12 as migration allocation_practitioner_2026_10_12 (version 20261012191640; stored statement md5 d2510bba73d7d24dab757187d36c1229 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: ar_allocation_line_practitioner af4fff8206647c30ad4907b030a99f1c, ar_allocation_lines_set_practitioner 1d60def6b482f1c9216b2a7cdd176d5b; 11768 of 11768 lines filled; ar_20_append_only on.
-- Rehearsed (rolled back) with simulated logins: a receptionist's automatic split and a line chosen by hand both carried the
-- rule's practitioner (the line's own kept, a line without one took the invoice's); the receptionist could not change a line
-- or run the helper (42501), the owner could not change a line (P0001, guard back on); another practice read 0, anon 42501.
-- =============================================================================================
-- PROPOSAL: each part of a payment carries the practitioner of the line it paid (parity H4, for R7)
-- File:   proposals/2026-10-12-allocation-practitioner.sql                Drafted: 2026-10-12
-- Code:   src/services/ledger/allocationLines.ts (normalizeAllocationCover reads practitioner_id; coverLabel names them),
--         src/components/finance/receipts/arService.ts (reads the column, falls back while it is missing),
--         ReceiptDetailModal.tsx (the receipt shows each line's practitioner). "Cash per practitioner" (R7) sums it.
--
-- Why (parity H4, R7): one receipt can pay the lines of several practitioners (allocation lines split it line by
-- line, proposals/2026-10-09-allocation-lines.sql), but nothing said whose work the money paid, so the day end and
-- the reports could not split cash per practitioner. Eminance splits a payment across practitioners.
--
-- What it does
--   1. receipt_allocation_lines.practitioner_id: the practitioner of the line, as it was when paid (like line_code and
--      line_date): the invoice line's own practitioner, else the invoice's. The same rule as the claim line
--      (sync_invoice_to_batch) and "Cash flow per practitioner" (report_cash_by_practitioner,
--      proposals/2026-10-12-finance-reports.sql), so the receipt and the report agree. Null when neither has one.
--      No foreign key: the table is append-only (ar_20_append_only), so ON DELETE SET NULL could never run, and a
--      payment keeps the id of a practitioner removed later (the screens say "Former practitioner").
--   2. A BEFORE INSERT trigger fills it on every new allocation line, whichever path wrote it (the automatic split,
--      lines chosen by staff, an import); ar_insert_allocation_lines and ar_split_allocation_over_lines are unchanged.
--   3. The existing lines get it once: the append-only guard is switched off for that one UPDATE inside this
--      migration and on again before it ends.
--   4. An index for reports per practitioner and period.
--   Needs proposals/2026-10-09-allocation-lines.sql (receipt_allocation_lines) and invoice_services.practitioner_id
--   (proposals/2026-10-07-invoicing.sql).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the receipt shows no practitioner and the screens work as before.
-- Undo (the payments lose their practitioner; nothing else changes):
--   DROP TRIGGER IF EXISTS ar_10_practitioner ON public.receipt_allocation_lines;
--   DROP FUNCTION IF EXISTS public.ar_allocation_lines_set_practitioner();
--   DROP FUNCTION IF EXISTS public.ar_allocation_line_practitioner(uuid, uuid);
--   DROP INDEX IF EXISTS public.receipt_allocation_lines_practitioner_idx;
--   ALTER TABLE public.receipt_allocation_lines DROP COLUMN IF EXISTS practitioner_id;
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the tables this file builds on are not as expected
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.table_name || '.' || t.column_name, ', ') INTO v_missing
    FROM (VALUES ('receipt_allocation_lines', 'invoice_id'), ('receipt_allocation_lines', 'invoice_line_id'),
                 ('invoice_services', 'practitioner_id'), ('invoices_enhanced', 'practitioner_id')) AS t(table_name, column_name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %', v_missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.receipt_allocation_lines'::regclass
                    AND tgname = 'ar_20_append_only' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Stopped: receipt_allocation_lines has no ar_20_append_only guard; section 3 expects it';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.receipt_allocation_lines ADD COLUMN IF NOT EXISTS practitioner_id uuid;

COMMENT ON COLUMN public.receipt_allocation_lines.practitioner_id IS
  'The practitioner of the line this part of a payment paid, as it was when paid: the invoice line''s own, else the '
  'invoice''s (ar_allocation_line_practitioner; the claim line''s rule). No foreign key: the table is append-only.';

-- ---------------------------------------------------------------------------------------------
-- 2. Filled on every new allocation line
-- ---------------------------------------------------------------------------------------------

-- The practitioner of an invoice line: its own, else its invoice's (also for money on none of its lines)
CREATE OR REPLACE FUNCTION public.ar_allocation_line_practitioner(p_invoice_id uuid, p_invoice_line_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT s.practitioner_id FROM public.invoice_services s WHERE s.id = p_invoice_line_id),
    (SELECT i.practitioner_id FROM public.invoices_enhanced i WHERE i.id = p_invoice_id)
  )
$$;

-- With the owner's rights, so the line gets its practitioner whoever writes it (the helper is closed to logins)
CREATE OR REPLACE FUNCTION public.ar_allocation_lines_set_practitioner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Always worked out here, so every path that writes allocation lines records the same practitioner
  NEW.practitioner_id := public.ar_allocation_line_practitioner(NEW.invoice_id, NEW.invoice_line_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ar_10_practitioner ON public.receipt_allocation_lines;
CREATE TRIGGER ar_10_practitioner
  BEFORE INSERT ON public.receipt_allocation_lines
  FOR EACH ROW EXECUTE FUNCTION public.ar_allocation_lines_set_practitioner();

REVOKE ALL ON FUNCTION public.ar_allocation_line_practitioner(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ar_allocation_lines_set_practitioner() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The lines already there (the append-only guard is off for this one statement only)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.receipt_allocation_lines DISABLE TRIGGER ar_20_append_only;
UPDATE public.receipt_allocation_lines l
   SET practitioner_id = public.ar_allocation_line_practitioner(l.invoice_id, l.invoice_line_id)
 WHERE l.practitioner_id IS NULL;
ALTER TABLE public.receipt_allocation_lines ENABLE TRIGGER ar_20_append_only;

-- ---------------------------------------------------------------------------------------------
-- 4. Reports per practitioner
-- ---------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS receipt_allocation_lines_practitioner_idx
  ON public.receipt_allocation_lines (practice_id, practitioner_id);

-- ---------------------------------------------------------------------------------------------
-- 5. Checks: the guard is back on, every line that can have a practitioner has the one the rule gives
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_wrong integer;
BEGIN
  IF (SELECT t.tgenabled FROM pg_trigger t WHERE t.tgrelid = 'public.receipt_allocation_lines'::regclass
       AND t.tgname = 'ar_20_append_only') <> 'O' THEN
    RAISE EXCEPTION 'check failed: the append-only guard of receipt_allocation_lines is not on';
  END IF;
  SELECT count(*) INTO v_wrong FROM public.receipt_allocation_lines l
   WHERE l.practitioner_id IS DISTINCT FROM public.ar_allocation_line_practitioner(l.invoice_id, l.invoice_line_id);
  IF v_wrong <> 0 THEN
    RAISE EXCEPTION 'check failed: % allocation lines do not carry their line''s practitioner', v_wrong;
  END IF;
  IF has_function_privilege('anon', 'public.ar_allocation_line_practitioner(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can run ar_allocation_line_practitioner';
  END IF;
  RAISE NOTICE 'allocation practitioner ready: the column filled, the trigger on, the append-only guard back on';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Result (read only): lines with and without a practitioner (none known: no practitioner on the line or the
--    invoice)
-- ---------------------------------------------------------------------------------------------

SELECT count(*) FILTER (WHERE practitioner_id IS NOT NULL) AS with_practitioner,
       count(*) FILTER (WHERE practitioner_id IS NULL) AS without_practitioner
  FROM public.receipt_allocation_lines;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
