-- Applied 2026-10-08 as migration dispensing_and_stock_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: stock, suppliers and dispensing
-- File:    proposals/2026-10-07-dispensing-and-stock.sql                   Drafted: 2026-10-07
-- Code:    src/utils/stock/* (the tested rules: prices, directions, repeats, reorder, valuation),
--          src/services/stock/stockService.ts (reads and writes), src/components/stock/* (the Stock page,
--          dispensing in the visit, medicines in the patient file, "From stock" on the visit bill)
-- Parity:  Eminance rows L1-L9, L12, L13, L15 and L16 (stock, suppliers and dispensing)
--
-- This script has NOT been applied. It runs inside a transaction that ends in ROLLBACK, so running it
-- by mistake leaves nothing behind.
--
-- Why
--   Settings > Practice > Inventory is a list whose quantities are typed over by hand. Nothing records
--   a delivery, a supplier, a stock count or a write-off, nothing is taken off stock when an item is
--   billed or dispensed, and there is no dispensing (labels, directions, repeats). Dispensing practices
--   (many Namibian GPs) need all of it, and dentists and optometrists need the stock part for their
--   consumables and frames.
--
-- How to apply
--   1. Run the whole file once as it is: section 22 must pass (it prints one NOTICE). Then change the
--      final ROLLBACK to COMMIT and run it again, or apply it as a migration without its BEGIN /
--      ROLLBACK lines. It only adds objects, plus two columns and three triggers on invoice tables.
--   2. Nothing to deploy. Before it is applied the Stock page says "Stock and dispensing are not set up
--      yet", Settings > Practice > Inventory works as before and nothing about dispensing shows.
--   3. After it is applied: every inventory item with a quantity gets an opening balance (section 19),
--      Settings > Practice > Inventory links to the Stock page, and a practice admin switches on
--      "We dispense medicine" and sets the practice's own price rule (Stock > Settings).
--   Apply order: after proposals/2026-10-07-receipts-and-allocations.sql (credit notes),
--   proposals/2026-10-07-debtors-and-controls.sql (period lock, month-end closes) and
--   proposals/2026-10-07-patient-lists.sql (patient_list_facts); before
--   proposals/2026-10-07-patient-portal.sql, whose staff-only guard then covers these tables too.
--   It is listed in DEFAULT_ORDER (scripts/db/rehearsal.ts) after practice-protected-columns and before the
--   dental chart, Eminance import and patient portal files (none of which touch these objects).
--
-- What it adds
--   practice_inventory     (existing; ADD COLUMN only) NAPPI code, barcode, group, billing code (tariff
--                          link), VAT rate, fixed selling price, maximum holding, pack size, preferred
--                          supplier, scheduled-medicine flag, usual directions, active flag. Its quantity,
--                          total_value, unit_cost and expiry_date become a copy of the stock ledger,
--                          rewritten after every movement (Finance > Ledgers > Inventory reads them; it
--                          values quantity x unit_cost, which keeps 2 decimals, so it can differ from the
--                          ledger value by a few cents; total_value is the exact ledger value).
--   stock_settings         per practice: "We dispense medicine" (off by default), default VAT rate, the
--                          practice's own price rule (markup and dispensing fee by cost band), how long
--                          repeats stay valid, a short note printed on labels.
--   stock_suppliers        the supplier master.
--   stock_movements        THE stock ledger, append-only: opening balances, deliveries, returns to
--                          suppliers, sales (invoice lines), dispensing without billing, adjustments with
--                          a reason, stock-count differences, reversals. On hand = the sum of quantities;
--                          stock value = the sum of values (average cost). Never changed or deleted.
--   stock_deliveries       goods received (GRV) and returned (RET) against a supplier with the supplier's
--                          invoice or credit note number; a delivery creates the supplier's payable in
--                          practice_expenses (Finance > Ledgers > Expenses, Settings > Practice Overhead).
--   stock_counts (+ lines) stock takes: counted quantities against what the ledger expected when each count
--                          was entered; posting writes the differences.
--   stock_dispensings      what was dispensed to whom: quantity, directions (label text), repeats, chronic,
--                          prescriber, and whether it was billed on the visit's invoice.
--   stock_orders           supplier orders made from the reorder report.
--   stock_valuations       stock valuations kept as they were: one at every month-end close, or by hand.
--   invoice_services       (existing; ADD COLUMN only) stock_item_id and nappi_code, filled from the line's
--                          tariff_id when it names a stock item of the invoice's practice.
--   patient_list_facts()   (existing) one more fact, next_repeat_due_on, for the "Repeat medicine due" list.
--
-- Rules the database enforces (the same rules are in src/utils/stock/*, tested)
--   - On hand is never typed over: every change is a movement with a document or a reason.
--   - An invoice line that names a stock item takes it off stock when saved; removing the line,
--     cancelling the invoice or crediting it in full (standing credit notes >= its total) puts it back;
--     reversing that credit note takes it off again. A partial credit note (a price correction) leaves
--     stock alone. A line is matched to its item by invoice_services.tariff_id = practice_inventory.id,
--     which the visit screens keep when they save the lines again.
--   - Movements are dated on the day they are recorded (Windhoek); nothing dated in a closed month
--     is accepted (dc_assert_open), so a month-end stock valuation cannot change afterwards.
--   - Issues and losses are valued at the average cost of what is on hand; deliveries at their cost
--     excluding VAT. Taking the last units leaves exactly zero value.
--   - Prices come from the practice's own rule (or a fixed price on the item). No regulatory formula is
--     built in.
--   - Who may do what (users.role of an active staff member of the practice): settings - admin;
--     adjustments, posting a count, reversing a delivery, keeping a valuation - admin or doctor; stock
--     items and dispensing - admin, doctor or nurse; deliveries, returns, orders, counting and suppliers -
--     any staff member. The same lists are in src/utils/stock/stockRoles.ts for the screens.
--
-- Decisions for the owner
--   - VAT: prices from the rule add the item's VAT rate (default 15 %, set per practice and per item) to
--     cost + markup + fee; a fixed price is taken as including VAT. Stock is valued excluding VAT, which
--     suits a VAT-registered practice. Confirm with the practice's accountant.
--   - The dispensing fee is per dispensed line and is spread over the units, so the invoice line keeps
--     "unit price x quantity" (rounded to the cent per unit).
--   - Returns to a supplier record the supplier's credit but do not reduce a payable automatically.
--   - Stock used during procedures (gloves, anaesthetic) is not taken off per procedure: count it at the
--     stock take, or record it as an adjustment ("Used in the practice").
--   - Claims: invoice_services.nappi_code is filled for medicine lines; sync_invoice_to_batch (claims)
--     still copies only the code. One line there (nappi_code = v_service.nappi_code) puts the NAPPI in
--     claim field 26; left to the claims owner.
--   - A patient with dispensing records cannot be deleted (stock_dispensings.patient_id is RESTRICT): the
--     records of what was handed out, scheduled medicines included, are kept like invoices.
--
-- Rehearsal (counts only, inside one rolled-back transaction, simulated sign-ins): see the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions: the tables, columns and functions this script relies on
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
  v_facts   regprocedure := to_regprocedure('public.patient_list_facts(uuid,date,uuid[])');
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.practice_inventory'), ('public.invoice_services'), ('public.invoices_enhanced'),
                 ('public.invoice_adjustments'), ('public.practice_expenses'), ('public.period_closes'),
                 ('public.patients'), ('public.visits'), ('public.users'), ('public.practices')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply the receipts and the debtors proposals first.', v_missing;
  END IF;

  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.ar_today()'), ('public.ar_is_cancelled(text)'), ('public.dc_assert_open(uuid,date,text)'),
                 ('public.patient_list_facts(uuid,date,uuid[])'), ('public.patient_lists_can_access(uuid)')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
    FROM (VALUES
      ('practice_inventory', 'practice_id'), ('practice_inventory', 'quantity'), ('practice_inventory', 'unit_cost'),
      ('practice_inventory', 'total_value'), ('practice_inventory', 'expiry_date'), ('practice_inventory', 'category'),
      ('invoice_services', 'invoice_id'), ('invoice_services', 'tariff_id'), ('invoice_services', 'quantity'),
      ('invoices_enhanced', 'practice_id'), ('invoices_enhanced', 'patient_id'), ('invoices_enhanced', 'visit_id'),
      ('invoices_enhanced', 'practitioner_id'), ('invoices_enhanced', 'invoice_number'), ('invoices_enhanced', 'payment_status'),
      ('invoices_enhanced', 'total'), ('invoice_adjustments', 'invoice_id'), ('invoice_adjustments', 'kind'),
      ('invoice_adjustments', 'amount'), ('invoice_adjustments', 'reversed_at'), ('invoice_adjustments', 'adjustment_number'),
      ('practice_expenses', 'vendor_name'), ('practice_expenses', 'due_date'), ('practice_expenses', 'status'),
      ('period_closes', 'period_month'), ('users', 'role'), ('users', 'is_active'), ('users', 'is_super_admin')
    ) AS t(table_name, column_name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %', v_missing;
  END IF;

  -- Section 18 recreates patient_list_facts with one more column. Stop when it changed after
  -- 2026-10-07 (another change must be merged by hand, not overwritten). Re-running this file is fine.
  IF md5(pg_get_functiondef(v_facts)) <> '370ea795b4f61cc938be76c61f391e03'
     AND position('next_repeat_due_on' IN pg_get_function_result(v_facts)) = 0 THEN
    RAISE EXCEPTION 'Stopped: patient_list_facts() changed since 2026-10-07. Merge section 18 of this file with its new definition first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Helpers: who the caller is, document numbers, history guards, number checks
-- ---------------------------------------------------------------------------------------------

-- The caller's role in the practice (an active staff member), or NULL
CREATE OR REPLACE FUNCTION public.stock_role(p_practice_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.role::text FROM users u
   WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND COALESCE(u.is_active, true)
   LIMIT 1
$$;

-- Stops unless the caller is an active staff member of the practice with one of the roles (NULL = any role)
CREATE OR REPLACE FUNCTION public.stock_assert_role(p_practice_id uuid, p_roles text[], p_action text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  text := stock_role(p_practice_id);
  v_count integer := COALESCE(array_length(p_roles, 1), 0);
BEGIN
  IF p_practice_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'You can only work with the stock of your own practice' USING ERRCODE = '42501';
  END IF;
  IF v_count > 0 AND NOT (v_role = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Only a practice % can %',
      CASE WHEN v_count = 1 THEN p_roles[1]
           ELSE array_to_string(p_roles[1:v_count - 1], ', ') || ' or ' || p_roles[v_count] END,
      p_action USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.stock_assert_patient(p_practice_id uuid, p_patient_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_patient_id IS NULL OR NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = p_patient_id AND p.practice_id = p_practice_id) THEN
    RAISE EXCEPTION 'This patient is not a patient of your practice' USING ERRCODE = '42501';
  END IF;
END $$;

-- A whole number from a JSON value, with a plain message naming the field
CREATE OR REPLACE FUNCTION public.stock_int(p_value jsonb, p_what text, p_min integer, p_max integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v numeric;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number' THEN
    RAISE EXCEPTION '% must be a whole number', p_what USING ERRCODE = '22023';
  END IF;
  v := p_value::text::numeric;
  IF v <> trunc(v) OR v < p_min OR v > p_max THEN
    RAISE EXCEPTION '% must be a whole number from % to %', p_what, p_min, p_max USING ERRCODE = '22023';
  END IF;
  RETURN v::integer;
END $$;

-- An amount in N$ (or a percentage) from a JSON value: a number from 0 to p_max with at most 2 decimals
CREATE OR REPLACE FUNCTION public.stock_amount(p_value jsonb, p_what text, p_max numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v numeric;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number' THEN
    RAISE EXCEPTION '% must be a number', p_what USING ERRCODE = '22023';
  END IF;
  v := p_value::text::numeric;
  IF v < 0 OR v > p_max OR v <> round(v, 2) THEN
    RAISE EXCEPTION '% must be from 0 to % with at most 2 decimals', p_what, p_max USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;

-- Optional text from a JSON payload: trimmed, NULL when empty, refused when longer than p_max
CREATE OR REPLACE FUNCTION public.stock_text(p_payload jsonb, p_key text, p_what text, p_max integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := NULLIF(btrim(COALESCE(p_payload ->> p_key, '')), '');
BEGIN
  IF v IS NOT NULL AND char_length(v) > p_max THEN
    RAISE EXCEPTION '% is too long (at most % characters)', p_what, p_max USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;

-- Document numbers per practice, series and year: GRV2026-0001 (goods received), RET (returned to a
-- supplier), ORD (supplier order), CNT (stock count), RX (dispensing). The counter row is locked by the
-- upsert, so two documents saved at once get different numbers; a failed save rolls the counter back.
CREATE TABLE IF NOT EXISTS public.stock_counters (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  series      text NOT NULL CHECK (series IN ('GRV', 'RET', 'ORD', 'CNT', 'RX')),
  year        integer NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  last_number integer NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (practice_id, series, year)
);
COMMENT ON TABLE public.stock_counters IS 'Last stock document number per practice, series and year. Written only by stock_next_number().';

CREATE OR REPLACE FUNCTION public.stock_next_number(p_practice_id uuid, p_series text, p_on date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM COALESCE(p_on, ar_today()))::integer;
  v_next integer;
BEGIN
  INSERT INTO stock_counters AS c (practice_id, series, year, last_number)
  VALUES (p_practice_id, p_series, v_year, 1)
  ON CONFLICT (practice_id, series, year) DO UPDATE SET last_number = c.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN p_series || v_year || '-' || lpad(v_next::text, 4, '0');
END $$;

-- Records kept as history. TG_ARGV[0]: the closing fields, set once (while the first of them is empty);
-- TG_ARGV[1]: links that their foreign key may clear (ON DELETE SET NULL). Nothing is ever deleted.
CREATE OR REPLACE FUNCTION public.stock_history_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_closing text[] := string_to_array(COALESCE(TG_ARGV[0], ''), ',');
  v_links   text[] := string_to_array(COALESCE(TG_ARGV[1], ''), ',');
  v_old     jsonb;
  v_new     jsonb;
  v_column  text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'This stock record is kept as history and cannot be deleted';
  END IF;
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOR v_column IN SELECT k FROM jsonb_object_keys(v_new) AS k WHERE v_new -> k IS DISTINCT FROM v_old -> k LOOP
    CONTINUE WHEN v_column = ANY (v_links) AND v_new ->> v_column IS NULL;
    CONTINUE WHEN v_column = ANY (v_closing) AND v_old ->> v_closing[1] IS NULL;
    RAISE EXCEPTION 'This stock record is kept as history: its % cannot be changed', replace(v_column, '_', ' ');
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.stock_no_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'This stock table is kept as history and cannot be emptied';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Practice settings
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_settings (
  practice_id         uuid PRIMARY KEY REFERENCES public.practices(id) ON DELETE CASCADE,
  -- Shows dispensing in the visit and the patient file. Stock for consumables works without it.
  dispensing_enabled  boolean NOT NULL DEFAULT false,
  -- Used when an item has no VAT rate of its own
  default_vat_rate    numeric(5,2) NOT NULL DEFAULT 15 CHECK (default_vat_rate BETWEEN 0 AND 100),
  -- {"bands": [{"up_to": N$ or null, "markup_percent": n, "fee": N$}, ...]}: the line's cost excluding VAT
  -- picks the first band it fits; price = cost + markup + fee, plus VAT. Checked by stock_save_settings.
  price_rule          jsonb NOT NULL DEFAULT '{"bands": [{"up_to": null, "markup_percent": 0, "fee": 0}]}'::jsonb,
  -- Repeats may be dispensed for this many months after the first dispensing
  script_valid_months integer NOT NULL DEFAULT 6 CHECK (script_valid_months BETWEEN 1 AND 24),
  -- A short line printed on every label (e.g. a dispensing licence number)
  label_note          text CHECK (label_note IS NULL OR char_length(label_note) <= 120),
  updated_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.stock_settings IS
  'Stock and dispensing settings per practice: dispensing on or off, default VAT, the practice''s own price rule, repeat validity, label note.';

-- ---------------------------------------------------------------------------------------------
-- 3. Suppliers
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_suppliers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  contact_name       text CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  phone              text CHECK (phone IS NULL OR char_length(phone) <= 40),
  email              text CHECK (email IS NULL OR char_length(email) <= 160),
  -- The practice's account number with the supplier (on orders and payables)
  account_number     text CHECK (account_number IS NULL OR char_length(account_number) <= 60),
  vat_number         text CHECK (vat_number IS NULL OR char_length(vat_number) <= 40),
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  notes              text CHECK (notes IS NULL OR char_length(notes) <= 500),
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_suppliers_name_key ON public.stock_suppliers (practice_id, lower(btrim(name)));
COMMENT ON TABLE public.stock_suppliers IS 'Suppliers of stock per practice (wholesalers, labs, frame suppliers). Deliveries, returns, orders and payables name them.';

-- ---------------------------------------------------------------------------------------------
-- 4. Stock items: practice_inventory gets the stock fields (ADD COLUMN only; its policies belong to
--    the practice-isolation work and are not touched)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.practice_inventory
  ADD COLUMN IF NOT EXISTS nappi_code text CHECK (nappi_code IS NULL OR nappi_code ~ '^[0-9A-Z]{6,15}$'),
  ADD COLUMN IF NOT EXISTS barcode text CHECK (barcode IS NULL OR char_length(barcode) BETWEEN 4 AND 40),
  ADD COLUMN IF NOT EXISTS item_group text CHECK (item_group IS NULL OR char_length(item_group) BETWEEN 1 AND 60),
  -- The code the item is billed under when it is not a medicine with a NAPPI code (the tariff link)
  ADD COLUMN IF NOT EXISTS tariff_code text CHECK (tariff_code IS NULL OR tariff_code ~ '^[A-Z0-9./-]{1,20}$'),
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) CHECK (vat_rate IS NULL OR vat_rate BETWEEN 0 AND 100),
  -- A fixed selling price per unit including VAT; NULL = the practice's price rule
  ADD COLUMN IF NOT EXISTS selling_price numeric(14,2) CHECK (selling_price IS NULL OR selling_price >= 0),
  -- reorder_level (existing) is the minimum holding; max_level the most to hold
  ADD COLUMN IF NOT EXISTS max_level integer CHECK (max_level IS NULL OR max_level >= 0),
  ADD COLUMN IF NOT EXISTS pack_size integer CHECK (pack_size IS NULL OR pack_size BETWEEN 1 AND 100000),
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.stock_suppliers(id) ON DELETE SET NULL,
  -- Every receipt and issue is listed in the scheduled-medicine register
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_label text CHECK (schedule_label IS NULL OR char_length(schedule_label) <= 20),
  -- Directions offered first when the item is dispensed, e.g. "1 tds"
  ADD COLUMN IF NOT EXISTS default_directions text CHECK (default_directions IS NULL OR char_length(default_directions) <= 60),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
-- Nothing else changes on practice_inventory (no index, comment or policy): a NAPPI code or barcode
-- naming one active item is checked by stock_save_item. Its quantity, total_value, unit_cost and
-- expiry_date become the ledger's copy (stock_refresh_item, section 9).

-- ---------------------------------------------------------------------------------------------
-- 5. Supplier orders (made from the reorder report; printable)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id          uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  number               text NOT NULL,
  supplier_id          uuid NOT NULL REFERENCES public.stock_suppliers(id) ON DELETE RESTRICT,
  ordered_on           date NOT NULL,
  -- [{"item_id", "name", "quantity", "unit_cost"}]: what was ordered, as it was ordered
  lines                jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) BETWEEN 1 AND 200),
  notes                text CHECK (notes IS NULL OR char_length(notes) <= 500),
  status               text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'received', 'cancelled')),
  status_changed_at    timestamptz,
  status_changed_by    uuid,
  received_delivery_id uuid,
  cancel_reason        text,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_orders_number_key UNIQUE (practice_id, number)
);
CREATE INDEX IF NOT EXISTS stock_orders_supplier_idx ON public.stock_orders (supplier_id, ordered_on DESC);
COMMENT ON TABLE public.stock_orders IS 'Supplier orders. An order is not changed: cancel it and make a new one. Receiving it records the delivery.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_orders;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_orders
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('status_changed_at,status,status_changed_by,received_delivery_id,cancel_reason', '');

-- ---------------------------------------------------------------------------------------------
-- 6. Deliveries: goods received (GRV) and returned to the supplier (RET)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_deliveries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  number             text NOT NULL,
  kind               text NOT NULL CHECK (kind IN ('received', 'returned')),
  supplier_id        uuid NOT NULL REFERENCES public.stock_suppliers(id) ON DELETE RESTRICT,
  -- The supplier's invoice number (received) or credit note / return note number (returned)
  supplier_reference text NOT NULL CHECK (char_length(btrim(supplier_reference)) BETWEEN 1 AND 60),
  document_date      date NOT NULL,
  total_excl_vat     numeric(14,2) NOT NULL CHECK (total_excl_vat >= 0),
  vat_amount         numeric(14,2) NOT NULL CHECK (vat_amount >= 0),
  total_incl_vat     numeric(14,2) NOT NULL,
  -- The supplier's payable in practice_expenses (received only)
  expense_id         uuid REFERENCES public.practice_expenses(id) ON DELETE SET NULL,
  order_id           uuid REFERENCES public.stock_orders(id) ON DELETE SET NULL,
  reason             text CHECK (reason IS NULL OR char_length(reason) <= 300),
  notes              text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  reversed_at        timestamptz,
  reversed_by        uuid,
  reversal_reason    text,
  CONSTRAINT stock_deliveries_number_key UNIQUE (practice_id, number),
  CONSTRAINT stock_deliveries_totals_add_up CHECK (total_incl_vat = total_excl_vat + vat_amount),
  CONSTRAINT stock_deliveries_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND char_length(btrim(COALESCE(reversal_reason, ''))) >= 3)
  )
);
-- The same supplier invoice cannot be captured twice (a common double entry)
CREATE UNIQUE INDEX IF NOT EXISTS stock_deliveries_supplier_reference_key
  ON public.stock_deliveries (practice_id, supplier_id, kind, lower(btrim(supplier_reference))) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_deliveries_practice_date_idx ON public.stock_deliveries (practice_id, document_date DESC);
CREATE INDEX IF NOT EXISTS stock_deliveries_supplier_idx ON public.stock_deliveries (supplier_id, document_date DESC);
COMMENT ON TABLE public.stock_deliveries IS
  'Goods received (GRV) and returned (RET) against a supplier document. Lines are the stock_movements with this delivery_id. Reversed with a reason, never changed.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_deliveries;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('reversed_at,reversed_by,reversal_reason', 'expense_id,order_id');
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_deliveries;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_deliveries
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 7. Dispensing records (scripts, labels, repeats)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_dispensings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  number          text NOT NULL,                       -- RX2026-0001, printed on the label
  -- A dispensing record is kept: a patient with one cannot be deleted
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  visit_id        uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  item_id         uuid NOT NULL REFERENCES public.practice_inventory(id) ON DELETE RESTRICT,
  quantity        integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  -- The prescription it was dispensed from, as written (the visit's medication lines are rewritten on every save)
  prescribed_as   text CHECK (prescribed_as IS NULL OR char_length(prescribed_as) <= 300),
  directions_code text CHECK (directions_code IS NULL OR char_length(directions_code) <= 60),
  -- The label text, e.g. "Take 1 tablet three times a day after meals for 7 days."
  directions      text NOT NULL CHECK (char_length(btrim(directions)) BETWEEN 1 AND 300),
  days_supply     integer CHECK (days_supply IS NULL OR days_supply BETWEEN 1 AND 366),
  repeats_allowed integer NOT NULL DEFAULT 0 CHECK (repeats_allowed BETWEEN 0 AND 12),
  -- A repeat names the first dispensing of its script
  repeat_of       uuid REFERENCES public.stock_dispensings(id) ON DELETE RESTRICT,
  is_chronic      boolean NOT NULL DEFAULT false,
  -- Repeats may be dispensed up to this date (first dispensings with repeats)
  valid_until     date,
  prescriber_id   uuid,
  -- true: billed on the visit's invoice (the invoice line moves the stock); false: given without billing
  billed          boolean NOT NULL,
  unit_price      numeric(14,2) CHECK (unit_price IS NULL OR unit_price >= 0),
  dispensed_on    date NOT NULL,
  dispensed_by    uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid,
  cancel_reason   text,
  CONSTRAINT stock_dispensings_number_key UNIQUE (practice_id, number),
  CONSTRAINT stock_dispensings_repeats_on_first CHECK (repeat_of IS NULL OR repeats_allowed = 0),
  CONSTRAINT stock_dispensings_cancel_complete CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL)
    OR (cancelled_at IS NOT NULL AND char_length(btrim(COALESCE(cancel_reason, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS stock_dispensings_patient_idx ON public.stock_dispensings (patient_id, dispensed_on DESC);
CREATE INDEX IF NOT EXISTS stock_dispensings_visit_idx ON public.stock_dispensings (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_dispensings_repeat_idx ON public.stock_dispensings (repeat_of) WHERE repeat_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_dispensings_practice_idx ON public.stock_dispensings (practice_id, dispensed_on DESC);
COMMENT ON TABLE public.stock_dispensings IS
  'Medicines dispensed to patients: directions (label text), repeats, chronic, prescriber. Billed ones are on the visit''s invoice; cancelled with a reason, never deleted.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_dispensings;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_dispensings
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('cancelled_at,cancelled_by,cancel_reason', 'visit_id');
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_dispensings;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_dispensings
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 8. Stock takes
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_counts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  number        text NOT NULL,
  -- Only the items of this group are counted; NULL = every active item
  item_group    text CHECK (item_group IS NULL OR char_length(item_group) <= 60),
  note          text CHECK (note IS NULL OR char_length(note) <= 300),
  status        text NOT NULL DEFAULT 'counting' CHECK (status IN ('counting', 'posted', 'cancelled')),
  started_by    uuid,
  started_at    timestamptz NOT NULL DEFAULT now(),
  -- Posted or cancelled
  closed_at     timestamptz,
  closed_by     uuid,
  cancel_reason text,
  -- What posting changed the stock value by (N$, excluding VAT)
  value_change  numeric(14,2),
  CONSTRAINT stock_counts_number_key UNIQUE (practice_id, number)
);
-- One count at a time per practice
CREATE UNIQUE INDEX IF NOT EXISTS stock_counts_one_open ON public.stock_counts (practice_id) WHERE status = 'counting';
COMMENT ON TABLE public.stock_counts IS 'Stock takes. Counting, then posted (the differences become stock movements) or cancelled.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_counts;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('closed_at,status,closed_by,cancel_reason,value_change', '');

CREATE TABLE IF NOT EXISTS public.stock_count_lines (
  count_id    uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE RESTRICT,
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  item_id     uuid NOT NULL REFERENCES public.practice_inventory(id) ON DELETE RESTRICT,
  -- What the ledger said was on hand when this count was entered (later sales do not make a difference)
  expected    integer NOT NULL,
  counted     integer NOT NULL CHECK (counted BETWEEN 0 AND 10000000),
  counted_by  uuid,
  counted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (count_id, item_id)
);
COMMENT ON TABLE public.stock_count_lines IS 'Counted quantities of a stock take, with what the ledger expected at that moment.';

CREATE OR REPLACE FUNCTION public.stock_count_lines_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stock_counts c WHERE c.id = COALESCE(NEW.count_id, OLD.count_id) AND c.status = 'counting') THEN
    RAISE EXCEPTION 'This stock count is closed: its counts can no longer change';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS stock_10_guard ON public.stock_count_lines;
CREATE TRIGGER stock_10_guard BEFORE INSERT OR UPDATE OR DELETE ON public.stock_count_lines
  FOR EACH ROW EXECUTE FUNCTION public.stock_count_lines_guard();

-- ---------------------------------------------------------------------------------------------
-- 9. The stock ledger
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  item_id         uuid NOT NULL REFERENCES public.practice_inventory(id) ON DELETE RESTRICT,
  kind            text NOT NULL CHECK (kind IN ('opening', 'received', 'returned', 'delivery_reversed', 'sold', 'sale_reversed',
                                                'dispensed', 'dispense_reversed', 'adjusted', 'counted')),
  -- Units in (+) or out (-)
  quantity        integer NOT NULL CHECK (quantity <> 0),
  -- The value at cost excluding VAT, with the same sign as the quantity (average cost for issues)
  value           numeric(14,2) NOT NULL,
  -- Deliveries and returns: the VAT on the line
  vat_amount      numeric(14,2),
  batch_no        text CHECK (batch_no IS NULL OR char_length(batch_no) <= 40),
  expiry_date     date,
  reason_code     text CHECK (reason_code IS NULL OR reason_code IN ('damaged', 'expired', 'lost', 'used_in_practice', 'sample',
                                                                     'found', 'correction', 'other')),
  reason          text CHECK (reason IS NULL OR char_length(reason) <= 300),
  -- The business day it happened (Windhoek)
  occurred_on     date NOT NULL,
  -- What caused it, as printed: "GRV2026-0003", "INV-1234", "RX2026-0012", "CNT2026-0002"
  document_ref    text CHECK (document_ref IS NULL OR char_length(document_ref) <= 60),
  delivery_id     uuid REFERENCES public.stock_deliveries(id) ON DELETE RESTRICT,
  -- No foreign keys: invoice lines are rewritten when a visit is saved, and the history stays when an
  -- invoice is deleted
  invoice_id      uuid,
  invoice_line_id uuid,
  credit_note_id  uuid,
  patient_id      uuid,
  practitioner_id uuid,
  dispensing_id   uuid REFERENCES public.stock_dispensings(id) ON DELETE RESTRICT,
  count_id        uuid REFERENCES public.stock_counts(id) ON DELETE RESTRICT,
  reverses_id     uuid REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_shape CHECK (
    CASE kind
      WHEN 'received' THEN quantity > 0 AND delivery_id IS NOT NULL
      WHEN 'returned' THEN quantity < 0 AND delivery_id IS NOT NULL
      WHEN 'delivery_reversed' THEN delivery_id IS NOT NULL AND reverses_id IS NOT NULL
      WHEN 'sold' THEN quantity < 0 AND invoice_line_id IS NOT NULL
      WHEN 'sale_reversed' THEN quantity > 0 AND invoice_line_id IS NOT NULL
      WHEN 'dispensed' THEN quantity < 0 AND dispensing_id IS NOT NULL
      WHEN 'dispense_reversed' THEN quantity > 0 AND dispensing_id IS NOT NULL
      WHEN 'adjusted' THEN reason_code IS NOT NULL AND char_length(btrim(COALESCE(reason, ''))) >= 3
      WHEN 'counted' THEN count_id IS NOT NULL
      ELSE true
    END
  )
);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements (item_id, occurred_on, created_at);
CREATE INDEX IF NOT EXISTS stock_movements_practice_idx ON public.stock_movements (practice_id, occurred_on);
CREATE INDEX IF NOT EXISTS stock_movements_line_idx ON public.stock_movements (invoice_line_id) WHERE invoice_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_invoice_idx ON public.stock_movements (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_delivery_idx ON public.stock_movements (delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_dispensing_idx ON public.stock_movements (dispensing_id) WHERE dispensing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_patient_idx ON public.stock_movements (patient_id) WHERE patient_id IS NOT NULL;
COMMENT ON TABLE public.stock_movements IS
  'The stock ledger: every unit in or out with its value at cost and the document or reason. On hand = sum(quantity). Never changed or deleted.';

-- Inserts: the item belongs to the practice, the month is open, who and when are stamped.
-- Updates and deletes: refused (a mistake is corrected with a new movement).
CREATE OR REPLACE FUNCTION public.stock_movements_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Stock movements are kept as history. Correct a mistake with a new movement (an adjustment or a reversal).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM practice_inventory i WHERE i.id = NEW.item_id AND i.practice_id = NEW.practice_id) THEN
    RAISE EXCEPTION 'The stock item belongs to another practice' USING ERRCODE = '42501';
  END IF;
  PERFORM dc_assert_open(NEW.practice_id, NEW.occurred_on, 'a stock movement');
  NEW.created_at := now();
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stock_10_guard ON public.stock_movements;
CREATE TRIGGER stock_10_guard BEFORE INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_guard();
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_movements;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

-- The item's copy of the ledger (practice_inventory.quantity, total_value, unit_cost, expiry_date), so
-- Finance > Ledgers > Inventory and other readers of practice_inventory stay right. Rewritten from the
-- sums (not added to), so a value typed over in the old screen is put right by the next movement.
-- expiry_date: the earliest expiry among the batches still on hand, assuming the earliest is used first.
CREATE OR REPLACE FUNCTION public.stock_refresh_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_on_hand    integer;
  v_value      numeric;
  v_has_expiry boolean;
  v_expiry     date;
BEGIN
  SELECT COALESCE(SUM(m.quantity), 0), COALESCE(SUM(m.value), 0), COALESCE(bool_or(m.expiry_date IS NOT NULL), false)
    INTO v_on_hand, v_value, v_has_expiry
    FROM stock_movements m WHERE m.item_id = p_item_id;
  IF v_has_expiry THEN
    SELECT MIN(b.expiry_date) INTO v_expiry
      FROM (SELECT r.expiry_date, r.qty, SUM(r.qty) OVER (ORDER BY r.expiry_date DESC) AS running
              FROM (SELECT m.expiry_date, SUM(m.quantity) AS qty FROM stock_movements m
                     WHERE m.item_id = p_item_id AND m.expiry_date IS NOT NULL
                       AND m.kind IN ('opening', 'received', 'returned', 'delivery_reversed')
                     GROUP BY m.expiry_date) r
             WHERE r.qty > 0) b
     WHERE b.running - b.qty < v_on_hand;
  END IF;
  UPDATE practice_inventory i
     SET quantity = v_on_hand,
         total_value = v_value,
         -- unit_cost is numeric(10,2): the average to the cent (values in the ledger stay exact)
         unit_cost = CASE WHEN v_on_hand > 0 AND v_value > 0 THEN round(v_value / v_on_hand, 2) ELSE i.unit_cost END,
         expiry_date = CASE WHEN v_has_expiry THEN v_expiry ELSE i.expiry_date END,
         last_updated = now()
   WHERE i.id = p_item_id;
END $$;

CREATE OR REPLACE FUNCTION public.stock_movements_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM stock_refresh_item(NEW.item_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS stock_50_refresh_item ON public.stock_movements;
CREATE TRIGGER stock_50_refresh_item AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_after();

-- On hand and value per item (the caller's row level security applies)
CREATE OR REPLACE VIEW public.stock_item_levels WITH (security_invoker = on) AS
SELECT m.practice_id,
       m.item_id,
       SUM(m.quantity)::integer AS on_hand,
       SUM(m.value)::numeric(14,2) AS value,
       MAX(m.occurred_on) AS last_movement_on,
       MAX(m.occurred_on) FILTER (WHERE m.kind = 'received') AS last_received_on
  FROM public.stock_movements m
 GROUP BY m.practice_id, m.item_id;
COMMENT ON VIEW public.stock_item_levels IS 'On hand, value at cost and last movement per stock item, from the stock ledger.';

-- The value (positive, N$ excl VAT) of taking p_quantity units off stock: the average cost of what is on
-- hand; all of it when the last units go (so the value left is exactly zero); the item's cost for units
-- beyond what is on hand.
CREATE OR REPLACE FUNCTION public.stock_issue_value(p_item_id uuid, p_quantity integer)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_on_hand integer;
  v_value   numeric;
  v_unit    numeric;
BEGIN
  IF COALESCE(p_quantity, 0) <= 0 THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(SUM(m.quantity), 0), COALESCE(SUM(m.value), 0) INTO v_on_hand, v_value
    FROM stock_movements m WHERE m.item_id = p_item_id;
  SELECT COALESCE(i.unit_cost, 0) INTO v_unit FROM practice_inventory i WHERE i.id = p_item_id;
  IF v_on_hand > 0 AND v_value >= 0 THEN
    IF p_quantity >= v_on_hand THEN
      RETURN v_value + round((p_quantity - v_on_hand) * v_unit, 2);
    END IF;
    RETURN round(v_value * p_quantity / v_on_hand, 2);
  END IF;
  RETURN round(p_quantity * v_unit, 2);
END $$;

-- The value (positive) of putting p_quantity units back or finding them: the average cost on hand,
-- else the item's cost
CREATE OR REPLACE FUNCTION public.stock_gain_value(p_item_id uuid, p_quantity integer)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_on_hand integer;
  v_value   numeric;
  v_unit    numeric;
BEGIN
  IF COALESCE(p_quantity, 0) <= 0 THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(SUM(m.quantity), 0), COALESCE(SUM(m.value), 0) INTO v_on_hand, v_value
    FROM stock_movements m WHERE m.item_id = p_item_id;
  SELECT COALESCE(i.unit_cost, 0) INTO v_unit FROM practice_inventory i WHERE i.id = p_item_id;
  IF v_on_hand > 0 AND v_value > 0 THEN
    RETURN round(v_value * p_quantity / v_on_hand, 2);
  END IF;
  RETURN round(p_quantity * v_unit, 2);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 10. Settings, items and suppliers
-- ---------------------------------------------------------------------------------------------
/*
  stock_save_settings(practice, {
    "dispensing_enabled": bool, "default_vat_rate": n, "script_valid_months": n, "label_note"?: text,
    "price_rule": {"bands": [{"up_to": N$ | null, "markup_percent": n, "fee": N$}, ...]}
  })  Admins only. The bands: 1 to 10, rising upper limits, the last without one.
*/
CREATE OR REPLACE FUNCTION public.stock_save_settings(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bands   jsonb := p_payload -> 'price_rule' -> 'bands';
  v_band    jsonb;
  v_count   integer;
  v_index   integer := 0;
  v_upper   numeric;
  v_last    numeric := 0;
  v_clean   jsonb := '[]'::jsonb;
  v_vat     numeric := stock_amount(COALESCE(p_payload -> 'default_vat_rate', '15'::jsonb), 'The VAT rate', 100);
  v_months  integer := stock_int(COALESCE(p_payload -> 'script_valid_months', '6'::jsonb), 'How long repeats stay valid (months)', 1, 24);
  v_enabled boolean := COALESCE((p_payload ->> 'dispensing_enabled')::boolean, false);
BEGIN
  PERFORM stock_assert_role(p_practice_id, ARRAY['admin'], 'change the stock and dispensing settings');
  IF jsonb_typeof(v_bands) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Set the price rule: at least one price band' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(v_bands);
  IF v_count NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'A price rule has 1 to 10 bands' USING ERRCODE = '22023';
  END IF;
  FOR v_band IN SELECT value FROM jsonb_array_elements(v_bands) LOOP
    v_index := v_index + 1;
    IF v_index < v_count THEN
      v_upper := stock_amount(v_band -> 'up_to', format('Band %s: "up to"', v_index), 10000000);
      IF v_upper <= v_last THEN
        RAISE EXCEPTION 'Band %: each band must go higher than the one before it', v_index USING ERRCODE = '22023';
      END IF;
      v_last := v_upper;
    ELSIF jsonb_typeof(v_band -> 'up_to') IS DISTINCT FROM 'null' AND v_band ? 'up_to' THEN
      RAISE EXCEPTION 'The last band covers everything above the band before it, so it has no upper limit' USING ERRCODE = '22023';
    ELSE
      v_upper := NULL;
    END IF;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'up_to', v_upper,
      'markup_percent', stock_amount(v_band -> 'markup_percent', format('Band %s: markup', v_index), 1000),
      'fee', stock_amount(v_band -> 'fee', format('Band %s: dispensing fee', v_index), 100000)));
  END LOOP;

  INSERT INTO stock_settings AS s (practice_id, dispensing_enabled, default_vat_rate, price_rule, script_valid_months, label_note, updated_by, updated_at)
  VALUES (p_practice_id, v_enabled, v_vat, jsonb_build_object('bands', v_clean), v_months,
          stock_text(p_payload, 'label_note', 'The label note', 120), auth.uid(), now())
  ON CONFLICT (practice_id) DO UPDATE
    SET dispensing_enabled = EXCLUDED.dispensing_enabled,
        default_vat_rate = EXCLUDED.default_vat_rate,
        price_rule = EXCLUDED.price_rule,
        script_valid_months = EXCLUDED.script_valid_months,
        label_note = EXCLUDED.label_note,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
  RETURN jsonb_build_object('practice_id', p_practice_id, 'dispensing_enabled', v_enabled);
