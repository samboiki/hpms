-- Applied 2026-10-13 as migration stock_stores_and_suppliers_2026_10_13 (version 20261013012850; stored statement md5 1316e6638e8759b874861e89ab4c8260 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed first (the part between BEGIN; and ROLLBACK; plus tests, all in one transaction ended by RAISE EXCEPTION;
-- simulated logins; afterwards no table of this file existed): a practice with one store recorded an opening balance,
-- a delivery, a return, an adjustment and a posted count with every movement in the main store and the item's
-- quantity equal to its movements. The practice admin added a branch store and a store room; "Main store", another
-- practice's branch, the same name again and a second store for one branch were refused (22023, 23505). Reception sent
-- 5 to the branch (main 20, on the way 5, the practice's on hand and value unchanged, sent by reception), received
-- them (who and when kept), could not receive twice (23514), send more than the store holds or to the same store
-- (22023), set up a store or pay a supplier (42501); a cancelled transfer went back to the main store. On a visit at
-- the branch an invoice line of 2 came off the branch store and a reduction to 1 went back there; an unbilled
-- dispensing at the branch came off the branch store and its cancellation went back; a delivery went into the store
-- room; a return of more than the branch held was refused with the store's name; an adjustment and a count (expected
-- = what the branch held, with a count of the main store open at the same time; a second count of the branch refused)
-- stayed in the branch; a store holding stock could not be stopped (23514); store levels added up to the item levels.
-- Creditors: N$ 30 paid two invoices oldest first after the N$ 4.60 return credit (N$ 11.40 left on the first); the
-- rest paid both and marked both payables paid in Finance; N$ 10 paid on account; reversing the second payment made
-- both owed again and their payables pending (reversing it twice refused); the N$ 10 on account then paid part of the
-- first invoice with no new payment; an invoice marked paid in Practice Overhead could not be paid again; reversing the
-- return released its credit (the first invoice owes N$ 6.00 = invoices 69.00 less payments 40.00 less the 23.00
-- marked paid); a delivery received without a payable is not in the ledger; nothing to pay was refused. A doctor of
-- another practice saw none of these rows and could not move, pay or use the store (42501, 22023); a login without a
-- staff profile saw nothing and was refused; the public key could not read or run anything (42501).
-- =============================================================================================
-- PROPOSAL: stock per store or branch with transfers between them (sent and received, by whom and when), and the
--           creditors ledger: supplier invoices from goods received, payments to suppliers, statements and ageing
--           (parity L10, L12, R24)
-- File:   proposals/2026-10-13-stock-stores-and-suppliers.sql            Drafted: 2026-10-13
-- Code:   src/utils/stock/stores.ts (where stock is, per store; tested), src/utils/stock/supplierLedger.ts (a supplier's
--         account: invoices, credits, payments, what each invoice still owes, the age analysis, the statement, VAT on
--         purchases; tested), src/services/stock/storeService.ts and supplierLedgerService.ts (reads and writes; "not set
--         up yet" before this file), src/components/stock/* (Stock > Transfers, the store pickers, Stock > Settings >
--         Stores, Stock > Suppliers: what is owed, pay, statement, age analysis, transactions, VAT on purchases)
--
-- Why
--   L10: stock was one pile per practice. A practice with a second branch, or a dispensary and a store room, could not
--   see what is where, and moving stock between them left no record. Eminance moves stock between branches by
--   exporting a file at one branch and importing it at the other.
--   L12 / R24: a delivery created the supplier's payable in practice_expenses, but nothing recorded payments to a
--   supplier, part payments, credits for returns, or the account per supplier: no supplier statement and no supplier
--   age analysis.
--
-- What it does
--   Stores (L10)
--   1. stock_locations: a practice's stores besides the main store (a branch's dispensary, a store room), each
--      optionally serving one branch. The main store is not a row: stock not in another store is in it, so a practice
--      with one place has no rows here and nothing changes for it. One "On the way" row per practice holds stock sent
--      and not yet received.
--   2. stock_movements.location_id (NULL = the main store), filled by the document a movement belongs to: a delivery
--      or return (stock_deliveries.location_id), a stock count (stock_counts.location_id), a dispensing
--      (stock_dispensings.location_id: the store of the visit's branch, else of the dispenser's branch), an invoice line
--      (the store of the visit's branch; a line taken back returns where it came from), a reversal (where the reversed
--      movement was). Adjustments name their store. stock_receive, stock_return_to_supplier, stock_adjust,
--      stock_start_count and stock_record_counts take an optional store (their code is copied as it is live, with the
--      store added; a return checks what is on hand in that store; a count expects what that store holds).
--   3. stock_transfers + stock_send_transfer / stock_receive_transfer / stock_cancel_transfer (any staff member):
--      sending takes the stock out of one store onto "On the way" (who and when); receiving puts it into the other
--      store (who and when); cancelling puts it back. Values move at the average cost, so the practice's stock value
--      never changes with a transfer. Movement kinds transfer_out and transfer_in.
--   4. stock_location_levels (view): on hand and value per store. stock_save_location (practice admins): add, rename,
--      link to a branch, stop using a store (only when it holds nothing and nothing is on the way).
--   Suppliers and the creditors ledger (L12, R24)
--   5. stock_suppliers.postal_address (for statements); stock_save_supplier takes it.
--   6. stock_deliveries.on_account: true when the delivery's supplier invoice was added to payables (owed on account).
--   7. stock_supplier_payments (PAY numbers) and stock_supplier_allocations (which invoice each payment or credit for
--      returned stock pays). stock_pay_supplier (practice admins and doctors): a payment, paying the chosen invoices
--      oldest first, using credits not yet used first; an invoice paid in full marks its payable paid in Finance.
--      stock_reverse_supplier_payment undoes a payment (its invoices owe again). Reversing a delivery or a return
--      releases what was paid against it (a trigger), so money paid for reversed stock shows as credit with the
--      supplier.
--   8. Row level security: staff of the practice read the new tables; nobody writes them directly; the patient app's
--      logins get nothing (portal_staff_only).
--   Nothing else changes: no policy of another table, no claim or invoice function. stock_sync_invoice_line, stock_dispense,
--   stock_post_count, stock_reverse_delivery and stock_cancel_dispensing are not touched: the location trigger
--   places their movements.
--
-- Rules the database enforces (the same rules are in src/utils/stock/stores.ts and supplierLedger.ts, tested)
--   - A practice with no stores keeps every movement in the main store (location_id NULL): nothing changes for it.
--   - Stock on the way is in no store but still the practice's: the stock value and the month-end valuation include it.
--   - What a supplier invoice still owes: nothing once its delivery is reversed or its payable is marked paid (in the
--     ledger or in Settings > Practice Overhead), else its total less what is allocated to it.
--   - A payable marked paid by the ledger goes back to pending when the payment that paid it is reversed (or the
--     credit that paid it is reversed); one marked paid in Practice Overhead is never changed by the ledger.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. Before it is applied the Stock page works as before: no Transfers tab, no store
-- pickers, and Suppliers shows "The supplier ledger is not set up yet" where the account would be.
-- Undo (after exporting anything kept in the new tables):
--   DROP TRIGGER IF EXISTS stock_05_location ON public.stock_movements;
--   DROP TRIGGER IF EXISTS stock_05_location ON public.stock_dispensings;
--   DROP TRIGGER IF EXISTS zz_stock_supplier_release ON public.stock_deliveries;
--   Recreate stock_receive, stock_return_to_supplier, stock_adjust, stock_record_counts, stock_save_supplier and the
--   3-argument stock_start_count from proposals/2026-10-07-dispensing-and-stock.sql (sections 10, 11, 12, 13) and
--   DROP FUNCTION public.stock_start_count(uuid, text, text, uuid);
--   DROP VIEW IF EXISTS public.stock_location_levels;
--   DROP TABLE public.stock_supplier_allocations, public.stock_supplier_payments; ALTER TABLE public.stock_movements
--   DROP COLUMN transfer_id, DROP COLUMN location_id; DROP TABLE public.stock_transfers; ALTER TABLE
--   public.stock_deliveries DROP COLUMN location_id, DROP COLUMN on_account; ALTER TABLE public.stock_counts DROP COLUMN
--   location_id; ALTER TABLE public.stock_dispensings DROP COLUMN location_id; DROP TABLE public.stock_locations;
--   ALTER TABLE public.stock_suppliers DROP COLUMN postal_address; and the functions named in section 13.
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the stock file is applied, and the functions this file replaces are as it left them
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
  v_changed text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.stock_movements'), ('public.stock_deliveries'), ('public.stock_counts'), ('public.stock_dispensings'),
                 ('public.stock_suppliers'), ('public.stock_counters'), ('public.practice_inventory'), ('public.practice_expenses'),
                 ('public.branches'), ('public.visits'), ('public.invoices_enhanced'), ('public.users')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply proposals/2026-10-07-dispensing-and-stock.sql first.', v_missing;
  END IF;

  SELECT string_agg(t.signature, ', ') INTO v_changed
    FROM (VALUES ('public.stock_receive(jsonb)', 'f90c13bca15d959a748b471bbc0a2ab4'),
                 ('public.stock_return_to_supplier(jsonb)', 'dd22beaf7af19e921fc4352284bfec89'),
                 ('public.stock_adjust(jsonb)', 'd85c6f728f334a25e52f95b296bee1f8'),
                 ('public.stock_start_count(uuid,text,text)', 'af389cdcfc71e0921a34d25061b2d2d8'),
                 ('public.stock_record_counts(uuid,jsonb)', '1749ccf04a5909c39ecacdb6ea4275d1'),
                 ('public.stock_save_supplier(jsonb)', '57281756cd486b18ecd1f566f83c488a')) AS t(signature, md5)
   WHERE to_regprocedure(t.signature) IS NULL
      OR md5(pg_get_functiondef(to_regprocedure(t.signature))) <> t.md5;
  IF v_changed IS NOT NULL AND to_regclass('public.stock_locations') IS NULL THEN
    RAISE EXCEPTION 'Stopped: these functions changed since 2026-10-13 (merge this file''s versions with theirs by hand): %', v_changed;
  END IF;

  IF to_regprocedure('public.stock_assert_role(uuid,text[],text)') IS NULL OR to_regprocedure('public.stock_next_number(uuid,text,date)') IS NULL
     OR to_regprocedure('public.stock_issue_value(uuid,integer)') IS NULL OR to_regprocedure('public.ar_today()') IS NULL
     OR to_regprocedure('public.stock_history_guard()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: the stock helper functions are missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Document numbers: TRF (transfer between stores) and PAY (payment to a supplier), added to whatever series the
--    counter already allows
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_series text[];
BEGIN
  SELECT array_agg(DISTINCT s.series ORDER BY s.series) INTO v_series
    FROM (SELECT (regexp_matches(pg_get_constraintdef(c.oid), '''([A-Z]+)''', 'g'))[1] AS series
            FROM pg_constraint c
           WHERE c.conrelid = 'public.stock_counters'::regclass AND c.conname = 'stock_counters_series_check'
          UNION SELECT unnest(ARRAY['GRV', 'RET', 'ORD', 'CNT', 'RX', 'TRF', 'PAY'])) s;
  ALTER TABLE public.stock_counters DROP CONSTRAINT IF EXISTS stock_counters_series_check;
  -- Written as ARRAY['GRV'::text, ...] (as the stock file wrote it), so the next file can read the list the same way
  EXECUTE format('ALTER TABLE public.stock_counters ADD CONSTRAINT stock_counters_series_check CHECK (series = ANY (ARRAY[%s]))',
                 (SELECT string_agg(quote_literal(s) || '::text', ', ') FROM unnest(v_series) AS s));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Stores
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- 'store': a place stock is kept; 'transit': the practice's one "On the way" place for stock sent between stores
  kind        text NOT NULL DEFAULT 'store' CHECK (kind IN ('store', 'transit')),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- The branch whose sales and dispensing come from this store (one store per branch)
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_locations_transit_shape CHECK (kind = 'store' OR branch_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_name_key ON public.stock_locations (practice_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_branch_key ON public.stock_locations (practice_id, branch_id)
  WHERE branch_id IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_one_transit ON public.stock_locations (practice_id) WHERE kind = 'transit';
COMMENT ON TABLE public.stock_locations IS
  'Stores of a practice besides its main store (stock with no store is in the main store), and its one "On the way" place for transfers. Written by stock_save_location and stock_send_transfer.';

-- Stops unless p_location_id is NULL (the main store) or an active store of the practice
CREATE OR REPLACE FUNCTION public.stock_assert_store(p_practice_id uuid, p_location_id uuid, p_what text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_location_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM stock_locations l
        WHERE l.id = p_location_id AND l.practice_id = p_practice_id AND l.kind = 'store' AND l.is_active) THEN
    RAISE EXCEPTION 'Choose one of your practice''s stores for %', p_what USING ERRCODE = '22023';
  END IF;
END $$;

-- The store serving a branch: the active store linked to it, else NULL (the main store)
CREATE OR REPLACE FUNCTION public.stock_store_for_branch(p_practice_id uuid, p_branch_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id FROM stock_locations l
   WHERE p_branch_id IS NOT NULL AND l.practice_id = p_practice_id AND l.branch_id = p_branch_id
     AND l.kind = 'store' AND l.is_active
   ORDER BY l.created_at
   LIMIT 1
$$;

-- "Main store" or the store's name, for movement reasons and messages
CREATE OR REPLACE FUNCTION public.stock_store_name(p_location_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT l.name FROM stock_locations l WHERE l.id = p_location_id), 'Main store')
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Where stock is: the store on movements and on the documents that move stock; transfers' movement kinds;
--    the delivery's supplier invoice on account
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  number           text NOT NULL,
  -- NULL = the main store
  from_location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  to_location_id   uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  -- [{"item_id", "name", "unit", "quantity", "value"}] as sent (value at the average cost, excl VAT)
  lines            jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) BETWEEN 1 AND 200),
  notes            text CHECK (notes IS NULL OR char_length(notes) <= 500),
  status           text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'received', 'cancelled')),
  sent_by          uuid,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  -- Received or cancelled
  closed_at        timestamptz,
  received_by      uuid,
  received_at      timestamptz,
  cancelled_by     uuid,
  cancelled_at     timestamptz,
  cancel_reason    text,
  CONSTRAINT stock_transfers_number_key UNIQUE (practice_id, number),
  CONSTRAINT stock_transfers_two_stores CHECK (from_location_id IS DISTINCT FROM to_location_id),
  CONSTRAINT stock_transfers_status_shape CHECK (
    (status = 'sent' AND closed_at IS NULL AND received_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'received' AND closed_at IS NOT NULL AND received_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND closed_at IS NOT NULL AND cancelled_at IS NOT NULL AND received_at IS NULL
        AND char_length(btrim(COALESCE(cancel_reason, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS stock_transfers_practice_idx ON public.stock_transfers (practice_id, sent_at DESC);
COMMENT ON TABLE public.stock_transfers IS
  'Stock sent from one store to another: sent (who, when), then received or cancelled (who, when). Lines are the stock_movements with this transfer_id.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_transfers;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('closed_at,status,received_by,received_at,cancelled_by,cancelled_at,cancel_reason', '');
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_transfers;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_transfers
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.stock_transfers(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.stock_movements.location_id IS 'The store the units went into or out of; NULL = the main store.';
CREATE INDEX IF NOT EXISTS stock_movements_location_idx ON public.stock_movements (location_id, item_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_transfer_idx ON public.stock_movements (transfer_id) WHERE transfer_id IS NOT NULL;

ALTER TABLE public.stock_deliveries
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS on_account boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.stock_deliveries.on_account IS
  'A delivery whose supplier invoice was added to payables: owed to the supplier on account (the creditors ledger).';
ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_dispensings ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT;

-- Deliveries recorded before this file: on account when they created a payable (the history guard is paused for it)
ALTER TABLE public.stock_deliveries DISABLE TRIGGER stock_20_history;
UPDATE public.stock_deliveries SET on_account = true WHERE kind = 'received' AND expense_id IS NOT NULL AND NOT on_account;
ALTER TABLE public.stock_deliveries ENABLE TRIGGER stock_20_history;

-- One stock count at a time per store (it was per practice)
DROP INDEX IF EXISTS public.stock_counts_one_open;
CREATE UNIQUE INDEX IF NOT EXISTS stock_counts_one_open
  ON public.stock_counts (practice_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'counting';

-- The transfer kinds, added to whatever kinds the ledger already allows
DO $$
DECLARE
  v_kinds text[];
BEGIN
  SELECT array_agg(DISTINCT k.kind ORDER BY k.kind) INTO v_kinds
    FROM (SELECT (regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g'))[1] AS kind
            FROM pg_constraint c
           WHERE c.conrelid = 'public.stock_movements'::regclass AND c.conname = 'stock_movements_kind_check'
          UNION SELECT unnest(ARRAY['transfer_out', 'transfer_in'])) k;
  ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_kind_check;
  EXECUTE format('ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_kind_check CHECK (kind = ANY (ARRAY[%s]))',
                 (SELECT string_agg(quote_literal(k) || '::text', ', ') FROM unnest(v_kinds) AS k));
END $$;

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_transfer_shape;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_transfer_shape CHECK (
  CASE kind
    WHEN 'transfer_out' THEN quantity < 0 AND transfer_id IS NOT NULL
    WHEN 'transfer_in' THEN quantity > 0 AND transfer_id IS NOT NULL
    ELSE transfer_id IS NULL
  END
);

-- ---------------------------------------------------------------------------------------------
-- 4. The store of a movement, from its document (when the movement does not name one), and of a dispensing
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_movement_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text;
BEGIN
  IF NEW.location_id IS NULL AND NEW.transfer_id IS NULL
     AND EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = NEW.practice_id) THEN
    IF NEW.delivery_id IS NOT NULL THEN
      SELECT d.location_id INTO NEW.location_id FROM stock_deliveries d WHERE d.id = NEW.delivery_id;
    ELSIF NEW.count_id IS NOT NULL THEN
      SELECT c.location_id INTO NEW.location_id FROM stock_counts c WHERE c.id = NEW.count_id;
    ELSIF NEW.dispensing_id IS NOT NULL THEN
      SELECT d.location_id INTO NEW.location_id FROM stock_dispensings d WHERE d.id = NEW.dispensing_id;
    ELSIF NEW.invoice_line_id IS NOT NULL AND NEW.kind = 'sale_reversed' THEN
      -- Back where the line's stock came from
      SELECT m.location_id INTO NEW.location_id FROM stock_movements m
       WHERE m.invoice_line_id = NEW.invoice_line_id AND m.item_id = NEW.item_id AND m.kind = 'sold'
       ORDER BY m.created_at DESC
       LIMIT 1;
    ELSIF NEW.invoice_line_id IS NOT NULL THEN
      NEW.location_id := stock_store_for_branch(NEW.practice_id,
        (SELECT v.branch_id FROM invoices_enhanced e JOIN visits v ON v.id = e.visit_id WHERE e.id = NEW.invoice_id));
    ELSIF NEW.reverses_id IS NOT NULL THEN
      SELECT m.location_id INTO NEW.location_id FROM stock_movements m WHERE m.id = NEW.reverses_id;
    END IF;
  END IF;
  IF NEW.location_id IS NOT NULL THEN
    SELECT l.kind INTO v_kind FROM stock_locations l WHERE l.id = NEW.location_id AND l.practice_id = NEW.practice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That store belongs to another practice' USING ERRCODE = '42501';
    END IF;
    IF v_kind = 'transit' AND NEW.transfer_id IS NULL THEN
      RAISE EXCEPTION 'Only a transfer puts stock on the way between stores' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stock_05_location ON public.stock_movements;
CREATE TRIGGER stock_05_location BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_location();

-- A dispensing comes from the store of the visit's branch, else of the dispenser's branch, else the main store
CREATE OR REPLACE FUNCTION public.stock_dispensing_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location_id IS NULL AND EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = NEW.practice_id AND l.kind = 'store') THEN
    NEW.location_id := COALESCE(
      stock_store_for_branch(NEW.practice_id, (SELECT v.branch_id FROM visits v WHERE v.id = NEW.visit_id)),
      stock_store_for_branch(NEW.practice_id, (SELECT u.branch_id FROM users u
                                                 WHERE u.id = COALESCE(NEW.dispensed_by, auth.uid()) AND u.practice_id = NEW.practice_id)));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stock_05_location ON public.stock_dispensings;
CREATE TRIGGER stock_05_location BEFORE INSERT ON public.stock_dispensings
  FOR EACH ROW EXECUTE FUNCTION public.stock_dispensing_location();

-- On hand and value per store and item (the caller's row level security applies; NULL location = the main store)
CREATE OR REPLACE VIEW public.stock_location_levels WITH (security_invoker = on) AS
SELECT m.practice_id,
       m.location_id,
       m.item_id,
       SUM(m.quantity)::integer AS on_hand,
       SUM(m.value)::numeric(14,2) AS value
  FROM public.stock_movements m
 GROUP BY m.practice_id, m.location_id, m.item_id;
COMMENT ON VIEW public.stock_location_levels IS 'On hand and value at cost per store and stock item, from the stock ledger (NULL location = the main store).';

-- ---------------------------------------------------------------------------------------------
-- 5. The functions that take a store: copied as they are live (proposals/2026-10-07-dispensing-and-stock.sql),
--    with the store added. A delivery also records whether its invoice is owed on account.
-- ---------------------------------------------------------------------------------------------
/*
  stock_receive({... as before, "location_id"? (the store it arrives in; null = the main store)})
*/
CREATE OR REPLACE FUNCTION public.stock_receive(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier  stock_suppliers%ROWTYPE;
  v_reference text := stock_text(p_payload, 'supplier_reference', 'The supplier invoice number', 60);
  v_date      date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, ar_today());
  v_order     uuid := NULLIF(p_payload ->> 'order_id', '')::uuid;
  v_location  uuid := NULLIF(p_payload ->> 'location_id', '')::uuid;
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
  PERFORM stock_assert_store(v_practice, v_location, 'the delivery');
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
                                total_incl_vat, expense_id, order_id, notes, created_by, location_id, on_account)
  VALUES (v_practice, v_number, 'received', v_supplier.id, v_reference, v_date, v_excl, v_vat, v_incl, v_expense, v_order,
          stock_text(p_payload, 'notes', 'The notes', 500), auth.uid(), v_location, v_expense IS NOT NULL)
  RETURNING id INTO v_id;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, occurred_on, document_ref, delivery_id,
                               location_id)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'received', (l ->> 'quantity')::integer, (l ->> 'cost')::numeric,
         round((l ->> 'cost')::numeric * (l ->> 'rate')::numeric / 100, 2), l ->> 'batch_no', NULLIF(l ->> 'expiry_date', '')::date,
         v_date, v_number, v_id, v_location
    FROM jsonb_array_elements(v_parsed) AS l;

  IF v_order IS NOT NULL THEN
    UPDATE stock_orders SET status = 'received', status_changed_at = now(), status_changed_by = auth.uid(), received_delivery_id = v_id
     WHERE id = v_order;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'total_incl_vat', v_incl, 'expense_id', v_expense);
END $$;

/*
  stock_return_to_supplier({... as before, "location_id"? (the store the stock leaves; null = the main store)})
  No more than that store holds can go back.
*/
CREATE OR REPLACE FUNCTION public.stock_return_to_supplier(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice  uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier  stock_suppliers%ROWTYPE;
  v_reference text := stock_text(p_payload, 'supplier_reference', 'The return or credit note number', 60);
  v_reason    text := stock_text(p_payload, 'reason', 'The reason', 300);
  v_date      date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, ar_today());
  v_location  uuid := NULLIF(p_payload ->> 'location_id', '')::uuid;
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
  PERFORM stock_assert_store(v_practice, v_location, 'the return');
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
    -- What that store holds (a practice with one store: everything it holds)
    SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand FROM stock_movements
     WHERE item_id = v_item.id AND location_id IS NOT DISTINCT FROM v_location;
    IF v_qty > v_on_hand THEN
      RAISE EXCEPTION 'Line %: only % % of % are on hand%. Count the stock first if that is wrong.', v_index, GREATEST(v_on_hand, 0), v_item.unit, v_item.name,
        CASE WHEN EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = v_practice) THEN ' in ' || stock_store_name(v_location) ELSE '' END
        USING ERRCODE = '22023';
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
                                total_incl_vat, reason, notes, created_by, location_id)
  VALUES (v_practice, v_number, 'returned', v_supplier.id, v_reference, v_date, v_excl, v_vat, v_excl + v_vat, v_reason,
          stock_text(p_payload, 'notes', 'The notes', 500), auth.uid(), v_location)
  RETURNING id INTO v_id;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, occurred_on, document_ref, delivery_id, reason,
                               location_id)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'returned', -(l ->> 'quantity')::integer, -(l ->> 'value')::numeric, (l ->> 'vat')::numeric,
         l ->> 'batch_no', NULLIF(l ->> 'expiry_date', '')::date, v_date, v_number, v_id, v_reason, v_location
    FROM jsonb_array_elements(v_parsed) AS l;
  RETURN jsonb_build_object('id', v_id, 'number', v_number, 'credit_expected', v_excl + v_vat);
END $$;

/*
  stock_adjust({... as before, "location_id"? (the store adjusted; null = the main store)})  Admins and doctors.
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
  v_location uuid := NULLIF(p_payload ->> 'location_id', '')::uuid;
  v_value    numeric;
  v_id       uuid;
BEGIN
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor'], 'adjust stock');
  PERFORM stock_assert_store(v_practice, v_location, 'the adjustment');
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
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, batch_no, expiry_date, reason_code, reason, occurred_on, document_ref,
                               location_id)
  VALUES (v_practice, v_item.id, 'adjusted', v_qty, v_value, stock_text(p_payload, 'batch_no', 'The batch number', 40),
          NULLIF(p_payload ->> 'expiry_date', '')::date, v_code, v_reason, v_date, 'Adjustment', v_location)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'value', v_value);
END $$;

-- A stock count of one store (null = the main store): one open count per store. The 3-argument version is replaced
-- by this one, whose store defaults to the main store, so calls without a store keep working.
DROP FUNCTION IF EXISTS public.stock_start_count(uuid, text, text);
CREATE OR REPLACE FUNCTION public.stock_start_count(p_practice_id uuid, p_item_group text, p_note text, p_location_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number text;
  v_id     uuid;
BEGIN
  PERFORM stock_assert_role(p_practice_id, NULL, 'count stock');
  PERFORM stock_assert_store(p_practice_id, p_location_id, 'the count');
  IF EXISTS (SELECT 1 FROM stock_counts WHERE practice_id = p_practice_id AND status = 'counting'
                AND location_id IS NOT DISTINCT FROM p_location_id) THEN
    RAISE EXCEPTION 'A stock count is already open%. Finish or cancel it first.',
      CASE WHEN p_location_id IS NOT NULL OR EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = p_practice_id)
           THEN ' in ' || stock_store_name(p_location_id) ELSE '' END USING ERRCODE = '23505';
  END IF;
  v_number := stock_next_number(p_practice_id, 'CNT', ar_today());
  INSERT INTO stock_counts (practice_id, number, item_group, note, started_by, location_id)
  VALUES (p_practice_id, v_number, NULLIF(btrim(COALESCE(p_item_group, '')), ''), left(NULLIF(btrim(COALESCE(p_note, '')), ''), 300), auth.uid(),
          p_location_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END $$;

-- p_lines: [{"item_id", "counted"}] ("counted": null takes an item off the count). Any staff member. Each count keeps
-- what the count's store held when it was entered.
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
      SELECT COALESCE(SUM(quantity), 0) INTO v_on_hand FROM stock_movements
       WHERE item_id = v_item.id AND location_id IS NOT DISTINCT FROM v_count.location_id;
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

-- ---------------------------------------------------------------------------------------------
-- 6. Setting up stores (practice admins)
-- ---------------------------------------------------------------------------------------------
/*
  stock_save_location({"id"?, "practice_id", "name", "branch_id"?, "is_active"?})
  A store keeps stock apart (a branch's dispensary, a store room). Linked to a branch, that branch's sales and
  dispensing come from it. A store stops being used only when it holds nothing and nothing is on the way to or from it.
*/
CREATE OR REPLACE FUNCTION public.stock_save_location(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id       uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_name     text := stock_text(p_payload, 'name', 'The store''s name', 60);
  v_branch   uuid := NULLIF(p_payload ->> 'branch_id', '')::uuid;
  v_active   boolean := COALESCE((p_payload ->> 'is_active')::boolean, true);
  v_row      stock_locations%ROWTYPE;
  v_other    text;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_row FROM stock_locations WHERE id = v_id FOR UPDATE;
    IF NOT FOUND OR v_row.kind <> 'store' THEN
      RAISE EXCEPTION 'Store not found' USING ERRCODE = 'P0002';
    END IF;
    v_practice := v_row.practice_id;
  END IF;
  PERFORM stock_assert_role(v_practice, ARRAY['admin'], 'set up stores');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Give the store a name' USING ERRCODE = '22023';
  END IF;
  IF lower(v_name) IN ('main store', 'on the way') THEN
    RAISE EXCEPTION '"%" is the name OneHealth uses for the practice''s own place: choose another', v_name USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = v_practice AND lower(btrim(l.name)) = lower(v_name) AND l.id IS DISTINCT FROM v_id) THEN
    RAISE EXCEPTION 'There is already a store called %', v_name USING ERRCODE = '23505';
  END IF;
  IF v_branch IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = v_branch AND b.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose one of your practice''s branches' USING ERRCODE = '22023';
  END IF;
  IF v_branch IS NOT NULL AND v_active THEN
    SELECT l.name INTO v_other FROM stock_locations l
     WHERE l.practice_id = v_practice AND l.branch_id = v_branch AND l.is_active AND l.id IS DISTINCT FROM v_id LIMIT 1;
    IF v_other IS NOT NULL THEN
      RAISE EXCEPTION 'That branch already has its store (%)', v_other USING ERRCODE = '23505';
    END IF;
  END IF;
  IF v_id IS NOT NULL AND v_row.is_active AND NOT v_active THEN
    IF EXISTS (SELECT 1 FROM stock_movements m WHERE m.location_id = v_id GROUP BY m.item_id HAVING SUM(m.quantity) <> 0) THEN
      RAISE EXCEPTION '% still holds stock: move it to another store (or count it) first', v_row.name USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM stock_transfers t WHERE t.status = 'sent' AND (t.from_location_id = v_id OR t.to_location_id = v_id)) THEN
      RAISE EXCEPTION 'Stock is on the way to or from %: receive or cancel those transfers first', v_row.name USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM stock_counts c WHERE c.location_id = v_id AND c.status = 'counting') THEN
      RAISE EXCEPTION 'A stock count of % is open: post or cancel it first', v_row.name USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO stock_locations (practice_id, kind, name, branch_id, is_active, created_by, updated_by)
    VALUES (v_practice, 'store', v_name, v_branch, v_active, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE stock_locations SET name = v_name, branch_id = v_branch, is_active = v_active, updated_by = auth.uid(), updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Transfers between stores (any staff member)
-- ---------------------------------------------------------------------------------------------
/*
  stock_send_transfer({"practice_id", "from_location_id" (null = the main store), "to_location_id" (null = the main
    store), "notes"?, "lines": [{"item_id", "quantity"}]})
  The stock leaves the first store at once and is "On the way" until the other store receives it.
*/
CREATE OR REPLACE FUNCTION public.stock_send_transfer(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_from     uuid := NULLIF(p_payload ->> 'from_location_id', '')::uuid;
  v_to       uuid := NULLIF(p_payload ->> 'to_location_id', '')::uuid;
  v_lines    jsonb := p_payload -> 'lines';
  v_line     jsonb;
  v_index    integer := 0;
  v_item     practice_inventory%ROWTYPE;
  v_qty      integer;
  v_on_hand  integer;
  v_seen     uuid[] := ARRAY[]::uuid[];
  v_clean    jsonb := '[]'::jsonb;
  v_transit  uuid;
  v_today    date := ar_today();
  v_number   text;
  v_id       uuid;
  v_to_name  text;
BEGIN
  PERFORM stock_assert_role(v_practice, NULL, 'move stock between stores');
  IF NOT EXISTS (SELECT 1 FROM stock_locations l WHERE l.practice_id = v_practice AND l.kind = 'store' AND l.is_active) THEN
    RAISE EXCEPTION 'Add a second store first (Stock > Settings > Stores)' USING ERRCODE = '22023';
  END IF;
  PERFORM stock_assert_store(v_practice, v_from, 'where the stock comes from');
  PERFORM stock_assert_store(v_practice, v_to, 'where the stock goes');
  IF v_from IS NOT DISTINCT FROM v_to THEN
    RAISE EXCEPTION 'Choose two different stores' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'A transfer has 1 to 200 lines' USING ERRCODE = '22023';
  END IF;

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
    SELECT COALESCE(SUM(m.quantity), 0) INTO v_on_hand FROM stock_movements m
     WHERE m.item_id = v_item.id AND m.location_id IS NOT DISTINCT FROM v_from;
    IF v_qty > v_on_hand THEN
      RAISE EXCEPTION 'Line %: only % % of % are in %', v_index, GREATEST(v_on_hand, 0), v_item.unit, v_item.name, stock_store_name(v_from)
        USING ERRCODE = '22023';
    END IF;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id, 'name', v_item.name, 'unit', v_item.unit, 'quantity', v_qty, 'value', stock_issue_value(v_item.id, v_qty)));
  END LOOP;

  -- The practice's "On the way" place, made the first time stock is sent
  INSERT INTO stock_locations (practice_id, kind, name, created_by, updated_by)
  VALUES (v_practice, 'transit', 'On the way', auth.uid(), auth.uid())
  ON CONFLICT (practice_id) WHERE kind = 'transit' DO NOTHING;
  SELECT l.id INTO v_transit FROM stock_locations l WHERE l.practice_id = v_practice AND l.kind = 'transit';

  v_to_name := stock_store_name(v_to);
  v_number := stock_next_number(v_practice, 'TRF', v_today);
  INSERT INTO stock_transfers (practice_id, number, from_location_id, to_location_id, lines, notes, sent_by)
  VALUES (v_practice, v_number, v_from, v_to, v_clean, stock_text(p_payload, 'notes', 'The notes', 500), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'transfer_out', -(l ->> 'quantity')::integer, -(l ->> 'value')::numeric, v_today, v_number, v_id,
         v_from, left('Sent to ' || v_to_name, 300)
    FROM jsonb_array_elements(v_clean) AS l;
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_practice, (l ->> 'item_id')::uuid, 'transfer_in', (l ->> 'quantity')::integer, (l ->> 'value')::numeric, v_today, v_number, v_id,
         v_transit, left('On the way from ' || stock_store_name(v_from) || ' to ' || v_to_name, 300)
    FROM jsonb_array_elements(v_clean) AS l;
  RETURN jsonb_build_object('id', v_id, 'number', v_number);
END $$;

-- The stock arrives: off "On the way", into the receiving store, at the value it was sent at
CREATE OR REPLACE FUNCTION public.stock_receive_transfer(p_transfer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer stock_transfers%ROWTYPE;
  v_transit  uuid;
  v_today    date := ar_today();
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_transfer.practice_id, NULL, 'receive stock from another store');
  IF v_transfer.status <> 'sent' THEN
    RAISE EXCEPTION 'Transfer % is already %', v_transfer.number, v_transfer.status USING ERRCODE = '23514';
  END IF;
  SELECT l.id INTO v_transit FROM stock_locations l WHERE l.practice_id = v_transfer.practice_id AND l.kind = 'transit';
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_transfer.practice_id, (l ->> 'item_id')::uuid, 'transfer_out', -(l ->> 'quantity')::integer, -(l ->> 'value')::numeric, v_today,
         v_transfer.number, v_transfer.id, v_transit, left('Arrived in ' || stock_store_name(v_transfer.to_location_id), 300)
    FROM jsonb_array_elements(v_transfer.lines) AS l;
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_transfer.practice_id, (l ->> 'item_id')::uuid, 'transfer_in', (l ->> 'quantity')::integer, (l ->> 'value')::numeric, v_today,
         v_transfer.number, v_transfer.id, v_transfer.to_location_id, left('Received from ' || stock_store_name(v_transfer.from_location_id), 300)
    FROM jsonb_array_elements(v_transfer.lines) AS l;
  UPDATE stock_transfers SET status = 'received', closed_at = now(), received_by = auth.uid(), received_at = now() WHERE id = v_transfer.id;
  RETURN jsonb_build_object('id', v_transfer.id, 'number', v_transfer.number, 'received', true);
END $$;

-- Nothing arrived (or it was sent by mistake): the stock goes back to the store it left
CREATE OR REPLACE FUNCTION public.stock_cancel_transfer(p_transfer_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_transfer stock_transfers%ROWTYPE;
  v_transit  uuid;
  v_today    date := ar_today();
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_transfer.practice_id, NULL, 'cancel a transfer');
  IF v_transfer.status <> 'sent' THEN
    RAISE EXCEPTION 'Transfer % is already %', v_transfer.number, v_transfer.status USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the transfer is cancelled (it is kept with it)' USING ERRCODE = '22023';
  END IF;
  SELECT l.id INTO v_transit FROM stock_locations l WHERE l.practice_id = v_transfer.practice_id AND l.kind = 'transit';
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_transfer.practice_id, (l ->> 'item_id')::uuid, 'transfer_out', -(l ->> 'quantity')::integer, -(l ->> 'value')::numeric, v_today,
         v_transfer.number, v_transfer.id, v_transit, left('Cancelled: ' || btrim(p_reason), 300)
    FROM jsonb_array_elements(v_transfer.lines) AS l;
  INSERT INTO stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, transfer_id, location_id, reason)
  SELECT v_transfer.practice_id, (l ->> 'item_id')::uuid, 'transfer_in', (l ->> 'quantity')::integer, (l ->> 'value')::numeric, v_today,
         v_transfer.number, v_transfer.id, v_transfer.from_location_id, left('Back: transfer cancelled (' || btrim(p_reason) || ')', 300)
    FROM jsonb_array_elements(v_transfer.lines) AS l;
  UPDATE stock_transfers SET status = 'cancelled', closed_at = now(), cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = btrim(p_reason)
   WHERE id = v_transfer.id;
  RETURN jsonb_build_object('id', v_transfer.id, 'number', v_transfer.number, 'cancelled', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Supplier details: a postal address for statements (stock_save_supplier as live, with the address)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.stock_suppliers
  ADD COLUMN IF NOT EXISTS postal_address text CHECK (postal_address IS NULL OR char_length(postal_address) <= 300);

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
    INSERT INTO stock_suppliers (practice_id, name, contact_name, phone, email, account_number, vat_number, payment_terms_days, notes, created_by, updated_by,
                                 postal_address)
    VALUES (v_practice, v_name, stock_text(p_payload, 'contact_name', 'The contact name', 120), stock_text(p_payload, 'phone', 'The phone number', 40),
            stock_text(p_payload, 'email', 'The email address', 160), stock_text(p_payload, 'account_number', 'The account number', 60),
            stock_text(p_payload, 'vat_number', 'The VAT number', 40), v_terms, stock_text(p_payload, 'notes', 'The notes', 500), auth.uid(), auth.uid(),
            stock_text(p_payload, 'postal_address', 'The postal address', 300))
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
           postal_address = stock_text(p_payload, 'postal_address', 'The postal address', 300),
           is_active = COALESCE((p_payload ->> 'is_active')::boolean, true),
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. The creditors ledger: payments to suppliers and what each payment (or credit for returned stock) paid
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_supplier_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  supplier_id     uuid NOT NULL REFERENCES public.stock_suppliers(id) ON DELETE RESTRICT,
  number          text NOT NULL,
  paid_on         date NOT NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  -- The same choices as Settings > Practice Overhead
  method          text NOT NULL CHECK (method IN ('bank_transfer', 'debit_order', 'credit_card', 'cash', 'cheque', 'other')),
  -- The bank's or the supplier's reference
  reference       text CHECK (reference IS NULL OR char_length(reference) <= 60),
  notes           text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  CONSTRAINT stock_supplier_payments_number_key UNIQUE (practice_id, number),
  CONSTRAINT stock_supplier_payments_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND char_length(btrim(COALESCE(reversal_reason, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS stock_supplier_payments_supplier_idx ON public.stock_supplier_payments (supplier_id, paid_on);
CREATE INDEX IF NOT EXISTS stock_supplier_payments_practice_idx ON public.stock_supplier_payments (practice_id, paid_on);
COMMENT ON TABLE public.stock_supplier_payments IS 'Payments to suppliers (PAY numbers). Reversed with a reason, never changed. What each paid is in stock_supplier_allocations.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_supplier_payments;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('reversed_at,reversed_by,reversal_reason', '');
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_supplier_payments;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_supplier_payments
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

CREATE TABLE IF NOT EXISTS public.stock_supplier_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  supplier_id     uuid NOT NULL REFERENCES public.stock_suppliers(id) ON DELETE RESTRICT,
  -- The supplier invoice paid: a delivery received on account
  invoice_id      uuid NOT NULL REFERENCES public.stock_deliveries(id) ON DELETE RESTRICT,
  -- Paid by a payment, or by the credit for stock returned to the supplier (exactly one)
  payment_id      uuid REFERENCES public.stock_supplier_payments(id) ON DELETE RESTRICT,
  credit_id       uuid REFERENCES public.stock_deliveries(id) ON DELETE RESTRICT,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  -- This allocation paid the invoice in full and marked its payable paid in Finance
  closed_payable  boolean NOT NULL DEFAULT false,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  CONSTRAINT stock_supplier_allocations_one_source CHECK ((payment_id IS NULL) <> (credit_id IS NULL)),
  CONSTRAINT stock_supplier_allocations_reversal_complete CHECK (
    (reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND char_length(btrim(COALESCE(reversal_reason, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS stock_supplier_allocations_invoice_idx ON public.stock_supplier_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS stock_supplier_allocations_payment_idx ON public.stock_supplier_allocations (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_supplier_allocations_credit_idx ON public.stock_supplier_allocations (credit_id) WHERE credit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_supplier_allocations_supplier_idx ON public.stock_supplier_allocations (supplier_id);
COMMENT ON TABLE public.stock_supplier_allocations IS
  'Which supplier invoice each payment, or credit for stock returned, paid and how much. Released (reversed) when the payment, the credit or the invoice is reversed.';

DROP TRIGGER IF EXISTS stock_20_history ON public.stock_supplier_allocations;
CREATE TRIGGER stock_20_history BEFORE UPDATE OR DELETE ON public.stock_supplier_allocations
  FOR EACH ROW EXECUTE FUNCTION public.stock_history_guard('reversed_at,reversed_by,reversal_reason', '');
DROP TRIGGER IF EXISTS stock_99_no_truncate ON public.stock_supplier_allocations;
CREATE TRIGGER stock_99_no_truncate BEFORE TRUNCATE ON public.stock_supplier_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION public.stock_no_truncate();

-- What a supplier invoice still owes: nothing once reversed or its payable is marked paid (in the ledger or in
-- Settings > Practice Overhead), else its total less what is allocated to it
CREATE OR REPLACE FUNCTION public.stock_supplier_invoice_owed(p_invoice_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
           WHEN d.kind <> 'received' OR NOT d.on_account OR d.reversed_at IS NOT NULL THEN 0
           WHEN lower(COALESCE(e.status, '')) = 'paid' THEN 0
           ELSE GREATEST(d.total_incl_vat - COALESCE((SELECT SUM(a.amount) FROM stock_supplier_allocations a
                                                        WHERE a.invoice_id = d.id AND a.reversed_at IS NULL), 0), 0)
         END
    FROM stock_deliveries d
    LEFT JOIN practice_expenses e ON e.id = d.expense_id
   WHERE d.id = p_invoice_id
$$;

-- Releases the standing allocations of a payment (p_payment_id), or to or from a delivery (p_delivery_id), and puts
-- back to "pending" each payable they had marked paid that is no longer paid in full. Returns how many were released.
CREATE OR REPLACE FUNCTION public.stock_supplier_release(p_payment_id uuid, p_delivery_id uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoices uuid[];
  v_count    integer;
BEGIN
  WITH released AS (
    UPDATE stock_supplier_allocations a
       SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = left(btrim(p_reason), 300)
     WHERE a.reversed_at IS NULL
       AND ((p_payment_id IS NOT NULL AND a.payment_id = p_payment_id)
            OR (p_delivery_id IS NOT NULL AND (a.invoice_id = p_delivery_id OR a.credit_id = p_delivery_id)))
    RETURNING a.invoice_id
  )
  SELECT array_agg(DISTINCT r.invoice_id), count(*) INTO v_invoices, v_count FROM released r;

  IF v_count > 0 THEN
    UPDATE practice_expenses e
       SET status = 'pending', paid_date = NULL, updated_by = auth.uid()
      FROM stock_deliveries d
     WHERE d.id = ANY (v_invoices) AND e.id = d.expense_id AND d.reversed_at IS NULL
       AND lower(COALESCE(e.status, '')) = 'paid'
       AND EXISTS (SELECT 1 FROM stock_supplier_allocations a WHERE a.invoice_id = d.id AND a.closed_payable)
       AND COALESCE((SELECT SUM(a.amount) FROM stock_supplier_allocations a WHERE a.invoice_id = d.id AND a.reversed_at IS NULL), 0) < d.total_incl_vat;
  END IF;
  RETURN COALESCE(v_count, 0);
END $$;

/*
  stock_pay_supplier({"practice_id", "supplier_id", "paid_on"?, "amount" (N$; 0 when credits alone pay), "method",
    "reference"?, "notes"?, "invoice_ids": [the supplier invoices (deliveries) to pay], "use_credits"? (default true)})
  Practice admins and doctors. The invoices are paid oldest first, by credits not used yet (stock returned, earlier
  payments) and then this payment; what the payment does not need stays on account. An invoice paid in full marks its
  payable paid (Finance > Ledgers > Expenses). Returns {id, number, allocated, credits_used, on_account}.
*/
CREATE OR REPLACE FUNCTION public.stock_pay_supplier(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice     uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier     stock_suppliers%ROWTYPE;
  v_amount       numeric := CASE WHEN jsonb_typeof(p_payload -> 'amount') = 'number'
                                 THEN stock_amount(p_payload -> 'amount', 'The amount paid', 100000000) ELSE 0 END;
  v_date         date := COALESCE(NULLIF(p_payload ->> 'paid_on', '')::date, ar_today());
  v_method       text := COALESCE(NULLIF(p_payload ->> 'method', ''), 'bank_transfer');
  v_use_credits  boolean := COALESCE((p_payload ->> 'use_credits')::boolean, true);
  v_requested    uuid[];
  v_invoice      record;
  v_source       record;
  v_owed         numeric;
  v_take         numeric;
  v_left         numeric;
  v_payment      uuid;
  v_number       text;
  v_allocated    numeric := 0;
  v_credits_used numeric := 0;
BEGIN
  PERFORM stock_assert_role(v_practice, ARRAY['admin', 'doctor'], 'pay suppliers');
  -- One payment at a time per supplier, so two people cannot pay the same invoice
  SELECT * INTO v_supplier FROM stock_suppliers WHERE id = NULLIF(p_payload ->> 'supplier_id', '')::uuid AND practice_id = v_practice FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the supplier you paid' USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('bank_transfer', 'debit_order', 'credit_card', 'cash', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Choose how it was paid' USING ERRCODE = '22023';
  END IF;
  IF v_date > ar_today() THEN
    RAISE EXCEPTION 'A payment cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'invoice_ids' AND jsonb_typeof(p_payload -> 'invoice_ids') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Send the invoices to pay as a list' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x.value::uuid), ARRAY[]::uuid[]) INTO v_requested
    FROM jsonb_array_elements_text(COALESCE(p_payload -> 'invoice_ids', '[]'::jsonb)) AS x(value);
  IF EXISTS (SELECT 1 FROM unnest(v_requested) AS r(id)
              WHERE NOT EXISTS (SELECT 1 FROM stock_deliveries d
                                 WHERE d.id = r.id AND d.practice_id = v_practice AND d.supplier_id = v_supplier.id
                                   AND d.kind = 'received' AND d.on_account AND d.reversed_at IS NULL)
                 OR stock_supplier_invoice_owed(r.id) <= 0) THEN
    RAISE EXCEPTION 'One of the invoices is not an unpaid invoice of %. Reload the account and try again.', v_supplier.name USING ERRCODE = '22023';
  END IF;
  IF v_amount = 0 AND cardinality(v_requested) = 0 THEN
    RAISE EXCEPTION 'Type the amount paid' USING ERRCODE = '22023';
  END IF;

  IF v_amount > 0 THEN
    v_number := stock_next_number(v_practice, 'PAY', v_date);
    INSERT INTO stock_supplier_payments (practice_id, supplier_id, number, paid_on, amount, method, reference, notes, created_by)
    VALUES (v_practice, v_supplier.id, v_number, v_date, v_amount, v_method, stock_text(p_payload, 'reference', 'The reference', 60),
            stock_text(p_payload, 'notes', 'The notes', 500), auth.uid())
    RETURNING id INTO v_payment;
  END IF;

  -- The chosen invoices, oldest first: credits not used yet (when asked), then this payment
  FOR v_invoice IN
    SELECT d.id, d.expense_id FROM stock_deliveries d WHERE d.id = ANY (v_requested)
     ORDER BY d.document_date, d.created_at, d.id
  LOOP
    v_owed := stock_supplier_invoice_owed(v_invoice.id);
    IF v_use_credits THEN
      FOR v_source IN
        SELECT 'credit' AS source, c.id, c.document_date AS on_day, c.created_at,
               c.total_incl_vat - COALESCE((SELECT SUM(a.amount) FROM stock_supplier_allocations a WHERE a.credit_id = c.id AND a.reversed_at IS NULL), 0) AS left_over
          FROM stock_deliveries c
         WHERE c.practice_id = v_practice AND c.supplier_id = v_supplier.id AND c.kind = 'returned' AND c.reversed_at IS NULL
        UNION ALL
        SELECT 'payment', p.id, p.paid_on, p.created_at,
               p.amount - COALESCE((SELECT SUM(a.amount) FROM stock_supplier_allocations a WHERE a.payment_id = p.id AND a.reversed_at IS NULL), 0)
          FROM stock_supplier_payments p
         WHERE p.practice_id = v_practice AND p.supplier_id = v_supplier.id AND p.reversed_at IS NULL
           AND p.id IS DISTINCT FROM v_payment
         ORDER BY 3, 4
      LOOP
        EXIT WHEN v_owed <= 0;
        CONTINUE WHEN v_source.left_over <= 0;
        v_take := LEAST(v_owed, v_source.left_over);
        INSERT INTO stock_supplier_allocations (practice_id, supplier_id, invoice_id, payment_id, credit_id, amount, closed_payable, created_by)
        VALUES (v_practice, v_supplier.id, v_invoice.id,
                CASE WHEN v_source.source = 'payment' THEN v_source.id END, CASE WHEN v_source.source = 'credit' THEN v_source.id END,
                v_take, v_owed - v_take = 0, auth.uid());
        v_owed := v_owed - v_take;
        v_credits_used := v_credits_used + v_take;
      END LOOP;
    END IF;
    IF v_owed > 0 AND v_payment IS NOT NULL THEN
      v_left := v_amount - COALESCE((SELECT SUM(a.amount) FROM stock_supplier_allocations a WHERE a.payment_id = v_payment AND a.reversed_at IS NULL), 0);
      IF v_left > 0 THEN
        v_take := LEAST(v_owed, v_left);
        INSERT INTO stock_supplier_allocations (practice_id, supplier_id, invoice_id, payment_id, amount, closed_payable, created_by)
        VALUES (v_practice, v_supplier.id, v_invoice.id, v_payment, v_take, v_owed - v_take = 0, auth.uid());
        v_owed := v_owed - v_take;
        v_allocated := v_allocated + v_take;
      END IF;
    END IF;
    -- Paid in full: the payable in Finance is marked paid as well
    IF v_owed = 0 AND v_invoice.expense_id IS NOT NULL THEN
      UPDATE practice_expenses
         SET status = 'paid', paid_date = v_date, payment_method = v_method, updated_by = auth.uid()
       WHERE id = v_invoice.expense_id AND lower(COALESCE(status, '')) <> 'paid';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_payment, 'number', v_number, 'allocated', v_allocated, 'credits_used', v_credits_used,
                            'on_account', v_amount - v_allocated);
END $$;

-- Undo a payment captured by mistake: what it paid is owed again. Practice admins and doctors.
CREATE OR REPLACE FUNCTION public.stock_reverse_supplier_payment(p_payment_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment  stock_supplier_payments%ROWTYPE;
  v_released integer;
BEGIN
  SELECT * INTO v_payment FROM stock_supplier_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM stock_assert_role(v_payment.practice_id, ARRAY['admin', 'doctor'], 'reverse a payment to a supplier');
  IF v_payment.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION '% was already reversed', v_payment.number USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the payment is reversed (it is kept with it)' USING ERRCODE = '22023';
  END IF;
  UPDATE stock_supplier_payments SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason) WHERE id = v_payment.id;
  v_released := stock_supplier_release(v_payment.id, NULL, 'Payment ' || v_payment.number || ' reversed: ' || btrim(p_reason));
  RETURN jsonb_build_object('id', v_payment.id, 'number', v_payment.number, 'reversed', true, 'released', v_released);
END $$;

-- Reversing a delivery or a return releases what was paid against it (money paid for a reversed delivery becomes
-- credit with the supplier; invoices a reversed return had paid owe again)
CREATE OR REPLACE FUNCTION public.stock_delivery_reversed_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM stock_supplier_release(NULL, NEW.id, 'Reversed: ' || COALESCE(NULLIF(btrim(NEW.reversal_reason), ''), NEW.number));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_stock_supplier_release ON public.stock_deliveries;
CREATE TRIGGER zz_stock_supplier_release AFTER UPDATE OF reversed_at ON public.stock_deliveries
  FOR EACH ROW WHEN (OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL)
  EXECUTE FUNCTION public.stock_delivery_reversed_release();

-- ---------------------------------------------------------------------------------------------
-- 10. Row level security and grants: staff of the practice read (as on the other stock tables); writes only through
--     the functions
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['stock_locations', 'stock_transfers', 'stock_supplier_payments', 'stock_supplier_allocations'] LOOP
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

REVOKE ALL ON public.stock_location_levels FROM anon, authenticated;
GRANT SELECT ON public.stock_location_levels TO authenticated, service_role;

DO $$
DECLARE
  v_function text;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.stock_assert_store(uuid,uuid,text)', 'public.stock_store_for_branch(uuid,uuid)', 'public.stock_store_name(uuid)',
    'public.stock_movement_location()', 'public.stock_dispensing_location()', 'public.stock_start_count(uuid,text,text,uuid)',
    'public.stock_save_location(jsonb)', 'public.stock_send_transfer(jsonb)', 'public.stock_receive_transfer(uuid)',
    'public.stock_cancel_transfer(uuid,text)', 'public.stock_supplier_invoice_owed(uuid)', 'public.stock_supplier_release(uuid,uuid,text)',
    'public.stock_pay_supplier(jsonb)', 'public.stock_reverse_supplier_payment(uuid,text)', 'public.stock_delivery_reversed_release()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
  END LOOP;
  FOREACH v_function IN ARRAY ARRAY[
    'public.stock_start_count(uuid,text,text,uuid)', 'public.stock_save_location(jsonb)', 'public.stock_send_transfer(jsonb)',
    'public.stock_receive_transfer(uuid)', 'public.stock_cancel_transfer(uuid,text)', 'public.stock_pay_supplier(jsonb)',
    'public.stock_reverse_supplier_payment(uuid,text)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 11. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['stock_locations', 'stock_transfers', 'stock_supplier_payments', 'stock_supplier_allocations'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 12. Checks after: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_bad
    FROM (VALUES ('stock_locations'), ('stock_transfers'), ('stock_supplier_payments'), ('stock_supplier_allocations')) AS t(name)
   WHERE NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = format('public.%I', t.name)::regclass)
      OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.name AND p.policyname = t.name || '_staff_read')
      OR (to_regprocedure('public.portal_is_staff()') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.name AND p.policyname = 'portal_staff_only'
                            AND p.permissive = 'RESTRICTIVE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: row level security, the staff read policy or the patient-app guard is missing on %', v_bad;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname LIKE 'stock\_%' AND c.relkind IN ('r', 'v')
     AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE')
          OR has_table_privilege('authenticated', c.oid, 'DELETE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: these can be written by signed-in users or read with the public key: %', v_bad;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND left(p.proname, 6) = 'stock_'
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR (p.proname IN ('stock_movement_location', 'stock_dispensing_location', 'stock_supplier_release', 'stock_delivery_reversed_release',
                            'stock_supplier_invoice_owed', 'stock_assert_store', 'stock_store_for_branch', 'stock_store_name')
              AND has_function_privilege('authenticated', p.oid, 'EXECUTE')));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the public key (or signed-in users, for internal helpers) can run %', v_bad;
  END IF;

  IF to_regprocedure('public.stock_start_count(uuid,text,text)') IS NOT NULL OR to_regprocedure('public.stock_start_count(uuid,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Check failed: stock_start_count should take an optional store and have no 3-argument twin';
  END IF;

  SELECT string_agg(t.tbl || '.' || t.name, ', ') INTO v_bad
    FROM (VALUES ('stock_movements', 'stock_05_location'), ('stock_dispensings', 'stock_05_location'),
                 ('stock_deliveries', 'zz_stock_supplier_release'), ('stock_transfers', 'stock_20_history'),
                 ('stock_supplier_payments', 'stock_20_history'), ('stock_supplier_allocations', 'stock_20_history')) AS t(tbl, name)
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.' || t.tbl)::regclass AND g.tgname = t.name);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: triggers missing: %', v_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM stock_movements WHERE location_id IS NOT NULL OR transfer_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Check failed: movements recorded before this file must stay in the main store';
  END IF;
  IF EXISTS (SELECT 1 FROM practice_inventory i
              WHERE i.quantity <> COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.item_id = i.id), 0)
                AND EXISTS (SELECT 1 FROM stock_movements m WHERE m.item_id = i.id)) THEN
    RAISE EXCEPTION 'Check failed: an item''s quantity is not the sum of its movements';
  END IF;
END $$;

-- PostgREST: pick up the new tables, columns and functions
NOTIFY pgrst, 'reload schema';

ROLLBACK;
