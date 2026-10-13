-- Applied 2026-10-07 as migration invoicing_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: invoicing - sequential numbers, per-line date, practitioner and discount,
-- co-payments kept, who raised an invoice, and an audit of changes
-- File:    proposals/2026-10-07-invoicing.sql                            Drafted: 2026-10-07
-- Code:    src/utils/billing/invoiceNumber.ts   (number format, provisional numbers; tested)
--          src/utils/billing/invoiceLineRow.ts  (THE stored line: amounts, split, date, practitioner)
--          src/utils/billing/lineSplit.ts       (co-payments and discounts; tested)
--          src/utils/billing/invoiceRights.ts   (who may raise an invoice; tested)
--          src/services/invoicingSetup.ts       (the app checks which parts of this file exist)
--          src/components/billing/invoiceAudit.ts (the audit events in plain words; tested)
-- Screens: the visit's Billing tab, Finance > Invoicing (invoice details), Admin > Tariffs > Contracts
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- Why (parity rows D1, D8, D10, D11, D23, D31)
--   * Invoice numbers came from the clock (INV + yymm + 5 digits) and a clash failed the save. Each
--     practice now numbers its invoices in sequence: INV-000001, INV-000002, ... Numbers already issued
--     stay as they are.
--   * Claims need each service's own date and treating practitioner (the visit's are only the default),
--     and private patients can be given a discount on a line.
--   * Co-payments (for example a 5% co-payment on a fund) split a line between the fund and the
--     patient. A database trigger forced every medical aid line to the fund in full, so the split the
--     app worked out was overwritten.
--   * Reception now raises invoices: the invoice records who raised it (created_by) apart from the
--     treating practitioner (practitioner_id).
--   * Corrections are audited: who changed a note, a practitioner, a date or a line, and when.
--
-- How the numbers stay gapless
--   A BEFORE INSERT trigger takes the next number from invoice_number_series inside the insert's own
--   transaction (UPDATE ... RETURNING locks the practice's counter row until the insert commits):
--     - two invoices saved at the same moment wait for each other, so they never get the same number;
--     - a save that fails rolls the counter back with it, so no number is lost.
--   A number is only "lost" when an invoice that was saved is deleted afterwards: cancel invoices (or
--   credit them) instead of deleting them. Imports that must keep their own numbers set
--   `SET LOCAL hpms.keep_invoice_number = 'on'` in their transaction; an upsert of an invoice that
--   already exists keeps its number and takes none.
--   Uniqueness becomes per practice (two practices may both have INV-000001): the global unique
--   constraint on invoice_number is replaced by a unique index on (practice_id, invoice_number), plus
--   one on invoice_number for the few invoices without a practice.
--   Claim field 24 carries the last 8 digits of the number: the prefix has no digits (checked), so a new
--   invoice reaches the fund as its counter (000123), which no older number (8 digits starting with the
--   year) can equal.
--
-- How to apply
--   1. Run the whole file once as it is (it ends in ROLLBACK) on a Supabase branch or in the SQL
--      editor. It must finish without an error. Read the NOTICE lines: section 4 names the older number
--      trigger(s) it leaves in place and the unique constraint(s) it replaces; section 5 the trigger(s)
--      that forced the split (replaced, or KEPT when they do more: then co-payments stay overwritten);
--      section 5b the invoice totals trigger(s) kept or replaced (KEPT when it also batches claims),
--      section 8 how many invoices have header totals that do not match their lines (expected 0; if not,
--      the invoice totals trigger adds something such as tax: tell the developers before going on).
--   2. Change the final ROLLBACK to COMMIT and run it again (a quiet hour: section 4 builds an index on
--      invoices_enhanced, a few seconds).
--   3. Nothing to deploy: the app checks for the new columns and table and switches on per-line dates,
--      practitioners and discounts, co-payments (Admin > Tariffs > Contracts and settings), "who raised
--      it" and the change history by itself. New invoices get INV-000001 and up.
--   Undo after a COMMIT: see the end of the file.
--
-- Contents
--   0. Look first (read only)
--   1. invoice_services: service_date, practitioner_id, discount_amount
--   2. invoices_enhanced: created_by (who raised it)
--   3. invoice_number_series and the number format
--   4. Numbering trigger; old number triggers and the global unique constraint replaced
--   5. The split trigger: keep the app's fund/patient split when it adds up; invoice totals follow the
--      lines' portions (5b)
--   6. invoice_audit_events and its triggers
--   7. RLS and grants (staff of the practice read; nobody writes directly; never anon)
--   8. Patient portal guard and checks
--   Undo at the end.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Look first (read only)
-- ---------------------------------------------------------------------------------------------

-- Triggers on the two invoice tables today: the BEFORE triggers that set invoice_number or the
-- medical aid / patient portions are replaced in sections 4 and 5
SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relname IN ('invoices_enhanced', 'invoice_services') AND NOT t.tgisinternal
ORDER BY 1, 2;

-- Unique constraints and indexes on invoices_enhanced.invoice_number
SELECT i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS definition
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid AND t.relname = 'invoices_enhanced'
WHERE ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%invoice_number%';

-- ---------------------------------------------------------------------------------------------
-- 1. invoice_services: each line's own service date, treating practitioner and discount.
--    NULL date / practitioner: the visit's (claims and the printed invoice fall back to them).
--    total_price stays the amount the line is billed at (after a discount, which only private
--    patients get), so invoice totals, receipts and reports need no change.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services
  ADD COLUMN IF NOT EXISTS service_date date,
  ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_discount_not_negative') THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_discount_not_negative CHECK (discount_amount >= 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS invoice_services_practitioner_idx ON public.invoice_services (practitioner_id) WHERE practitioner_id IS NOT NULL;

COMMENT ON COLUMN public.invoice_services.service_date IS 'Date the service was given; NULL: the visit date. Claims use it per line.';
COMMENT ON COLUMN public.invoice_services.practitioner_id IS 'Treating practitioner of this line (users.id); NULL: the invoice''s. Claims carry this practitioner''s HPCNA number.';
COMMENT ON COLUMN public.invoice_services.discount_amount IS 'N$ taken off the line for a private patient; total_price is the amount after it (unit_price x quantity - discount).';

-- ---------------------------------------------------------------------------------------------
-- 2. invoices_enhanced.created_by: who raised the invoice (reception may). practitioner_id stays the
--    TREATING practitioner. No foreign key: a sign-in without a staff row must still be able to bill.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoices_enhanced ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
COMMENT ON COLUMN public.invoices_enhanced.created_by IS 'Who raised the invoice (auth user). The treating practitioner is practitioner_id.';
COMMENT ON COLUMN public.invoices_enhanced.practitioner_id IS 'The treating practitioner (the visit''s unless chosen otherwise); not necessarily who raised the invoice.';

-- ---------------------------------------------------------------------------------------------
-- 3. invoice_number_series: one counter per practice, and the format (prefix + zero-padded counter)
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_number_series (
  practice_id uuid PRIMARY KEY REFERENCES public.practices(id) ON DELETE CASCADE,
  -- No digits in the prefix: claim field 24 keeps the last 8 digits of the number, which must be the counter
  prefix      text NOT NULL DEFAULT 'INV-' CHECK (prefix ~ '^[A-Za-z][A-Za-z/-]{0,9}$'),
  width       smallint NOT NULL DEFAULT 6 CHECK (width BETWEEN 4 AND 8),
  next_value  bigint NOT NULL DEFAULT 1 CHECK (next_value BETWEEN 1 AND 99999999),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.invoice_number_series IS
  'The next invoice number of each practice. Taken by the invoices_enhanced insert trigger in the insert''s own transaction, so numbers are gapless and never repeat.';

-- The format, as src/utils/billing/invoiceNumber.ts formatSequentialInvoiceNumber writes it: never cut short
CREATE OR REPLACE FUNCTION public.invoice_format_number(p_prefix text, p_width integer, p_value bigint)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_prefix || CASE WHEN length(p_value::text) >= p_width THEN p_value::text ELSE lpad(p_value::text, p_width, '0') END
$$;

-- Every practice starts after the highest number of this format it already has (normally 1)
INSERT INTO public.invoice_number_series (practice_id, next_value)
SELECT p.id,
       COALESCE((
         SELECT max(substring(i.invoice_number FROM '^INV-([0-9]{1,8})$')::bigint)
         FROM public.invoices_enhanced i
         WHERE i.practice_id = p.id AND i.invoice_number ~ '^INV-[0-9]{1,8}$'
       ), 0) + 1
FROM public.practices p
ON CONFLICT (practice_id) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 4. The numbering trigger (it fires after any older one and decides the number), and uniqueness
--    per practice
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoice_assign_number()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix text;
  v_width integer;
  v_value bigint;
BEGIN
  -- Imports that keep their own numbers, and the rare invoice without a practice, keep what was sent
  IF NEW.practice_id IS NULL OR COALESCE(current_setting('hpms.keep_invoice_number', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  -- An upsert of an invoice that already exists (INSERT ... ON CONFLICT (id) DO UPDATE) keeps its number
  -- and takes none from the counter
  IF NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM invoices_enhanced WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO invoice_number_series (practice_id) VALUES (NEW.practice_id) ON CONFLICT (practice_id) DO NOTHING;
  -- Locks the practice's counter until this insert commits or rolls back: no gaps, no repeats
  UPDATE invoice_number_series
     SET next_value = next_value + 1, updated_at = now()
   WHERE practice_id = NEW.practice_id
   RETURNING prefix, width, next_value - 1 INTO v_prefix, v_width, v_value;
  NEW.invoice_number := invoice_format_number(v_prefix, v_width, v_value);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.invoice_assign_number() FROM PUBLIC, anon;

-- Older triggers that set invoice_number (a month counter read with MAX()+1, which repeats numbers when two
-- invoices are saved at once) are left in place: one of them may also fill other fields. Triggers of the same
-- kind fire in name order, so this one is named to fire last and its number is the one kept.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tg.tgname, pg_get_triggerdef(tg.oid) AS def
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid AND c.relname = 'invoices_enhanced'
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE NOT tg.tgisinternal
      AND p.proname <> 'invoice_assign_number'
      AND p.prosrc ~* 'NEW\.invoice_number\s*:?='
  LOOP
    RAISE NOTICE 'Section 4: kept % (it also sets invoice_number; the new trigger fires after it and its number wins): %', t.tgname, t.def;
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS zz_invoices_enhanced_assign_number ON public.invoices_enhanced;
CREATE TRIGGER zz_invoices_enhanced_assign_number
  BEFORE INSERT ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.invoice_assign_number();

-- Uniqueness per practice first, then the global constraint goes. A number used twice in one practice
-- stops the script here with a count (the numbers themselves are not printed)
DO $$
DECLARE
  v_twice integer;
BEGIN
  SELECT count(*) INTO v_twice FROM (
    SELECT 1 FROM public.invoices_enhanced
    GROUP BY practice_id, invoice_number HAVING count(*) > 1
  ) d;
  IF v_twice > 0 THEN
    RAISE EXCEPTION 'Stopped: % invoice number(s) are used more than once within a practice. Renumber the duplicates (keep the oldest) and run this file again.', v_twice;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_enhanced_practice_number_unique
  ON public.invoices_enhanced (practice_id, invoice_number) WHERE practice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_enhanced_number_without_practice_unique
  ON public.invoices_enhanced (invoice_number) WHERE practice_id IS NULL;

DO $$
DECLARE
  v_table oid := 'public.invoices_enhanced'::regclass;
  v_column smallint;
  r record;
BEGIN
  SELECT attnum INTO v_column FROM pg_attribute WHERE attrelid = v_table AND attname = 'invoice_number';
  -- A foreign key that needs the global constraint means numbers must stay unique across practices
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = v_table AND contype = 'f' AND v_column = ANY (confkey)) THEN
    RAISE EXCEPTION 'Stopped: a foreign key references invoices_enhanced.invoice_number. Keep the global unique constraint and give each practice its own prefix (invoice_number_series.prefix) instead of dropping it; tell the developers.';
  END IF;
  FOR r IN
    SELECT conname FROM pg_constraint WHERE conrelid = v_table AND contype = 'u' AND conkey = ARRAY[v_column]
  LOOP
    RAISE NOTICE 'Section 4: replacing the global unique constraint % with uniqueness per practice', r.conname;
    EXECUTE format('ALTER TABLE public.invoices_enhanced DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT i.relname
    FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE ix.indrelid = v_table AND ix.indisunique AND ix.indnkeyatts = 1 AND ix.indkey[0] = v_column
      AND ix.indpred IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conindid = ix.indexrelid)
  LOOP
    RAISE NOTICE 'Section 4: replacing the global unique index % with uniqueness per practice', r.relname;
    EXECUTE format('DROP INDEX public.%I', r.relname);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. The split: medical_aid_covered (the fund's portion) + patient_portion = total_price. The app
--    works it out per line (co-payments, discounts: invoiceLineRow.ts); a trigger used to force every
--    medical aid line to the fund in full. The new trigger keeps a split that adds up and only fills in
--    a missing or inconsistent one, the old way (medical aid patient: the fund pays all; private: the
--    patient pays all).
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoice_services_fill_split()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_aid boolean;
BEGIN
  IF NEW.total_price IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.medical_aid_covered IS NOT NULL AND NEW.patient_portion IS NOT NULL
     AND NEW.medical_aid_covered >= 0 AND NEW.patient_portion >= 0
     AND round((NEW.medical_aid_covered + NEW.patient_portion)::numeric, 2) = round(NEW.total_price::numeric, 2) THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM medical_aid_details m JOIN invoices_enhanced i ON i.patient_id = m.patient_id WHERE i.id = NEW.invoice_id
  ) INTO v_has_aid;
  IF v_has_aid THEN
    NEW.medical_aid_covered := NEW.total_price;
    NEW.patient_portion := 0;
  ELSE
    NEW.medical_aid_covered := 0;
    NEW.patient_portion := NEW.total_price;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.invoice_services_fill_split() FROM PUBLIC, anon;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tg.tgname, p.prosrc, pg_get_triggerdef(tg.oid) AS def
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid AND c.relname = 'invoice_services'
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE NOT tg.tgisinternal
      AND p.proname <> 'invoice_services_fill_split'
      AND (tg.tgtype & 2) = 2 -- BEFORE
      AND p.prosrc ~* 'NEW\.(medical_aid_covered|patient_portion)\s*:='
  LOOP
    IF t.prosrc ~* 'NEW\.(?!medical_aid_covered|patient_portion)[a-z_]+\s*:=' THEN
      -- It also sets other fields (for example the line's transaction number): keep it and say so
      RAISE NOTICE 'Section 5: KEPT % because it also sets other fields; while it runs it overwrites co-payments. Change it by hand: %', t.tgname, t.def;
    ELSE
      RAISE NOTICE 'Section 5: replacing the split trigger %: %', t.tgname, t.def;
      EXECUTE format('DROP TRIGGER %I ON public.invoice_services', t.tgname);
    END IF;
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS invoice_services_fill_split ON public.invoice_services;
CREATE TRIGGER invoice_services_fill_split
  BEFORE INSERT OR UPDATE OF total_price, medical_aid_covered, patient_portion ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.invoice_services_fill_split();

-- 5b. The invoice's fund and patient totals must be the sums of its lines' portions (receipts allocate
--     against those two portions). Earlier versions of the totals trigger either add up the lines'
--     portions (kept as they are, tax rule included) or set the whole total to the medical aid for any
--     medical aid patient, which hides a co-payment (replaced, printed). A trigger that also batches
--     claims is never dropped. The new totals trigger (VAT-inclusive tariffs: tax 0) is created only
--     when no trigger that adds up the lines' portions remains.
CREATE OR REPLACE FUNCTION public.invoice_sync_totals()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoices uuid[];
  v_invoice uuid;
  v_total numeric;
  v_fund numeric;
  v_patient numeric;
BEGIN
  -- NEW is null on DELETE and OLD on INSERT: read the invoice(s) from the rows that exist
  IF TG_OP = 'DELETE' THEN
    v_invoices := ARRAY[OLD.invoice_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    v_invoices := ARRAY[OLD.invoice_id, NEW.invoice_id];
  ELSE
    v_invoices := ARRAY[NEW.invoice_id];
  END IF;
  FOREACH v_invoice IN ARRAY v_invoices LOOP
    SELECT COALESCE(sum(total_price), 0), COALESCE(sum(medical_aid_covered), 0), COALESCE(sum(patient_portion), 0)
      INTO v_total, v_fund, v_patient
      FROM invoice_services WHERE invoice_id = v_invoice;
    UPDATE invoices_enhanced
       SET subtotal = v_total, tax = 0, total = v_total, medical_aid_total = v_fund, patient_total = v_patient, updated_at = now()
     WHERE id = v_invoice
       AND (subtotal, tax, total, medical_aid_total, patient_total) IS DISTINCT FROM (v_total, 0::numeric, v_total, v_fund, v_patient);
  END LOOP;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.invoice_sync_totals() FROM PUBLIC, anon;

DO $$
DECLARE
  t record;
  v_summing integer := 0;
BEGIN
  FOR t IN
    SELECT tg.tgname, p.prosrc, pg_get_triggerdef(tg.oid) AS def
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid AND c.relname = 'invoice_services'
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE NOT tg.tgisinternal
      AND p.proname <> 'invoice_sync_totals'
      AND (tg.tgtype & 2) = 0 -- AFTER
      AND p.prosrc ~* 'update\s+(public\.)?invoices_enhanced'
      AND p.prosrc ~* 'medical_aid_total\s*='
  LOOP
    IF t.prosrc ~* 'batch' THEN
      RAISE NOTICE 'Section 5b: KEPT % because it also batches claims; check it does not set medical_aid_total to the whole total: %', t.tgname, t.def;
    ELSIF t.prosrc ~* 'sum\s*\(\s*([a-z_]+\.)?medical_aid_covered' AND t.prosrc ~* 'sum\s*\(\s*([a-z_]+\.)?patient_portion' THEN
      v_summing := v_summing + 1;
      RAISE NOTICE 'Section 5b: kept % (it already adds up the lines'' portions): %', t.tgname, t.def;
    ELSE
      RAISE NOTICE 'Section 5b: replacing % (it does not add up the lines'' portions): %', t.tgname, t.def;
      EXECUTE format('DROP TRIGGER %I ON public.invoice_services', t.tgname);
    END IF;
  END LOOP;
  EXECUTE 'DROP TRIGGER IF EXISTS invoice_services_sync_totals ON public.invoice_services';
  IF v_summing = 0 THEN
    EXECUTE 'CREATE TRIGGER invoice_services_sync_totals AFTER INSERT OR UPDATE OR DELETE ON public.invoice_services FOR EACH ROW EXECUTE FUNCTION public.invoice_sync_totals()';
    RAISE NOTICE 'Section 5b: invoice totals now follow the lines (invoice_services_sync_totals).';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. invoice_audit_events: who changed what on an invoice, and when (append-only)
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_audit_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id uuid,
  -- No foreign key: the history outlives an invoice that is deleted
  invoice_id  uuid NOT NULL,
  action      text NOT NULL CHECK (action IN ('invoice_changed', 'line_added', 'line_removed', 'line_changed')),
  -- invoice_changed: the field with its value before and after (text)
  field       text,
  old_value   text,
  new_value   text,
  -- line events: the line's code and the whole row before and after
  line_id     uuid,
  line_code   text,
  line_before jsonb,
  line_after  jsonb,
  changed_by  uuid DEFAULT auth.uid(),
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_audit_events_invoice_idx ON public.invoice_audit_events (invoice_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS invoice_audit_events_practice_idx ON public.invoice_audit_events (practice_id, changed_at DESC);
COMMENT ON TABLE public.invoice_audit_events IS
  'Append-only history of invoice changes: non-financial invoice fields (note, treating practitioner, dates, visit, patient) and every line added, removed or changed, with who and when. Written by triggers only.';

CREATE OR REPLACE FUNCTION public.invoice_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The invoice history cannot be changed or deleted.';
END
$$;
DROP TRIGGER IF EXISTS invoice_audit_events_append_only ON public.invoice_audit_events;
CREATE TRIGGER invoice_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.invoice_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.invoice_audit_append_only();
DROP TRIGGER IF EXISTS invoice_audit_events_no_truncate ON public.invoice_audit_events;
CREATE TRIGGER invoice_audit_events_no_truncate
  BEFORE TRUNCATE ON public.invoice_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.invoice_audit_append_only();

-- Invoice fields: the ones that are not money (amounts change through the lines, credit notes and receipts)
CREATE OR REPLACE FUNCTION public.invoice_audit_invoice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_field text;
  v_old text;
  v_new text;
BEGIN
  FOREACH v_field IN ARRAY ARRAY['notes', 'practitioner_id', 'due_date', 'issue_date', 'visit_id', 'patient_id'] LOOP
    v_old := to_jsonb(OLD) ->> v_field;
    v_new := to_jsonb(NEW) ->> v_field;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO invoice_audit_events (practice_id, invoice_id, action, field, old_value, new_value)
      VALUES (NEW.practice_id, NEW.id, 'invoice_changed', v_field, v_old, v_new);
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.invoice_audit_invoice() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS invoices_enhanced_audit ON public.invoices_enhanced;
CREATE TRIGGER invoices_enhanced_audit
  AFTER UPDATE ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.invoice_audit_invoice();

-- Lines: added, removed, or changed in anything but the bookkeeping columns
CREATE OR REPLACE FUNCTION public.invoice_audit_line()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice uuid;
  v_practice uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- NEW is null on DELETE and OLD on INSERT: read the invoice from the row that exists
  IF TG_OP = 'DELETE' THEN
    v_invoice := OLD.invoice_id;
  ELSE
    v_invoice := NEW.invoice_id;
  END IF;
  SELECT practice_id INTO v_practice FROM invoices_enhanced WHERE id = v_invoice;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO invoice_audit_events (practice_id, invoice_id, action, line_id, line_code, line_after)
    VALUES (v_practice, v_invoice, 'line_added', NEW.id, NEW.code, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO invoice_audit_events (practice_id, invoice_id, action, line_id, line_code, line_before)
    VALUES (v_practice, v_invoice, 'line_removed', OLD.id, OLD.code, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  v_before := to_jsonb(OLD) - 'updated_at' - 'system_transaction_number';
  v_after := to_jsonb(NEW) - 'updated_at' - 'system_transaction_number';
  IF v_before IS DISTINCT FROM v_after THEN
    INSERT INTO invoice_audit_events (practice_id, invoice_id, action, line_id, line_code, line_before, line_after)
    VALUES (v_practice, v_invoice, 'line_changed', NEW.id, NEW.code, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.invoice_audit_line() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS invoice_services_audit ON public.invoice_services;
CREATE TRIGGER invoice_services_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.invoice_audit_line();

-- ---------------------------------------------------------------------------------------------
-- 7. RLS and grants: the practice's staff read; nobody writes the two new tables directly (the
--    SECURITY DEFINER triggers do); anon gets nothing
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_number_series_read ON public.invoice_number_series;
CREATE POLICY invoice_number_series_read ON public.invoice_number_series
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = invoice_number_series.practice_id));

DROP POLICY IF EXISTS invoice_audit_events_read ON public.invoice_audit_events;
CREATE POLICY invoice_audit_events_read ON public.invoice_audit_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = invoice_audit_events.practice_id));

REVOKE ALL ON public.invoice_number_series FROM anon, authenticated;
REVOKE ALL ON public.invoice_audit_events FROM anon, authenticated;
GRANT SELECT ON public.invoice_number_series TO authenticated;
GRANT SELECT ON public.invoice_audit_events TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Patient portal guard (when proposals/2026-10-07-patient-portal.sql is applied, patient logins
--    must not read the new tables), then checks
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

DO $$
DECLARE
  v_mismatched integer;
BEGIN
  -- The format: never cut short, always padded
  IF public.invoice_format_number('INV-', 6, 123) <> 'INV-000123' OR public.invoice_format_number('INV-', 6, 1234567) <> 'INV-1234567' THEN
    RAISE EXCEPTION 'invoice_format_number does not match src/utils/billing/invoiceNumber.ts';
  END IF;
  -- Every practice has a counter
  IF EXISTS (SELECT 1 FROM public.practices p WHERE NOT EXISTS (SELECT 1 FROM public.invoice_number_series s WHERE s.practice_id = p.id)) THEN
    RAISE EXCEPTION 'A practice has no invoice counter';
  END IF;
  -- Invoice totals against their lines (receipts read the totals): expected 0
  SELECT count(*) INTO v_mismatched
  FROM public.invoices_enhanced i
  JOIN LATERAL (
    SELECT COALESCE(sum(s.total_price), 0)::numeric AS total, COALESCE(sum(s.medical_aid_covered), 0)::numeric AS fund
    FROM public.invoice_services s WHERE s.invoice_id = i.id
  ) l ON true
  WHERE EXISTS (SELECT 1 FROM public.invoice_services s WHERE s.invoice_id = i.id)
    AND (round(COALESCE(i.total, 0)::numeric, 2) <> round(l.total, 2) OR round(COALESCE(i.medical_aid_total, 0)::numeric, 2) <> round(l.fund, 2));
  RAISE NOTICE 'Section 8: % invoice(s) have totals that differ from their lines (expected 0).', v_mismatched;
END
$$;

-- Expected: the new triggers, and none of the replaced ones
SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relname IN ('invoices_enhanced', 'invoice_services', 'invoice_audit_events') AND NOT t.tgisinternal
ORDER BY 1, 2;

-- Expected: one row per practice; next_value 1 unless INV-###### numbers already exist
SELECT s.practice_id, s.prefix, s.width, s.next_value FROM public.invoice_number_series s ORDER BY s.practice_id;

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction. New invoices then get the app's provisional numbers again
-- (INV + yymm + 5 digits); numbers already issued (INV-000001 ...) stay.
--   BEGIN;
--   DROP TRIGGER IF EXISTS zz_invoices_enhanced_assign_number ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS invoices_enhanced_audit ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS invoice_services_audit ON public.invoice_services;
--   DROP TRIGGER IF EXISTS invoice_services_fill_split ON public.invoice_services;
--   DROP TRIGGER IF EXISTS invoice_services_sync_totals ON public.invoice_services;
--   -- Recreate the triggers sections 5 and 5b replaced (the NOTICE lines hold their definitions).
--   -- Two practices may now share a number such as INV-000001: before restoring a global unique
--   -- constraint, give one of them another prefix or keep the per-practice index.
--   DROP TABLE IF EXISTS public.invoice_audit_events;
--   DROP TABLE IF EXISTS public.invoice_number_series;
--   DROP FUNCTION IF EXISTS public.invoice_assign_number();
--   DROP FUNCTION IF EXISTS public.invoice_services_fill_split();
--   DROP FUNCTION IF EXISTS public.invoice_sync_totals();
--   DROP FUNCTION IF EXISTS public.invoice_audit_invoice();
--   DROP FUNCTION IF EXISTS public.invoice_audit_line();
--   DROP FUNCTION IF EXISTS public.invoice_audit_append_only();
--   DROP FUNCTION IF EXISTS public.invoice_format_number(text, integer, bigint);
--   ALTER TABLE public.invoices_enhanced DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_discount_not_negative,
--     DROP COLUMN IF EXISTS discount_amount, DROP COLUMN IF EXISTS practitioner_id, DROP COLUMN IF EXISTS service_date;
--   COMMIT;
-- The app keeps working after the undo: it no longer finds the columns and table and stops offering
-- per-line dates, practitioners, discounts, co-payments and the change history.
-- (Lines saved with a discount keep their lower total_price; review them before the undo.)
-- =============================================================================================