END $$;

/*
  stock_save_item({
    "id"?, "practice_id", "name", "category", "unit", "description"?, "sku"?, "item_group"?, "nappi_code"?,
    "barcode"?, "tariff_code"?, "vat_rate"? (null = the practice default), "selling_price"? (null = the
    price rule), "unit_cost" (cost per unit excl VAT; only while the item has no movements), "reorder_level"?,
    "max_level"?, "pack_size"?, "preferred_supplier_id"?, "location"?, "notes"?, "is_scheduled", "schedule_label"?,
    "default_directions"?, "opening_quantity"? (new items), "opening_batch"?, "opening_expiry"?
  })  Admins, doctors and nurses.
*/
CREATE OR REPLACE FUNCTION public.stock_save_item(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id        uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_existing  practice_inventory%ROWTYPE;
  v_moved     boolean := false;
  v_name      text := stock_text(p_payload, 'name', 'The name', 160);
  v_category  text := COALESCE(NULLIF(p_payload ->> 'category', ''), 'other');
  v_unit      text := COALESCE(stock_text(p_payload, 'unit', 'The unit', 30), 'each');
  v_nappi     text := NULLIF(upper(regexp_replace(COALESCE(p_payload ->> 'nappi_code', ''), '[\s-]', '', 'g')), '');
  v_barcode   text := stock_text(p_payload, 'barcode', 'The barcode', 40);
  v_tariff    text := upper(stock_text(p_payload, 'tariff_code', 'The billing code', 20));
  v_group     text := stock_text(p_payload, 'item_group', 'The group', 60);
  v_vat       numeric := CASE WHEN jsonb_typeof(p_payload -> 'vat_rate') = 'number' THEN stock_amount(p_payload -> 'vat_rate', 'The VAT rate', 100) END;
  v_price     numeric := CASE WHEN jsonb_typeof(p_payload -> 'selling_price') = 'number' THEN stock_amount(p_payload -> 'selling_price', 'The selling price', 1000000) END;
  v_cost      numeric := COALESCE(CASE WHEN jsonb_typeof(p_payload -> 'unit_cost') = 'number' THEN stock_amount(p_payload -> 'unit_cost', 'The cost price', 1000000) END, 0);
  v_min       integer := CASE WHEN jsonb_typeof(p_payload -> 'reorder_level') = 'number' THEN stock_int(p_payload -> 'reorder_level', 'The minimum', 0, 10000000) END;
  v_max       integer := CASE WHEN jsonb_typeof(p_payload -> 'max_level') = 'number' THEN stock_int(p_payload -> 'max_level', 'The maximum', 0, 10000000) END;
  v_pack      integer := CASE WHEN jsonb_typeof(p_payload -> 'pack_size') = 'number' THEN stock_int(p_payload -> 'pack_size', 'The pack size', 1, 100000) END;
  v_supplier  uuid := NULLIF(p_payload ->> 'preferred_supplier_id', '')::uuid;
  v_supplier_name text;
  v_opening   integer := CASE WHEN jsonb_typeof(p_payload -> 'opening_quantity') = 'number' THEN stock_int(p_payload -> 'opening_quantity', 'The opening quantity', 0, 10000000) ELSE 0 END;
  v_clash     text;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM practice_inventory WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock item not found' USING ERRCODE = 'P0002';
    END IF;
    v_practice := v_existing.practice_id;
  END IF;
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor', 'nurse'], 'add or change stock items');

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Give the item a name' USING ERRCODE = '22023';
  END IF;
  IF v_category NOT IN ('disposables', 'medications', 'office_supplies', 'equipment', 'other') THEN
    RAISE EXCEPTION 'Choose a category' USING ERRCODE = '22023';
  END IF;
  IF v_nappi IS NOT NULL AND v_nappi !~ '^[0-9A-Z]{6,15}$' THEN
    RAISE EXCEPTION 'A NAPPI code is 6 to 15 letters or digits' USING ERRCODE = '22023';
  END IF;
  IF v_tariff IS NOT NULL AND v_tariff !~ '^[A-Z0-9./-]{1,20}$' THEN
    RAISE EXCEPTION 'A billing code is up to 20 letters, digits, dots, dashes or slashes' USING ERRCODE = '22023';
  END IF;
  IF v_max IS NOT NULL AND v_min IS NOT NULL AND v_max < v_min THEN
    RAISE EXCEPTION 'The maximum to hold cannot be below the minimum' USING ERRCODE = '22023';
  END IF;
  IF v_supplier IS NOT NULL THEN
    SELECT s.name INTO v_supplier_name FROM stock_suppliers s WHERE s.id = v_supplier AND s.practice_id = v_practice;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose one of your practice''s suppliers' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- A NAPPI code or barcode names one item (scanning and claims must find one)
  SELECT i.name INTO v_clash FROM practice_inventory i
   WHERE i.practice_id = v_practice AND i.is_active AND i.id IS DISTINCT FROM v_id
     AND ((v_nappi IS NOT NULL AND i.nappi_code = v_nappi) OR (v_barcode IS NOT NULL AND i.barcode = v_barcode))
   LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'Another item (%) already has this NAPPI code or barcode', v_clash USING ERRCODE = '23505';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO practice_inventory (
      practice_id, name, description, category, sku, quantity, unit, reorder_level, unit_cost, total_value, supplier,
      location, notes, nappi_code, barcode, item_group, tariff_code, vat_rate, selling_price, max_level, pack_size,
      preferred_supplier_id, is_scheduled, schedule_label, default_directions, is_active, created_at, updated_at, last_updated
    ) VALUES (
      v_practice, v_name, stock_text(p_payload, 'description', 'The description', 500), v_category,
      stock_text(p_payload, 'sku', 'The product code', 60), 0, v_unit, v_min, v_cost, 0, v_supplier_name,
      stock_text(p_payload, 'location', 'The location', 120), stock_text(p_payload, 'notes', 'The notes', 1000),
      v_nappi, v_barcode, v_group, v_tariff, v_vat, v_price, v_max, v_pack, v_supplier,
      COALESCE((p_payload ->> 'is_scheduled')::boolean, false), stock_text(p_payload, 'schedule_label', 'The schedule', 20),
      stock_text(p_payload, 'default_directions', 'The usual directions', 60), true, now(), now(), now()
    ) RETURNING id INTO v_id;
    IF v_opening > 0 THEN
      INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, batch_no, expiry_date, occurred_on, reason, document_ref)
      VALUES (v_practice, v_id, 'opening', v_opening, round(v_opening * v_cost, 2),
              stock_text(p_payload, 'opening_batch', 'The batch number', 40), NULLIF(p_payload ->> 'opening_expiry', '')::date,
              ar_today(), 'Opening balance when the item was added', 'Opening');
    END IF;
    RETURN jsonb_build_object('id', v_id, 'created', true);
  END IF;

  v_moved := EXISTS (SELECT 1 FROM stock_movements m WHERE m.item_id = v_id);
  IF v_moved AND p_payload ? 'unit_cost' AND v_cost <> COALESCE(v_existing.unit_cost, 0) THEN
    RAISE EXCEPTION 'The cost price now follows the deliveries (the average cost of what is on hand). Record a delivery to change it.' USING ERRCODE = '22023';
  END IF;
  UPDATE practice_inventory
     SET name = v_name,
         description = stock_text(p_payload, 'description', 'The description', 500),
         category = v_category,
         sku = stock_text(p_payload, 'sku', 'The product code', 60),
         unit = v_unit,
         reorder_level = v_min,
         unit_cost = CASE WHEN v_moved THEN unit_cost ELSE v_cost END,
         supplier = v_supplier_name,
         location = stock_text(p_payload, 'location', 'The location', 120),
         notes = stock_text(p_payload, 'notes', 'The notes', 1000),
         nappi_code = v_nappi,
         barcode = v_barcode,
         item_group = v_group,
         tariff_code = v_tariff,
         vat_rate = v_vat,
         selling_price = v_price,
         max_level = v_max,
         pack_size = v_pack,
         preferred_supplier_id = v_supplier,
         is_scheduled = COALESCE((p_payload ->> 'is_scheduled')::boolean, false),
         schedule_label = stock_text(p_payload, 'schedule_label', 'The schedule', 20),
         default_directions = stock_text(p_payload, 'default_directions', 'The usual directions', 60),
         updated_at = now(),
         last_updated = now()
   WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'created', false);
END $$;

-- Stop using an item (kept for its history) or use it again. Admins, doctors and nurses.
CREATE OR REPLACE FUNCTION public.stock_set_item_active(p_item_id uuid, p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT practice_id INTO v_practice FROM practice_inventory WHERE id = p_item_id;
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor', 'nurse'], 'add or change stock items');
  UPDATE practice_inventory SET is_active = COALESCE(p_active, true), updated_at = now() WHERE id = p_item_id;
  RETURN jsonb_build_object('id', p_item_id, 'is_active', COALESCE(p_active, true));
END $$;

-- Delete an item that was never used (no movements, invoice lines, dispensing or counts)
CREATE OR REPLACE FUNCTION public.stock_delete_item(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT practice_id INTO v_practice FROM practice_inventory WHERE id = p_item_id;
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor', 'nurse'], 'add or change stock items');
  IF EXISTS (SELECT 1 FROM stock_movements WHERE item_id = p_item_id)
     OR EXISTS (SELECT 1 FROM invoice_services WHERE stock_item_id = p_item_id)
     OR EXISTS (SELECT 1 FROM stock_dispensings WHERE item_id = p_item_id)
     OR EXISTS (SELECT 1 FROM stock_count_lines WHERE item_id = p_item_id) THEN
    RAISE EXCEPTION 'This item has a history (stock movements, bills or dispensing), so it is kept. Stop using it instead.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM practice_inventory WHERE id = p_item_id;
  RETURN jsonb_build_object('id', p_item_id, 'deleted', true);
END $$;

/*
  stock_save_supplier({"id"?, "practice_id", "name", "contact_name"?, "phone"?, "email"?, "account_number"?,
                       "vat_number"?, "payment_terms_days"?, "notes"?, "is_active"?})  Any staff member.
*/
CREATE OR REPLACE FUNCTION public.stock_save_supplier(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id       uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_name     text := stock_text(p_payload, 'name', 'The supplier''s name', 120);
  v_terms    integer := stock_int(COALESCE(p_payload -> 'payment_terms_days', '30'::jsonb), 'Payment terms (days)', 0, 365);
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT practice_id INTO v_practice FROM stock_suppliers WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  PERFORM stock_assert_role(v_practice, NULL, 'manage suppliers');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Give the supplier a name' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM stock_suppliers s WHERE s.practice_id = v_practice AND lower(btrim(s.name)) = lower(v_name) AND s.id IS DISTINCT FROM v_id) THEN
    RAISE EXCEPTION 'There is already a supplier called %', v_name USING ERRCODE = '23505';
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO stock_suppliers (practice_id, name, contact_name, phone, email, account_number, vat_number, payment_terms_days, notes, created_by, updated_by)
    VALUES (v_practice, v_name, stock_text(p_payload, 'contact_name', 'The contact name', 120), stock_text(p_payload, 'phone', 'The phone number', 40),
            stock_text(p_payload, 'email', 'The email address', 160), stock_text(p_payload, 'account_number', 'The account number', 60),
            stock_text(p_payload, 'vat_number', 'The VAT number', 40), v_terms, stock_text(p_payload, 'notes', 'The notes', 500), auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE stock_suppliers
       SET name = v_name,
           contact_name = stock_text(p_payload, 'contact_name', 'The contact name', 120),
           phone = stock_text(p_payload, 'phone', 'The phone number', 40),
           email = stock_text(p_payload, 'email', 'The email address', 160),
           account_number = stock_text(p_payload, 'account_number', 'The account number', 60),
           vat_number = stock_text(p_payload, 'vat_number', 'The VAT number', 40),
           payment_terms_days = v_terms,
           notes = stock_text(p_payload, 'notes', 'The notes', 500),
           is_active = COALESCE((p_payload ->> 'is_active')::boolean, true),
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 11. Deliveries: receive against a supplier invoice (and create its payable), return to a supplier,
--     reverse a delivery captured by mistake
-- ---------------------------------------------------------------------------------------------
/*
  stock_receive({
    "practice_id", "supplier_id", "supplier_reference" (their invoice number), "document_date"?, "order_id"?,
    "notes"?, "create_payable"? (default true), "expected_total"? (the supplier invoice total incl VAT: must match),
    "lines": [{"item_id", "quantity", "line_cost" (N$ excl VAT for the line), "vat_rate"?, "batch_no"?, "expiry_date"?}]
  })  Any staff member. VAT is worked out per rate on the total of the lines at that rate.
*/
CREATE OR REPLACE FUNCTION public.stock_receive(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier  stock_suppliers%ROWTYPE;
  v_reference text := stock_text(p_payload, 'supplier_reference', 'The supplier invoice number', 60);
  v_date      date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, ar_today());
  v_order     uuid := NULLIF(p_payload ->> 'order_id', '')::uuid;
  v_lines     jsonb := p_payload -> 'lines';
  v_line      jsonb;
  v_index     integer := 0;
  v_item      practice_inventory%ROWTYPE;
  v_default_vat numeric;
  v_excl      numeric := 0;
  v_vat       numeric := 0;
  v_incl      numeric;
  v_expected  numeric;
  v_number    text;
  v_id        uuid;
  v_expense   uuid;
  v_parsed    jsonb := '[]'::jsonb;
  v_qty       integer;
  v_cost      numeric;
  v_rate      numeric;
  v_expiry    date;
BEGIN
  PERFORM stock_assert_role(v_practice, NULL, 'record deliveries');
  SELECT * INTO v_supplier FROM stock_suppliers WHERE id = NULLIF(p_payload ->> 'supplier_id', '')::uuid AND practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the supplier the delivery came from' USING ERRCODE = '22023';
  END IF;
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'Type the supplier''s invoice number, so the delivery can be found on their statement' USING ERRCODE = '22023';
  END IF;
  IF v_date > ar_today() THEN
    RAISE EXCEPTION 'A delivery cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A delivery has 1 to 100 lines' USING ERRCODE = '22023';
  END IF;
  SELECT default_vat_rate INTO v_default_vat FROM stock_settings WHERE practice_id = v_practice;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_index := v_index + 1;
    SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(v_line ->> 'item_id', '')::uuid AND practice_id = v_practice;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: choose one of your practice''s stock items', v_index USING ERRCODE = '22023';
    END IF;
    v_qty := stock_int(v_line -> 'quantity', format('Line %s: the quantity', v_index), 1, 1000000);
    v_cost := stock_amount(v_line -> 'line_cost', format('Line %s: the cost (excl VAT)', v_index), 10000000);
    v_rate := CASE WHEN jsonb_typeof(v_line -> 'vat_rate') = 'number' THEN stock_amount(v_line -> 'vat_rate', format('Line %s: the VAT rate', v_index), 100)
                   ELSE COALESCE(v_item.vat_rate, v_default_vat, 15) END;
    v_expiry := NULLIF(v_line ->> 'expiry_date', '')::date;
    v_parsed := v_parsed || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id, 'quantity', v_qty, 'cost', v_cost, 'rate', v_rate,
      'batch_no', stock_text(v_line, 'batch_no', format('Line %s: the batch number', v_index), 40), 'expiry_date', v_expiry));
    v_excl := v_excl + v_cost;
  END LOOP;

  -- VAT per rate on the total of the lines at that rate, as supplier invoices show it
  SELECT COALESCE(SUM(round(t.cost * t.rate / 100, 2)), 0) INTO v_vat
    FROM (SELECT (l ->> 'rate')::numeric AS rate, SUM((l ->> 'cost')::numeric) AS cost
            FROM jsonb_array_elements(v_parsed) AS l GROUP BY (l ->> 'rate')::numeric) t;
  v_incl := v_excl + v_vat;
  IF jsonb_typeof(p_payload -> 'expected_total') = 'number' THEN
    v_expected := stock_amount(p_payload -> 'expected_total', 'The supplier invoice total', 100000000);
    IF v_expected <> v_incl THEN
      RAISE EXCEPTION 'The lines add up to N$ % including VAT, not the N$ % on the supplier invoice (difference N$ %). Check the quantities and line totals.',
        to_char(v_incl, 'FM999999990.00'), to_char(v_expected, 'FM999999990.00'), to_char(v_expected - v_incl, 'FM999999990.00') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM stock_deliveries d WHERE d.practice_id = v_practice AND d.supplier_id = v_supplier.id AND d.kind = 'received'
                AND lower(btrim(d.supplier_reference)) = lower(v_reference) AND d.reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Supplier invoice % from % is already recorded', v_reference, v_supplier.name USING ERRCODE = '23505';
  END IF;
  IF v_order IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stock_orders o WHERE o.id = v_order AND o.practice_id = v_practice
                                           AND o.supplier_id = v_supplier.id AND o.status = 'ordered') THEN
    RAISE EXCEPTION 'That order is not an open order to this supplier' USING ERRCODE = '22023';
  END IF;

  v_number := stock_next_number(v_practice, 'GRV', v_date);
  -- The supplier's payable (Finance > Ledgers > Expenses; marked paid in Settings > Practice Overhead)
  IF COALESCE((p_payload ->> 'create_payable')::boolean, true) AND v_incl > 0 THEN
    INSERT INTO practice_expenses (practice_id, expense_type, expense_category, name, description, amount, currency, payment_frequency,
                                   vendor_name, vendor_contact, account_number, expense_date, due_date, status, is_recurring, is_active,
                                   created_by, updated_by)
    VALUES (v_practice, 'supplies', 'one_time', left('Stock delivery ' || v_number || ' from ' || v_supplier.name, 255),
            'Supplier invoice ' || v_reference || '. Recorded by Stock > Deliveries (' || v_number || ').',
            v_incl, 'NAD', 'once_off', left(v_supplier.name, 255), left(COALESCE(v_supplier.phone, v_supplier.email), 255),
            left(v_supplier.account_number, 255), v_date, v_date + v_supplier.payment_terms_days, 'pending', false, true,
            auth.uid(), auth.uid())
    RETURNING id INTO v_expense;
  END IF;

  INSERT INTO stock_deliveries (practice_id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount,
                                total_incl_vat, expense_id, order_id, notes, created_by)
  VALUES (v_practice, v_number, 'received', v_supplier.id, v_reference, v_date, v_excl, v_vat, v_incl, v_expense, v_order,
          stock_text(p_payload, 'notes', 'The notes', 500), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, occurred_on, document_ref, delivery_id)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'received', (l ->> 'quantity')::integer, (l ->> 'cost')::numeric,
         round((l ->> 'cost')::numeric * (l ->> 'rate')::numeric / 100, 2), l ->> 'batch_no', NULLIF(l ->> 'expiry_date', '')::date,
         v_date, v_number, v_id
    FROM jsonb_array_elements(v_parsed) AS l;

  IF v_order IS NOT NULL THEN
    UPDATE stock_orders SET status = 'received', status_changed_at = now(), status_changed_by = auth.uid(), received_delivery_id = v_id
     WHERE id = v_order;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'total_incl_vat', v_incl, 'expense_id', v_expense);
END $$;

/*
  stock_return_to_supplier({"practice_id", "supplier_id", "supplier_reference" (their credit note or your return
    note number), "document_date"?, "reason", "lines": [{"item_id", "quantity", "batch_no"?, "expiry_date"?}]})
  Any staff member. Each item once; valued at the average cost; the credit expected from the supplier
  includes VAT. No more than is on hand can go back.
*/
CREATE OR REPLACE FUNCTION public.stock_return_to_supplier(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier  stock_suppliers%ROWTYPE;
  v_reference text := stock_text(p_payload, 'supplier_reference', 'The return or credit note number', 60);
  v_reason    text := stock_text(p_payload, 'reason', 'The reason', 300);
  v_date      date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, ar_today());
  v_lines     jsonb := p_payload -> 'lines';
  v_line      jsonb;
  v_index     integer := 0;
  v_item      practice_inventory%ROWTYPE;
  v_default_vat numeric;
  v_qty       integer;
  v_on_hand   integer;
  v_value     numeric;
  v_rate      numeric;
  v_excl      numeric := 0;
  v_vat       numeric := 0;
  v_parsed    jsonb := '[]'::jsonb;
  v_seen      uuid[] := ARRAY[]::uuid[];
  v_number    text;
  v_id        uuid;
BEGIN
  PERFORM stock_assert_role(v_practice, NULL, 'return stock to a supplier');
  SELECT * INTO v_supplier FROM stock_suppliers WHERE id = NULLIF(p_payload ->> 'supplier_id', '')::uuid AND practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the supplier the stock goes back to' USING ERRCODE = '22023';
  END IF;
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'Type the supplier''s credit note number or your return note number' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Say why the stock goes back (for example "expired" or "damaged in delivery")' USING ERRCODE = '22023';
  END IF;
  IF v_date > ar_today() THEN
    RAISE EXCEPTION 'A return cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A return has 1 to 100 lines' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM stock_deliveries d WHERE d.practice_id = v_practice AND d.supplier_id = v_supplier.id AND d.kind = 'returned'
                AND lower(btrim(d.supplier_reference)) = lower(v_reference) AND d.reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Return % to % is already recorded', v_reference, v_supplier.name USING ERRCODE = '23505';
  END IF;
  SELECT default_vat_rate INTO v_default_vat FROM stock_settings WHERE practice_id = v_practice;

  -- First check and value every line (each item locked, so nothing changes before they are written)
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_index := v_index + 1;
    SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(v_line ->> 'item_id', '')::uuid AND practice_id = v_practice FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: choose one of your practice''s stock items', v_index USING ERRCODE = '22023';
    END IF;
    IF v_item.id = ANY (v_seen) THEN
      RAISE EXCEPTION 'Line %: % is listed twice. Put its whole quantity on one line.', v_index, v_item.name USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || v_item.id;
    v_qty := stock_int(v_line -> 'quantity', format('Line %s: the quantity', v_index), 1, 1000000);
    SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand FROM stock_movements WHERE item_id = v_item.id;
    IF v_qty > v_on_hand THEN
      RAISE EXCEPTION 'Line %: only % % of % are on hand. Count the stock first if that is wrong.', v_index, GREATEST(v_on_hand, 0), v_item.unit, v_item.name USING ERRCODE = '22023';
    END IF;
    v_value := stock_issue_value(v_item.id, v_qty);
    v_rate := COALESCE(v_item.vat_rate, v_default_vat, 15);
    v_parsed := v_parsed || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id, 'quantity', v_qty, 'value', v_value, 'vat', round(v_value * v_rate / 100, 2),
      'batch_no', stock_text(v_line, 'batch_no', format('Line %s: the batch number', v_index), 40),
      'expiry_date', NULLIF(v_line ->> 'expiry_date', '')::date));
    v_excl := v_excl + v_value;
    v_vat := v_vat + round(v_value * v_rate / 100, 2);
  END LOOP;

  v_number := stock_next_number(v_practice, 'RET', v_date);
  INSERT INTO stock_deliveries (practice_id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount,
                                total_incl_vat, reason, notes, created_by)
  VALUES (v_practice, v_number, 'returned', v_supplier.id, v_reference, v_date, v_excl, v_vat, v_excl + v_vat, v_reason,
          stock_text(p_payload, 'notes', 'The notes', 500), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, occurred_on, document_ref, delivery_id, reason)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'returned', -(l ->> 'quantity')::integer, -(l ->> 'value')::numeric, (l ->> 'vat')::numeric,
         l ->> 'batch_no', NULLIF(l ->> 'expiry_date', '')::date, v_date, v_number, v_id, v_reason
    FROM jsonb_array_elements(v_parsed) AS l;
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'credit_expected', v_excl + v_vat);
END $$;

-- Reverse a delivery or return captured by mistake: every line is undone by an opposite movement, and a
-- payable not yet paid is cancelled. Admins and doctors.
CREATE OR REPLACE FUNCTION public.stock_reverse_delivery(p_delivery_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivery stock_deliveries%ROWTYPE;
  v_status   text;
  v_paid     boolean := false;
BEGIN
  SELECT * INTO v_delivery FROM stock_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_delivery.practice_id, ARRAY['admin', 'doctor'], 'reverse a delivery');
  IF v_delivery.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION '% was already reversed', v_delivery.number USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the delivery is reversed (it is kept with it)' USING ERRCODE = '22023';
  END IF;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, occurred_on, document_ref,
                               delivery_id, reverses_id, reason)
  SELECT m.practice_id, m.item_id, 'delivery_reversed', -m.quantity, -m.value, m.vat_amount, m.batch_no, m.expiry_date, ar_today(),
         v_delivery.number, v_delivery.id, m.id, left('Reversed: ' || btrim(p_reason), 300)
    FROM stock_movements m
   WHERE m.delivery_id = v_delivery.id AND m.kind IN ('received', 'returned');

  UPDATE stock_deliveries SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason) WHERE id = v_delivery.id;

  IF v_delivery.expense_id IS NOT NULL THEN
    SELECT lower(COALESCE(status, 'pending')) INTO v_status FROM practice_expenses WHERE id = v_delivery.expense_id;
    IF v_status IN ('pending', 'overdue', 'scheduled') THEN
      UPDATE practice_expenses
         SET status = 'cancelled',
             description = left(COALESCE(description, '') || ' Cancelled: delivery ' || v_delivery.number || ' reversed (' || btrim(p_reason) || ').', 2000),
             updated_by = auth.uid()
       WHERE id = v_delivery.expense_id;
    ELSIF v_status = 'paid' THEN
      v_paid := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('id', v_delivery.id, 'number', v_delivery.number, 'reversed', true, 'payable_already_paid', v_paid);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 12. Adjustments with a reason (broken, expired, lost, used in the practice, samples, found)
-- ---------------------------------------------------------------------------------------------
/*
  stock_adjust({"practice_id", "item_id", "quantity" (+ in, - out), "reason_code", "reason", "occurred_on"?,
                "batch_no"?, "expiry_date"?})  Admins and doctors.
*/
CREATE OR REPLACE FUNCTION public.stock_adjust(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_item     practice_inventory%ROWTYPE;
  v_qty      integer := stock_int(p_payload -> 'quantity', 'The quantity', -1000000, 1000000);
  v_code     text := NULLIF(p_payload ->> 'reason_code', '');
  v_reason   text := stock_text(p_payload, 'reason', 'The reason', 300);
  v_date     date := COALESCE(NULLIF(p_payload ->> 'occurred_on', '')::date, ar_today());
  v_value    numeric;
  v_id       uuid;
BEGIN
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor'], 'adjust stock');
  SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(p_payload ->> 'item_id', '')::uuid AND practice_id = v_practice FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose one of your practice''s stock items' USING ERRCODE = '22023';
  END IF;
  IF v_qty = 0 THEN
    RAISE EXCEPTION 'An adjustment adds or takes off at least one unit' USING ERRCODE = '22023';
  END IF;
  IF v_code IS NULL OR v_code NOT IN ('damaged', 'expired', 'lost', 'used_in_practice', 'sample', 'found', 'correction', 'other') THEN
    RAISE EXCEPTION 'Choose a reason' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Describe what happened (it is kept with the adjustment)' USING ERRCODE = '22023';
  END IF;
  IF v_date > ar_today() THEN
    RAISE EXCEPTION 'An adjustment cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  v_value := CASE WHEN v_qty < 0 THEN -stock_issue_value(v_item.id, -v_qty) ELSE stock_gain_value(v_item.id, v_qty) END;
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, batch_no, expiry_date, reason_code, reason, occurred_on, document_ref)
  VALUES (v_practice, v_item.id, 'adjusted', v_qty, v_value, stock_text(p_payload, 'batch_no', 'The batch number', 40),
          NULLIF(p_payload ->> 'expiry_date', '')::date, v_code, v_reason, v_date, 'Adjustment')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'value', v_value);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 13. Stock takes: start, count (each count keeps what the ledger expected at that moment), post the
--     differences, or cancel
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_start_count(p_practice_id uuid, p_item_group text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number text;
  v_id     uuid;
BEGIN
  PERFORM stock_assert_role(p_practice_id, NULL, 'count stock');
  IF EXISTS (SELECT 1 FROM stock_counts WHERE practice_id = p_practice_id AND status = 'counting') THEN
    RAISE EXCEPTION 'A stock count is already open. Finish or cancel it first.' USING ERRCODE = '23505';
  END IF;
  v_number := stock_next_number(p_practice_id, 'CNT', ar_today());
  INSERT INTO stock_counts (practice_id, number, item_group, note, started_by)
  VALUES (p_practice_id, v_number, NULLIF(btrim(COALESCE(p_item_group, '')), ''), left(NULLIF(btrim(COALESCE(p_note, '')), ''), 300), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END $$;

-- p_lines: [{"item_id", "counted"}] ("counted": null takes an item off the count). Any staff member.
CREATE OR REPLACE FUNCTION public.stock_record_counts(p_count_id uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count   stock_counts%ROWTYPE;
  v_line    jsonb;
  v_item    practice_inventory%ROWTYPE;
  v_on_hand integer;
  v_saved   integer := 0;
BEGIN
  SELECT * INTO v_count FROM stock_counts WHERE id = p_count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock count not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_count.practice_id, NULL, 'count stock');
  IF v_count.status <> 'counting' THEN
    RAISE EXCEPTION 'Stock count % is closed', v_count.number USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) > 2000 THEN
    RAISE EXCEPTION 'Send the counts as a list (at most 2000 at a time)' USING ERRCODE = '22023';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(v_line ->> 'item_id', '')::uuid AND practice_id = v_count.practice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A counted item is not one of your practice''s stock items' USING ERRCODE = '22023';
    END IF;
    IF v_count.item_group IS NOT NULL AND v_item.item_group IS DISTINCT FROM v_count.item_group THEN
      RAISE EXCEPTION '% is not in the group being counted (%)', v_item.name, v_count.item_group USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_line -> 'counted') IS DISTINCT FROM 'number' THEN
      DELETE FROM stock_count_lines WHERE count_id = p_count_id AND item_id = v_item.id;
    ELSE
      SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand FROM stock_movements WHERE item_id = v_item.id;
      INSERT INTO stock_count_lines (count_id, practice_id, item_id, expected, counted, counted_by, counted_at)
      VALUES (p_count_id, v_count.practice_id, v_item.id, v_on_hand,
              stock_int(v_line -> 'counted', format('The count of %s', v_item.name), 0, 10000000), auth.uid(), now())
      ON CONFLICT (count_id, item_id) DO UPDATE
        SET expected = EXCLUDED.expected, counted = EXCLUDED.counted, counted_by = EXCLUDED.counted_by, counted_at = now();
    END IF;
    v_saved := v_saved + 1;
  END LOOP;
  RETURN jsonb_build_object('id', p_count_id, 'saved', v_saved);
END $$;

-- Post a count: each counted item whose count differs from what was expected gets a 'counted' movement for
-- the difference, valued at the average cost. Admins and doctors.
CREATE OR REPLACE FUNCTION public.stock_post_count(p_count_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count   stock_counts%ROWTYPE;
  v_line    stock_count_lines%ROWTYPE;
  v_diff    integer;
  v_value   numeric;
  v_total   numeric := 0;
  v_changed integer := 0;
  v_lines   integer := 0;
BEGIN
  SELECT * INTO v_count FROM stock_counts WHERE id = p_count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock count not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_count.practice_id, ARRAY['admin', 'doctor'], 'post a stock count');
  IF v_count.status <> 'counting' THEN
    RAISE EXCEPTION 'Stock count % is already %', v_count.number, v_count.status USING ERRCODE = '23514';
  END IF;
  FOR v_line IN SELECT * FROM stock_count_lines WHERE count_id = p_count_id ORDER BY item_id LOOP
    v_lines := v_lines + 1;
    v_diff := v_line.counted - v_line.expected;
    CONTINUE WHEN v_diff = 0;
    PERFORM 1 FROM practice_inventory WHERE id = v_line.item_id FOR UPDATE;
    v_value := CASE WHEN v_diff < 0 THEN -stock_issue_value(v_line.item_id, -v_diff) ELSE stock_gain_value(v_line.item_id, v_diff) END;
    INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, count_id, reason)
    VALUES (v_count.practice_id, v_line.item_id, 'counted', v_diff, v_value, ar_today(), v_count.number, v_count.id,
            format('Counted %s, expected %s', v_line.counted, v_line.expected));
    v_total := v_total + v_value;
    v_changed := v_changed + 1;
  END LOOP;
  IF v_lines = 0 THEN
    RAISE EXCEPTION 'Nothing has been counted yet' USING ERRCODE = '22023';
  END IF;
  UPDATE stock_counts SET status = 'posted', closed_at = now(), closed_by = auth.uid(), value_change = v_total WHERE id = p_count_id;
  RETURN jsonb_build_object('id', p_count_id, 'number', v_count.number, 'lines', v_lines, 'changed', v_changed, 'value_change', v_total);
END $$;

CREATE OR REPLACE FUNCTION public.stock_cancel_count(p_count_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count stock_counts%ROWTYPE;
BEGIN
  SELECT * INTO v_count FROM stock_counts WHERE id = p_count_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock count not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_count.practice_id, NULL, 'cancel a stock count');
  IF v_count.status <> 'counting' THEN
    RAISE EXCEPTION 'Stock count % is already %', v_count.number, v_count.status USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the count is cancelled' USING ERRCODE = '22023';
  END IF;
  UPDATE stock_counts SET status = 'cancelled', closed_at = now(), closed_by = auth.uid(), cancel_reason = btrim(p_reason) WHERE id = p_count_id;
  RETURN jsonb_build_object('id', p_count_id, 'cancelled', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 14. Invoices: a line that names a stock item takes it off stock; removing the line, cancelling the
--     invoice or crediting it in full puts it back
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.invoice_services
  ADD COLUMN IF NOT EXISTS stock_item_id uuid,
  ADD COLUMN IF NOT EXISTS nappi_code text;
COMMENT ON COLUMN public.invoice_services.stock_item_id IS
  'The stock item the line bills (practice_inventory.id), set from tariff_id by a trigger. The line moves the stock (stock_movements.invoice_line_id).';
COMMENT ON COLUMN public.invoice_services.nappi_code IS 'The NAPPI code of a medicine line, copied from the stock item when the line was saved (claim field 26).';
CREATE INDEX IF NOT EXISTS invoice_services_stock_item_idx ON public.invoice_services (stock_item_id) WHERE stock_item_id IS NOT NULL;

-- Fills stock_item_id and nappi_code when the line's tariff_id is a stock item of the invoice's practice.
-- On an update that keeps the tariff_id the stored values stay (a later NAPPI change does not rewrite history).
CREATE OR REPLACE FUNCTION public.stock_link_invoice_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tariff_id IS NOT DISTINCT FROM OLD.tariff_id AND NEW.invoice_id IS NOT DISTINCT FROM OLD.invoice_id THEN
    NEW.stock_item_id := OLD.stock_item_id;
    NEW.nappi_code := OLD.nappi_code;
    RETURN NEW;
  END IF;
  NEW.stock_item_id := NULL;
  NEW.nappi_code := NULL;
  IF NEW.tariff_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT i.id, i.nappi_code, i.practice_id INTO v_item FROM practice_inventory i WHERE i.id = NEW.tariff_id;
  IF FOUND AND EXISTS (SELECT 1 FROM invoices_enhanced e WHERE e.id = NEW.invoice_id AND e.practice_id = v_item.practice_id) THEN
    NEW.stock_item_id := v_item.id;
    NEW.nappi_code := v_item.nappi_code;
  END IF;
  RETURN NEW;
END $$;

-- True when the standing credit notes of an invoice add up to its whole total
CREATE OR REPLACE FUNCTION public.stock_invoice_fully_credited(p_invoice_id uuid, p_total numeric)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(COALESCE(p_total, 0), 2) > 0
     AND COALESCE((SELECT SUM(a.amount) FROM invoice_adjustments a
                    WHERE a.invoice_id = p_invoice_id AND a.kind = 'credit_note' AND a.reversed_at IS NULL), 0) >= round(COALESCE(p_total, 0), 2)
$$;

-- Brings one invoice line's stock movements in line with what it should have issued: its quantity of
-- its item while the line exists and the invoice stands (not cancelled, not credited in full), else
-- nothing. Writes only the difference. Returns how many movements it wrote.
CREATE OR REPLACE FUNCTION public.stock_sync_invoice_line(p_line_id uuid, p_invoice_id uuid, p_reason text DEFAULT NULL, p_credit_note_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line_item  uuid;
  v_line_qty   integer;
  v_invoice    record;
  v_active     boolean;
  v_item       uuid;
  v_want       integer;
  v_have       integer;
  v_have_value numeric;
  v_practice   uuid;
  v_value      numeric;
  v_patient    uuid;
  v_ref        text;
  v_written    integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('stock_line:' || p_line_id::text));
  SELECT s.stock_item_id, COALESCE(s.quantity, 1) INTO v_line_item, v_line_qty FROM invoice_services s WHERE s.id = p_line_id;
  SELECT e.id, e.patient_id, e.practitioner_id, e.invoice_number, e.payment_status, e.total INTO v_invoice
    FROM invoices_enhanced e WHERE e.id = p_invoice_id;
  v_active := v_invoice.id IS NOT NULL AND v_line_item IS NOT NULL
              AND NOT ar_is_cancelled(v_invoice.payment_status)
              AND NOT stock_invoice_fully_credited(p_invoice_id, v_invoice.total);
  SELECT m.patient_id, m.document_ref INTO v_patient, v_ref FROM stock_movements m WHERE m.invoice_line_id = p_line_id LIMIT 1;
  v_patient := COALESCE(v_invoice.patient_id, v_patient);
  v_ref := COALESCE(v_invoice.invoice_number, v_ref, 'Invoice');

  FOR v_item IN
    SELECT DISTINCT m.item_id FROM stock_movements m WHERE m.invoice_line_id = p_line_id
    UNION
    SELECT v_line_item WHERE v_line_item IS NOT NULL
  LOOP
    v_want := CASE WHEN v_active AND v_item = v_line_item THEN GREATEST(v_line_qty, 0) ELSE 0 END;
    SELECT i.practice_id INTO v_practice FROM practice_inventory i WHERE i.id = v_item FOR UPDATE;
    SELECT COALESCE(-SUM(m.quantity), 0), COALESCE(-SUM(m.value), 0) INTO v_have, v_have_value
      FROM stock_movements m WHERE m.invoice_line_id = p_line_id AND m.item_id = v_item;
    CONTINUE WHEN v_want = v_have;
    IF v_want > v_have THEN
      v_value := stock_issue_value(v_item, v_want - v_have);
      INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, invoice_id, invoice_line_id,
                                   credit_note_id, patient_id, practitioner_id, reason)
      VALUES (v_practice, v_item, 'sold', -(v_want - v_have), -v_value, ar_today(), v_ref, p_invoice_id, p_line_id,
              p_credit_note_id, v_patient, v_invoice.practitioner_id, CASE WHEN v_have > 0 OR p_credit_note_id IS NOT NULL THEN p_reason END);
    ELSE
      v_value := CASE WHEN v_have > 0 THEN round(v_have_value * (v_have - v_want) / v_have, 2) ELSE 0 END;
      INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, invoice_id, invoice_line_id,
                                   credit_note_id, patient_id, practitioner_id, reason)
      VALUES (v_practice, v_item, 'sale_reversed', v_have - v_want, v_value, ar_today(), v_ref, p_invoice_id, p_line_id,
              p_credit_note_id, v_patient, v_invoice.practitioner_id, COALESCE(p_reason, 'Invoice line removed or changed'));
    END IF;
    v_written := v_written + 1;
  END LOOP;
  RETURN v_written;
END $$;

CREATE OR REPLACE FUNCTION public.stock_sync_invoice(p_invoice_id uuid, p_reason text, p_credit_note_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line    uuid;
  v_written integer := 0;
BEGIN
  FOR v_line IN
    SELECT s.id FROM invoice_services s WHERE s.invoice_id = p_invoice_id AND s.stock_item_id IS NOT NULL
    UNION
    SELECT DISTINCT m.invoice_line_id FROM stock_movements m
     WHERE m.invoice_id = p_invoice_id AND EXISTS (SELECT 1 FROM invoice_services s WHERE s.id = m.invoice_line_id)
  LOOP
    v_written := v_written + stock_sync_invoice_line(v_line, p_invoice_id, p_reason, p_credit_note_id);
  END LOOP;
  RETURN v_written;
END $$;

CREATE OR REPLACE FUNCTION public.stock_invoice_line_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stock_item_id IS NOT NULL THEN
      PERFORM stock_sync_invoice_line(OLD.id, OLD.invoice_id, 'Invoice line removed');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.stock_item_id IS NOT NULL OR (TG_OP = 'UPDATE' AND OLD.stock_item_id IS NOT NULL) THEN
    PERFORM stock_sync_invoice_line(NEW.id, NEW.invoice_id);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.stock_invoice_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM stock_sync_invoice(NEW.id, CASE WHEN ar_is_cancelled(NEW.payment_status) THEN 'Invoice cancelled' ELSE 'Invoice no longer cancelled' END);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.stock_credit_note_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM stock_sync_invoice(NEW.invoice_id,
    CASE WHEN NEW.reversed_at IS NULL THEN 'Credited by credit note ' || NEW.adjustment_number
         ELSE 'Credit note ' || NEW.adjustment_number || ' reversed' END,
    NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS stock_10_link_item ON public.invoice_services;
CREATE TRIGGER stock_10_link_item BEFORE INSERT OR UPDATE ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.stock_link_invoice_line();
DROP TRIGGER IF EXISTS zz_stock_sync_line ON public.invoice_services;
CREATE TRIGGER zz_stock_sync_line AFTER INSERT OR UPDATE OR DELETE ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.stock_invoice_line_changed();
DROP TRIGGER IF EXISTS zz_stock_invoice_status ON public.invoices_enhanced;
CREATE TRIGGER zz_stock_invoice_status AFTER UPDATE OF payment_status ON public.invoices_enhanced
  FOR EACH ROW WHEN (public.ar_is_cancelled(OLD.payment_status) IS DISTINCT FROM public.ar_is_cancelled(NEW.payment_status))
  EXECUTE FUNCTION public.stock_invoice_status_changed();
DROP TRIGGER IF EXISTS zz_stock_credit_note ON public.invoice_adjustments;
CREATE TRIGGER zz_stock_credit_note AFTER INSERT OR UPDATE OF reversed_at ON public.invoice_adjustments
  FOR EACH ROW WHEN (NEW.kind = 'credit_note' AND NEW.invoice_id IS NOT NULL)
  EXECUTE FUNCTION public.stock_credit_note_changed();

-- ---------------------------------------------------------------------------------------------
-- 15. Dispensing
-- ---------------------------------------------------------------------------------------------
/*
  stock_dispense({
    "practice_id", "patient_id", "visit_id"?, "item_id", "quantity", "directions" (label text),
    "directions_code"?, "days_supply"?, "repeats_allowed"?, "is_chronic"?, "repeat_of"? (a repeat of that
    script), "prescriber_id"?, "prescribed_as"?, "bill" (true: the line goes on the visit's bill and the
    invoice moves the stock; false: given without billing, taken off stock here), "unit_price"?
  })  Admins, doctors and nurses, in a practice that dispenses.
*/
CREATE OR REPLACE FUNCTION public.stock_dispense(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_patient   uuid := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  v_visit     uuid := NULLIF(p_payload ->> 'visit_id', '')::uuid;
  v_repeat_of uuid := NULLIF(p_payload ->> 'repeat_of', '')::uuid;
  v_item      practice_inventory%ROWTYPE;
  v_settings  stock_settings%ROWTYPE;
  v_original  stock_dispensings%ROWTYPE;
  v_qty       integer := stock_int(p_payload -> 'quantity', 'The quantity', 1, 100000);
  v_days      integer := CASE WHEN jsonb_typeof(p_payload -> 'days_supply') = 'number' THEN stock_int(p_payload -> 'days_supply', 'Days of medicine', 1, 366) END;
  v_repeats   integer := CASE WHEN jsonb_typeof(p_payload -> 'repeats_allowed') = 'number' THEN stock_int(p_payload -> 'repeats_allowed', 'Repeats', 0, 12) ELSE 0 END;
  v_bill      boolean := COALESCE((p_payload ->> 'bill')::boolean, true);
  v_directions text := stock_text(p_payload, 'directions', 'The directions', 300);
  v_price     numeric := CASE WHEN jsonb_typeof(p_payload -> 'unit_price') = 'number' THEN stock_amount(p_payload -> 'unit_price', 'The price', 1000000) END;
  v_prescriber uuid := NULLIF(p_payload ->> 'prescriber_id', '')::uuid;
  v_today     date := ar_today();
  v_number    text;
  v_id        uuid;
  v_value     numeric;
  v_on_hand   integer;
BEGIN
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor', 'nurse'], 'dispense medicine');
  SELECT * INTO v_settings FROM stock_settings WHERE practice_id = v_practice;
  IF NOT FOUND OR NOT v_settings.dispensing_enabled THEN
    RAISE EXCEPTION 'Dispensing is switched off for this practice (Stock > Settings)' USING ERRCODE = '22023';
  END IF;
  PERFORM stock_assert_patient(v_practice, v_patient);
  IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.id = v_visit AND v.patient_id = v_patient) THEN
    RAISE EXCEPTION 'That visit is not this patient''s' USING ERRCODE = '22023';
  END IF;
  IF v_bill AND v_visit IS NULL THEN
    RAISE EXCEPTION 'Billed medicine goes on a visit''s bill: dispense it from the visit' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(p_payload ->> 'item_id', '')::uuid AND practice_id = v_practice FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose one of your practice''s stock items' USING ERRCODE = '22023';
  END IF;
  IF NOT v_item.is_active THEN
    RAISE EXCEPTION '% is no longer used', v_item.name USING ERRCODE = '22023';
  END IF;
  IF v_directions IS NULL THEN
    RAISE EXCEPTION 'Write the directions for the label' USING ERRCODE = '22023';
  END IF;
  IF v_prescriber IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = v_prescriber AND u.practice_id = v_practice) THEN
    RAISE EXCEPTION 'The prescriber is not a member of your practice' USING ERRCODE = '22023';
  END IF;

  IF v_repeat_of IS NOT NULL THEN
    SELECT * INTO v_original FROM stock_dispensings WHERE id = v_repeat_of AND practice_id = v_practice FOR UPDATE;
    IF NOT FOUND OR v_original.patient_id <> v_patient OR v_original.repeat_of IS NOT NULL THEN
      RAISE EXCEPTION 'That is not one of this patient''s scripts' USING ERRCODE = '22023';
    END IF;
    IF v_original.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'That script was cancelled' USING ERRCODE = '22023';
    END IF;
    IF v_original.valid_until IS NOT NULL AND v_original.valid_until < v_today THEN
      RAISE EXCEPTION 'The repeats of that script ran out on %: a new script is needed', to_char(v_original.valid_until, 'FMDD Mon YYYY') USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM stock_dispensings r WHERE r.repeat_of = v_original.id AND r.cancelled_at IS NULL) >= v_original.repeats_allowed THEN
      RAISE EXCEPTION 'All repeats of that script have been dispensed: a new script is needed' USING ERRCODE = '22023';
    END IF;
    v_repeats := 0;
  END IF;

  v_number := stock_next_number(v_practice, 'RX', v_today);
  INSERT INTO stock_dispensings (practice_id, number, patient_id, visit_id, item_id, quantity, prescribed_as, directions_code, directions,
                                 days_supply, repeats_allowed, repeat_of, is_chronic, valid_until, prescriber_id, billed, unit_price,
                                 dispensed_on, dispensed_by)
  VALUES (v_practice, v_number, v_patient, v_visit, v_item.id, v_qty, stock_text(p_payload, 'prescribed_as', 'The prescription', 300),
          stock_text(p_payload, 'directions_code', 'The directions code', 60), v_directions, v_days, v_repeats, v_repeat_of,
          COALESCE((p_payload ->> 'is_chronic')::boolean, v_original.is_chronic, false),
          CASE WHEN v_repeat_of IS NULL AND v_repeats > 0 THEN (v_today + make_interval(months => v_settings.script_valid_months))::date END,
          COALESCE(v_prescriber, auth.uid()), v_bill, v_price, v_today, auth.uid())
  RETURNING id INTO v_id;

  IF NOT v_bill THEN
    v_value := stock_issue_value(v_item.id, v_qty);
    INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, dispensing_id, patient_id, practitioner_id, reason)
    VALUES (v_practice, v_item.id, 'dispensed', -v_qty, -v_value, v_today, v_number, v_id, v_patient, COALESCE(v_prescriber, auth.uid()),
            'Dispensed without billing');
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand FROM stock_movements WHERE item_id = v_item.id;
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'on_hand', v_on_hand, 'billed', v_bill);
END $$;

-- Cancel a dispensing record. Given without billing: the stock comes back. Billed: the visit's invoice
-- line holds the stock; remove the line from the visit's bill (or credit the invoice) as well.
CREATE OR REPLACE FUNCTION public.stock_cancel_dispensing(p_dispensing_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row stock_dispensings%ROWTYPE;
  v_moved integer;
  v_value numeric;
BEGIN
  SELECT * INTO v_row FROM stock_dispensings WHERE id = p_dispensing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispensing record not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_row.practice_id, ARRAY['admin', 'doctor', 'nurse'], 'cancel a dispensing record');
  IF v_row.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION '% was already cancelled', v_row.number USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why it is cancelled (it is kept with the record)' USING ERRCODE = '22023';
  END IF;
  UPDATE stock_dispensings SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason) WHERE id = v_row.id;
  SELECT COALESCE(-SUM(quantity), 0), COALESCE(-SUM(value), 0) INTO v_moved, v_value FROM stock_movements WHERE dispensing_id = v_row.id;
  IF v_moved > 0 THEN
    INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, dispensing_id, patient_id, reason)
    VALUES (v_row.practice_id, v_row.item_id, 'dispense_reversed', v_moved, v_value, ar_today(), v_row.number, v_row.id, v_row.patient_id,
            left('Cancelled: ' || btrim(p_reason), 300));
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'number', v_row.number, 'cancelled', true, 'stock_returned', v_moved, 'billed', v_row.billed);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 16. Supplier orders
-- ---------------------------------------------------------------------------------------------
/*
  stock_save_order({"practice_id", "supplier_id", "ordered_on"?, "notes"?,
                    "lines": [{"item_id", "quantity", "unit_cost"? (estimate, N$ excl VAT)}]})  Any staff member.
*/
CREATE OR REPLACE FUNCTION public.stock_save_order(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier uuid := NULLIF(p_payload ->> 'supplier_id', '')::uuid;
  v_date     date := COALESCE(NULLIF(p_payload ->> 'ordered_on', '')::date, ar_today());
  v_lines    jsonb := p_payload -> 'lines';
  v_line     jsonb;
  v_index    integer := 0;
  v_item     practice_inventory%ROWTYPE;
  v_clean    jsonb := '[]'::jsonb;
  v_number   text;
  v_id       uuid;
BEGIN
  PERFORM stock_assert_role(v_practice, NULL, 'order stock');
  IF NOT EXISTS (SELECT 1 FROM stock_suppliers s WHERE s.id = v_supplier AND s.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose the supplier to order from' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'An order has 1 to 200 lines' USING ERRCODE = '22023';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_index := v_index + 1;
    SELECT * INTO v_item FROM practice_inventory WHERE id = NULLIF(v_line ->> 'item_id', '')::uuid AND practice_id = v_practice;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: choose one of your practice''s stock items', v_index USING ERRCODE = '22023';
    END IF;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id, 'name', v_item.name, 'unit', v_item.unit, 'nappi_code', v_item.nappi_code,
      'quantity', stock_int(v_line -> 'quantity', format('Line %s: the quantity', v_index), 1, 1000000),
      'unit_cost', CASE WHEN jsonb_typeof(v_line -> 'unit_cost') = 'number' THEN (v_line ->> 'unit_cost')::numeric ELSE v_item.unit_cost END));
  END LOOP;
  v_number := stock_next_number(v_practice, 'ORD', v_date);
  INSERT INTO stock_orders (practice_id, number, supplier_id, ordered_on, lines, notes, created_by)
  VALUES (v_practice, v_number, v_supplier, v_date, v_clean, stock_text(p_payload, 'notes', 'The notes', 500), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END $$;

CREATE OR REPLACE FUNCTION public.stock_cancel_order(p_order_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order stock_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM stock_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_order.practice_id, NULL, 'cancel an order');
  IF v_order.status <> 'ordered' THEN
    RAISE EXCEPTION 'Order % is already %', v_order.number, v_order.status USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the order is cancelled' USING ERRCODE = '22023';
  END IF;
  UPDATE stock_orders SET status = 'cancelled', status_changed_at = now(), status_changed_by = auth.uid(), cancel_reason = btrim(p_reason)
   WHERE id = p_order_id;
  RETURN jsonb_build_object('id', p_order_id, 'cancelled', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 17. Stock valuations kept as they were: at every month-end close, or taken by hand
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_valuations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  as_at           date NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('month_end', 'manual')),
  period_close_id uuid REFERENCES public.period_closes(id) ON DELETE SET NULL,
  total_value     numeric(14,2) NOT NULL,
  item_count      integer NOT NULL CHECK (item_count >= 0),
  -- [{"item_id", "name", "unit", "on_hand", "value"}] as at the day
  lines           jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  taken_by        uuid,
  taken_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_valuations_practice_idx ON public.stock_valuations (practice_id, as_at DESC);
COMMENT ON TABLE public.stock_valuations IS 'Stock valuations at cost (excl VAT) as they were on a day: at each month-end close, or taken by hand. Never changed.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_valuations;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_valuations
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('', 'period_close_id');

-- The stock on hand and its value at the end of a day, from the ledger (the lock keeps closed months fixed)
CREATE OR REPLACE FUNCTION public.stock_valuation_on(p_practice_id uuid, p_as_at date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'lines', COALESCE(jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name, 'unit', i.unit, 'on_hand', l.on_hand, 'value', l.value)
                                ORDER BY lower(i.name)), '[]'::jsonb),
    'total', COALESCE(SUM(l.value), 0),
    'count', count(*))
  FROM (SELECT m.item_id, SUM(m.quantity)::integer AS on_hand, SUM(m.value) AS value
          FROM stock_movements m
         WHERE m.practice_id = p_practice_id AND m.occurred_on <= p_as_at
         GROUP BY m.item_id
        HAVING SUM(m.quantity) <> 0 OR SUM(m.value) <> 0) l
  JOIN practice_inventory i ON i.id = l.item_id
$$;

-- Take a valuation by hand. Admins and doctors.
CREATE OR REPLACE FUNCTION public.stock_take_valuation(p_practice_id uuid, p_as_at date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_as_at date := COALESCE(p_as_at, ar_today());
  v_val   jsonb;
  v_id    uuid;
BEGIN
  PERFORM stock_assert_role(p_practice_id, ARRAY['admin', 'doctor'], 'keep a stock valuation');
  IF v_as_at > ar_today() THEN
    RAISE EXCEPTION 'A valuation is of a day that has happened' USING ERRCODE = '22023';
  END IF;
  v_val := stock_valuation_on(p_practice_id, v_as_at);
  INSERT INTO stock_valuations (practice_id, as_at, kind, total_value, item_count, lines, taken_by)
  VALUES (p_practice_id, v_as_at, 'manual', (v_val ->> 'total')::numeric, (v_val ->> 'count')::integer, v_val -> 'lines', auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'total_value', (v_val ->> 'total')::numeric);
END $$;

-- Closing a month (Finance > Reports > Month end) keeps the stock valuation at its last day. A problem
-- here never stops the close: it is logged (WARNING) and the Stock page shows the month without one.
CREATE OR REPLACE FUNCTION public.stock_month_end_valuation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_as_at date := (NEW.period_month + interval '1 month' - interval '1 day')::date;
  v_val   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.practice_id = NEW.practice_id) THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_val := stock_valuation_on(NEW.practice_id, v_as_at);
    INSERT INTO stock_valuations (practice_id, as_at, kind, period_close_id, total_value, item_count, lines, taken_by)
    VALUES (NEW.practice_id, v_as_at, 'month_end', NEW.id, (v_val ->> 'total')::numeric, (v_val ->> 'count')::integer, v_val -> 'lines', auth.uid());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'The month-end stock valuation of % was not kept: %', v_as_at, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_stock_month_end ON public.period_closes;
CREATE TRIGGER zz_stock_month_end AFTER INSERT ON public.period_closes
  FOR EACH ROW EXECUTE FUNCTION public.stock_month_end_valuation();

-- ---------------------------------------------------------------------------------------------
-- 18. Patient lists: patient_list_facts() also returns next_repeat_due_on (the earliest day a repeat
--     of a standing script falls due) for the "Repeat medicine due" list. The body is the 2026-10-07
--     definition (proposals/2026-10-07-patient-lists.sql) plus the "repeat_due" part; the rule itself
--     is in src/utils/patientLists/listRules.ts. Recreated because the columns it returns change.
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.patient_list_facts(uuid, date, uuid[]);
CREATE OR REPLACE FUNCTION public.patient_list_facts(
  p_practice_id uuid,
  p_today date,
  p_patient_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  patient_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  cell_number text,
  sms_opt_out boolean,
  last_completed_visit_on date,
  last_completed_by_type jsonb,
  last_billed_by_code jsonb,
  completed_visits_12m integer,
  next_booking_on date,
  next_booking_time text,
  last_no_show_on date,
  balance_due numeric,
  oldest_unpaid_on date,
  next_repeat_due_on date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.patient_lists_can_access(p_practice_id) THEN
    RAISE EXCEPTION 'Not allowed to read this practice''s patients' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL THEN
    RAISE EXCEPTION 'p_today (the practice''s local date) is required' USING ERRCODE = '22004';
  END IF;

  RETURN QUERY
  WITH pts AS (
    SELECT p.id AS pid,
           p.first_name::text AS first_name,
           p.last_name::text AS last_name,
           p.date_of_birth::date AS date_of_birth,
           p.cell_number::text AS cell_number,
           COALESCE((to_jsonb(p) ->> 'sms_opt_out')::boolean, false) AS sms_opt_out
    FROM public.patients p
    WHERE p.practice_id = p_practice_id
      AND (p_patient_ids IS NULL OR p.id = ANY (p_patient_ids))
  ),
  vis AS (
    SELECT v.patient_id AS pid,
           lower(btrim(COALESCE(v.visit_type, ''))) AS visit_type,
           lower(btrim(COALESCE(v.status, ''))) AS status,
           COALESCE(v.is_cancelled, false) AS is_cancelled,
           COALESCE(v.visit_date, v.scheduled_date)::date AS happened_on,
           COALESCE(v.scheduled_date, v.visit_date)::date AS booked_on,
           COALESCE(v.scheduled_time::text, v.visit_time::text) AS booked_time
    FROM public.visits v
    JOIN pts ON pts.pid = v.patient_id
  ),
  visit_facts AS (
    SELECT vis.pid,
           MAX(vis.happened_on) FILTER (WHERE vis.status = 'completed' AND NOT vis.is_cancelled) AS last_completed_visit_on,
           (COUNT(*) FILTER (
              WHERE vis.status = 'completed' AND NOT vis.is_cancelled
                AND vis.happened_on > (p_today - INTERVAL '12 months')::date
                AND vis.happened_on <= p_today
           ))::integer AS completed_visits_12m,
           MAX(vis.booked_on) FILTER (
             WHERE vis.status IN ('no-show', 'no_show') AND NOT vis.is_cancelled AND vis.booked_on <= p_today
           ) AS last_no_show_on,
           MIN(vis.booked_on) FILTER (
             WHERE vis.booked_on >= p_today AND NOT vis.is_cancelled
               AND vis.status NOT IN ('cancelled', 'no-show', 'no_show', 'completed')
           ) AS next_booking_on
    FROM vis
    GROUP BY vis.pid
  ),
  by_type AS (
    SELECT t.pid, jsonb_object_agg(t.visit_type, t.last_on) AS last_completed_by_type
    FROM (
      SELECT vis.pid, vis.visit_type, MAX(vis.happened_on) AS last_on
      FROM vis
      WHERE vis.status = 'completed' AND NOT vis.is_cancelled
        AND vis.visit_type <> '' AND vis.happened_on IS NOT NULL
      GROUP BY vis.pid, vis.visit_type
    ) t
    GROUP BY t.pid
  ),
  -- Last date each tariff code was billed (recall by treatment, e.g. 8159 scale and polish): the visit's date,
  -- else the invoice date; cancelled invoices do not count
  billed AS (
    SELECT ie.patient_id AS pid,
           btrim(s.code) AS code,
           COALESCE(v.visit_date::date, ie.issue_date, (ie.created_at AT TIME ZONE 'Africa/Windhoek')::date) AS served_on
    FROM public.invoice_services s
    JOIN public.invoices_enhanced ie ON ie.id = s.invoice_id
    JOIN pts ON pts.pid = ie.patient_id
    LEFT JOIN public.visits v ON v.id = ie.visit_id
    WHERE COALESCE(NULLIF(lower(btrim(ie.payment_status)), ''), 'pending') <> 'cancelled'
      AND btrim(COALESCE(s.code, '')) <> ''
  ),
  by_code AS (
    SELECT c.pid, jsonb_object_agg(c.code, c.last_on) AS last_billed_by_code
    FROM (
      SELECT billed.pid, billed.code, MAX(billed.served_on) AS last_on
      FROM billed
      WHERE billed.served_on IS NOT NULL AND billed.served_on <= p_today
      GROUP BY billed.pid, billed.code
    ) c
    GROUP BY c.pid
  ),
  next_time AS (
    SELECT DISTINCT ON (vis.pid) vis.pid, vis.booked_time
    FROM vis
    JOIN visit_facts vf ON vf.pid = vis.pid AND vis.booked_on = vf.next_booking_on
    WHERE NOT vis.is_cancelled AND vis.status NOT IN ('cancelled', 'no-show', 'no_show', 'completed')
    ORDER BY vis.pid, vis.booked_time NULLS LAST
  ),
  owed AS (
    SELECT i.pid,
           SUM(i.patient_portion) AS balance_due,
           MIN(i.billed_on) AS oldest_unpaid_on
    FROM (
      SELECT ie.patient_id AS pid,
             CASE
               WHEN ie.patient_total IS NOT NULL THEN ie.patient_total
               ELSE GREATEST(COALESCE(ie.total, 0) - COALESCE(ie.medical_aid_total, 0), 0)
             END AS patient_portion,
             COALESCE(ie.issue_date, (ie.created_at AT TIME ZONE 'Africa/Windhoek')::date) AS billed_on
      FROM public.invoices_enhanced ie
      JOIN pts ON pts.pid = ie.patient_id
      WHERE COALESCE(NULLIF(lower(btrim(ie.payment_status)), ''), 'pending') NOT IN ('paid', 'cancelled')
    ) i
    WHERE i.patient_portion > 0
    GROUP BY i.pid
  ),
  -- Standing scripts with repeats left (not cancelled, still valid): the next repeat is due when the
  -- medicine last dispensed runs out (its day + its days of medicine). Scripts without days of medicine
  -- ("when needed") have no due day.
  repeat_due AS (
    SELECT d.patient_id AS pid,
           MIN(lastd.dispensed_on + COALESCE(lastd.days_supply, d.days_supply)) AS next_repeat_due_on
    FROM public.stock_dispensings d
    JOIN pts ON pts.pid = d.patient_id
    CROSS JOIN LATERAL (
      SELECT count(*) AS used FROM public.stock_dispensings r WHERE r.repeat_of = d.id AND r.cancelled_at IS NULL
    ) u
    CROSS JOIN LATERAL (
      SELECT x.dispensed_on, x.days_supply FROM public.stock_dispensings x
       WHERE (x.id = d.id OR x.repeat_of = d.id) AND x.cancelled_at IS NULL
       ORDER BY x.dispensed_on DESC, x.created_at DESC
       LIMIT 1
    ) lastd
    WHERE d.practice_id = p_practice_id AND d.repeat_of IS NULL AND d.cancelled_at IS NULL
      AND d.repeats_allowed > 0 AND u.used < d.repeats_allowed
      AND (d.valid_until IS NULL OR d.valid_until >= p_today)
      AND COALESCE(lastd.days_supply, d.days_supply) IS NOT NULL
    GROUP BY d.patient_id
  )
  SELECT pts.pid,
         pts.first_name,
         pts.last_name,
         pts.date_of_birth,
         pts.cell_number,
         pts.sms_opt_out,
         vf.last_completed_visit_on,
         COALESCE(bt.last_completed_by_type, '{}'::jsonb),
         COALESCE(bc.last_billed_by_code, '{}'::jsonb),
         COALESCE(vf.completed_visits_12m, 0),
         vf.next_booking_on,
         nt.booked_time,
         vf.last_no_show_on,
         COALESCE(ow.balance_due, 0)::numeric,
         ow.oldest_unpaid_on,
         rd.next_repeat_due_on
  FROM pts
  LEFT JOIN visit_facts vf ON vf.pid = pts.pid
  LEFT JOIN by_type bt ON bt.pid = pts.pid
  LEFT JOIN by_code bc ON bc.pid = pts.pid
  LEFT JOIN next_time nt ON nt.pid = pts.pid
  LEFT JOIN owed ow ON ow.pid = pts.pid
  LEFT JOIN repeat_due rd ON rd.pid = pts.pid
  ORDER BY pts.last_name, pts.first_name, pts.pid;
END
$$;
COMMENT ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) IS
  'Facts per patient for patient lists (visits, bookings, no-shows, balance owed, next repeat due). Rules are applied in src/utils/patientLists/listRules.ts.';
REVOKE ALL ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 19. Opening balances: the quantities on the inventory list today become the first movements, at the
--     cost recorded on the item (items already in the ledger are left alone, so a re-run adds nothing)
-- ---------------------------------------------------------------------------------------------
INSERT INTO public.stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, reason, document_ref)
SELECT i.practice_id, i.id, 'opening', i.quantity, round(i.quantity * COALESCE(i.unit_cost, 0), 2), public.ar_today(),
       'Opening balance: the quantity on the inventory list when stock tracking started', 'Opening'
  FROM public.practice_inventory i
 WHERE i.quantity <> 0
   AND NOT EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.item_id = i.id);

-- ---------------------------------------------------------------------------------------------
-- 20. Row level security and grants. Read: active staff of the practice (and super admins), as in
--     proposals/2026-10-07-rls-onehealth.sql. Write: only the functions above.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['stock_settings', 'stock_suppliers', 'stock_orders', 'stock_deliveries', 'stock_dispensings',
                                 'stock_counts', 'stock_count_lines', 'stock_movements', 'stock_valuations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_staff_read', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u '
      'WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND (u.is_super_admin = true OR u.practice_id = %I.practice_id)))',
      v_table || '_staff_read', v_table, v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
  END LOOP;
END $$;

-- The counters are read and written only by stock_next_number()
ALTER TABLE public.stock_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_counters FROM anon, authenticated;
GRANT ALL ON public.stock_counters TO service_role;

REVOKE ALL ON public.stock_item_levels FROM anon, authenticated;
GRANT SELECT ON public.stock_item_levels TO authenticated, service_role;

-- No stock_ function is callable with the public key; the API ones are granted to signed-in staff
-- below (each checks the practice and the role)
DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND left(p.proname, 6) = 'stock_'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
  END LOOP;
END $$;

DO $$
DECLARE
  v_function text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.stock_save_settings(uuid,jsonb)', 'public.stock_save_item(jsonb)', 'public.stock_set_item_active(uuid,boolean)',
    'public.stock_delete_item(uuid)', 'public.stock_save_supplier(jsonb)', 'public.stock_receive(jsonb)',
    'public.stock_return_to_supplier(jsonb)', 'public.stock_reverse_delivery(uuid,text)', 'public.stock_adjust(jsonb)',
    'public.stock_start_count(uuid,text,text)', 'public.stock_record_counts(uuid,jsonb)', 'public.stock_post_count(uuid)',
    'public.stock_cancel_count(uuid,text)', 'public.stock_dispense(jsonb)', 'public.stock_cancel_dispensing(uuid,text)',
    'public.stock_save_order(jsonb)', 'public.stock_cancel_order(uuid,text)', 'public.stock_take_valuation(uuid,date)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 21. With the patient portal applied: patient-app logins get nothing from the new tables either
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 22. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad   text;
  v_items integer;
  v_open  integer;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_bad
    FROM (VALUES ('stock_settings'), ('stock_suppliers'), ('stock_orders'), ('stock_deliveries'), ('stock_dispensings'),
                 ('stock_counts'), ('stock_count_lines'), ('stock_movements'), ('stock_valuations'), ('stock_counters')) AS t(name)
   WHERE NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = format('public.%I', t.name)::regclass)
      OR (t.name <> 'stock_counters' AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.name
                                                       AND p.policyname = t.name || '_staff_read'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: row level security off, or no read policy, on %', v_bad;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND (c.relname LIKE 'stock\_%') AND c.relkind IN ('r', 'v')
     AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE')
          OR has_table_privilege('authenticated', c.oid, 'DELETE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: these can be written by signed-in users or read with the public key: %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND left(p.proname, 6) = 'stock_' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the public key can run %', v_bad;
  END IF;

  SELECT string_agg(t.tbl || '.' || t.name, ', ') INTO v_bad
    FROM (VALUES ('invoice_services', 'stock_10_link_item'), ('invoice_services', 'zz_stock_sync_line'),
                 ('invoices_enhanced', 'zz_stock_invoice_status'), ('invoice_adjustments', 'zz_stock_credit_note'),
                 ('period_closes', 'zz_stock_month_end'), ('stock_movements', 'stock_10_guard'),
                 ('stock_movements', 'stock_50_refresh_item')) AS t(tbl, name)
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.' || t.tbl)::regclass AND g.tgname = t.name);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: triggers missing: %', v_bad;
  END IF;

  -- Every item's copy of the ledger agrees with the ledger
  SELECT count(*) INTO v_items FROM practice_inventory i
   WHERE i.quantity <> COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.item_id = i.id), 0);
  IF v_items > 0 THEN
    RAISE EXCEPTION 'Check failed: % items show a quantity that is not the sum of their movements', v_items;
  END IF;

  IF position('next_repeat_due_on' IN pg_get_function_result('public.patient_list_facts(uuid,date,uuid[])'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: patient_list_facts() does not return next_repeat_due_on';
  END IF;

  SELECT count(*) INTO v_open FROM stock_movements WHERE kind = 'opening';
  RAISE NOTICE 'Stock and dispensing: checks passed; % opening balances recorded.', v_open;
END $$;

-- PostgREST: pick up the new tables, columns and functions
NOTIFY pgrst, 'reload schema';

ROLLBACK;

-- =============================================================================================
-- Rehearsal, 2026-10-08 (whole file + tests in one transaction that rolled back; simulated sign-ins; counts only)
--   Applied cleanly; section 22 passed. 40 opening balances for the 40 items with a quantity; 0 items whose
--   quantity differs from their movements.
--   Practice A admin: settings saved, falling bands refused (22023). New item: opening 10 at 2.50 = 25.00; the same
--   NAPPI on a second item refused (23505). Received 20 for 60.00 + VAT: on hand 30, value 85.00, unit cost 2.83,
--   payable 69.00 pending, due in 30 days; the same supplier invoice again refused (23505); a total that does not
--   match the supplier invoice refused (22023). Invoice line of 3: on hand 27, line linked, NAPPI copied; 3 -> 5: 25;
--   credited in full: 30; credit note reversed: 25. Invoice cancelled: 23 -> 25. Line deleted: 21 -> 25. Lines
--   rewritten by a visit save: 25 -> 25. Dispensed 4 + a repeat of 4 without billing: 17; billed dispensing: no
--   change (the invoice line moves it); next repeat due in 10 days (patient_list_facts); a third repeat of a
--   2-repeat script refused (22023). Adjusted -1: 16. Stock take 2 short: 14, value -5.67. Returned 2: 12, credit
--   6.52. Valuation kept = ledger value. Order numbered. Delivery reversed: 12 -> -8, payable cancelled. Item copy =
--   ledger. Staff editing or inserting a movement directly: refused (42501).
--   Second run: unbilled dispensing of 3 cancelled: on hand back (3 returned), cancelling it again refused (23514).
--   Never-used item deleted; an item with history refused (23503). Order cancelled. An invoice deleted with a stock
--   line of 2: on hand back (-10 -> -8). Month closed (a close inserted as dc_close_period writes it): 1 valuation
--   kept at the month end, equal to the ledger; a movement dated in the closed month refused (P0001). Unit cost
--   stays at 2 decimals (2.83); item copy = ledger.
--   Access: A receptionist reads the item's 22 movements, cannot adjust or change settings (42501), can start a
--   count. Practice B doctor sees 0 of A's movements, settings, suppliers and dispensings (sees B's own 2), and
--   cannot adjust or edit A's stock (42501). A signed-in user with no staff profile sees 0 and is refused (42501).
--   The public key cannot read the tables or run the functions (42501).
--
-- Undo after a COMMIT, in one transaction (the ledger and the dispensing records are records: export
-- them first if they hold anything):
--   DROP TRIGGER IF EXISTS stock_10_link_item ON public.invoice_services;
--   DROP TRIGGER IF EXISTS zz_stock_sync_line ON public.invoice_services;
--   DROP TRIGGER IF EXISTS zz_stock_invoice_status ON public.invoices_enhanced;
--   DROP TRIGGER IF EXISTS zz_stock_credit_note ON public.invoice_adjustments;
--   DROP TRIGGER IF EXISTS zz_stock_month_end ON public.period_closes;
--   Recreate patient_list_facts() from proposals/2026-10-07-patient-lists.sql (section 4).
--   DROP VIEW IF EXISTS public.stock_item_levels;
--   DROP TABLE IF EXISTS public.stock_valuations, public.stock_movements, public.stock_count_lines, public.stock_counts,
--     public.stock_dispensings, public.stock_deliveries, public.stock_orders, public.stock_settings, public.stock_counters;
--   ALTER TABLE public.practice_inventory DROP COLUMN IF EXISTS preferred_supplier_id;   -- before the suppliers table
--   DROP TABLE IF EXISTS public.stock_suppliers;
--   ALTER TABLE public.invoice_services DROP COLUMN IF EXISTS stock_item_id, DROP COLUMN IF EXISTS nappi_code;
--   ALTER TABLE public.practice_inventory DROP COLUMN IF EXISTS nappi_code, DROP COLUMN IF EXISTS barcode,
--     DROP COLUMN IF EXISTS item_group, DROP COLUMN IF EXISTS tariff_code, DROP COLUMN IF EXISTS vat_rate,
--     DROP COLUMN IF EXISTS selling_price, DROP COLUMN IF EXISTS max_level, DROP COLUMN IF EXISTS pack_size,
--     DROP COLUMN IF EXISTS is_scheduled, DROP COLUMN IF EXISTS schedule_label, DROP COLUMN IF EXISTS default_directions,
--     DROP COLUMN IF EXISTS is_active;
--   Then drop the stock_ functions: SELECT format('DROP FUNCTION %s;', p.oid::regprocedure) FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND left(p.proname, 6) = 'stock_';
--   practice_inventory.quantity keeps the last ledger figure, so the old inventory screen carries on from there.
-- =============================================================================================
