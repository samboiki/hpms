-- Applied 2026-10-13 as migration consignment_supplier_ledger_2026_10_13 (version 20261013062229; stored statement md5 63e185858ba99f4e0057db639532d72e = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed first (one transaction ended by RAISE EXCEPTION, simulated logins; afterwards none of it existed). Before the
-- migration, with the old functions: a wholesaler with two invoices on account, a return and a part payment
-- (invoices=2 owed=112.50 credit=4.60 balance=107.90), and a frame supplier with an owned frame's invoice (345.00) whose
-- consignment invoice W8-CSG-OLD (460.00) was only a payable. After it: the wholesaler's figures were the same, string for
-- string (and again at the end); W8-CSG-OLD was on the frame supplier's account as CSG2026-0001 with the same payable,
-- date and total (owed 805.00); every other delivery kept consignment = false. Reception recorded the next invoice
-- (payable 460.00 due on the supplier's 60 days, the invoice on account, the line linked); the same number in another
-- case, a delivery's number, a settled line and tomorrow's date were refused (23505, 23505, 22023, 22023); reception could
-- not pay (42501). The admin paid it from the ledger (payable marked paid, nothing owed); reversing an unpaid consignment
-- invoice cancelled its payable and put its frame back to owed (recorded again under the same number); reversing the paid
-- one turned the payment into credit (460.00) and put its frame back. Another practice's doctor and a login without a staff
-- profile saw no rows and could not settle; nobody signed in could run the trigger's function; the public key read and
-- ran nothing (42501).
-- =============================================================================================
-- PROPOSAL: consignment supplier invoices in the supplier ledger, so what the practice owes a supplier is one figure
--           (parity L11 gap "Consignment invoices are payables, not yet in the supplier ageing"; L12, R24)
-- File:   proposals/2026-10-13-consignment-supplier-ledger.sql            Drafted: 2026-10-13
-- Code:   src/utils/stock/supplierLedger.ts (a consignment invoice is a supplier invoice: account, statement, age
--         analysis, Pay; tested), src/services/stock/supplierLedgerService.ts and stockService.ts (read the new column,
--         and read as before while it does not exist), src/components/stock/DeliveriesTab.tsx (the invoice says what
--         it is and points to its frames), src/components/optometry/ConsignmentView.tsx (the recorded invoice opens the
--         supplier's account)
--
-- Why
--   Settling consignment frames (Optometry > Reports > Consignment > Supplier's invoice) wrote only a payable in
--   practice_expenses. The supplier ledger (proposals/2026-10-13-stock-stores-and-suppliers.sql) reads the supplier
--   invoices from stock_deliveries received on account, so a consignment invoice was missing from the supplier's
--   account, its statement, the supplier age analysis and Pay: what the practice owed a frame supplier was two figures
--   in two places.
--
-- What it does
--   1. stock_counters: series CSG (a supplier invoice for consignment frames sold), added to the series it allows.
--   2. stock_deliveries.consignment (default false): the supplier's invoice for consignment frames sold. A supplier
--      invoice owed on account like a delivery's, with no stock received on it (the frames came in at no value);
--      always kind 'received'.
--   3. optometry_consignment_lines.supplier_invoice_id: that invoice. A line is settled exactly when it has one.
--   4. optometry_consignment_settle replaced: as before (the payable in Finance > Ledgers > Expenses, the lines settled,
--      the same total), and it also records the invoice as the supplier's CSG document on account with that payable.
--      An invoice number already recorded for the supplier (a delivery or consignment frames, not reversed) is refused,
--      and two people cannot settle the same lines at once. It returns the document's id and number as well.
--   5. Reversing a consignment invoice (Stock > Deliveries > "Captured by mistake? Reverse it": stock_reverse_delivery,
--      practice admins and doctors) puts its frames back to owed and not invoiced (trigger
--      zz_optometry_consignment_reversed). As for any delivery, a payable not yet paid is cancelled and what was paid
--      against the invoice becomes credit with the supplier.
--   6. Consignment invoices recorded before this file get their CSG document (same supplier, number, date, totals and
--      payable), so they are in the ledger too.
--   Nothing else changes: no ledger function (stock_supplier_invoice_owed, stock_pay_supplier, stock_supplier_release,
--   stock_reverse_supplier_payment, stock_reverse_delivery) and no policy. They treat a consignment invoice exactly as
--   a delivery's invoice, so every supplier without one keeps the same balance, statement and age analysis.
--
-- Rules (the same in src/utils/stock/supplierLedger.ts, tested)
--   - A consignment invoice owes its total (frames x the agreed cost, plus VAT per line) less what payments and credits
--     paid of it; nothing once its payable is marked paid (here or in Settings > Practice Overhead) or it is reversed.
--   - Paid in full from Stock > Suppliers > Pay, its payable is marked paid, as for a delivery's invoice.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; with tests before and after it, all in one
-- transaction that ends in RAISE EXCEPTION), then apply that part as one migration. Before it is applied the app works
-- as before: the ledger reads deliveries without the column and settling makes only the payable.
-- Undo (consignment invoices leave the ledger again; their payables stay in Finance):
--   DROP TRIGGER IF EXISTS zz_optometry_consignment_reversed ON public.stock_deliveries;
--   DROP FUNCTION IF EXISTS public.optometry_consignment_invoice_reversed();
--   Recreate optometry_consignment_settle from proposals/2026-10-13-optometry-frames-and-exam.sql section 6f;
--   ALTER TABLE public.optometry_consignment_lines DROP CONSTRAINT IF EXISTS optometry_consignment_lines_invoice_settled,
--     DROP COLUMN supplier_invoice_id;
--   ALTER TABLE public.stock_supplier_allocations DISABLE TRIGGER stock_20_history;
--   DELETE FROM public.stock_supplier_allocations a USING public.stock_deliveries d WHERE a.invoice_id = d.id AND d.consignment;
--   ALTER TABLE public.stock_supplier_allocations ENABLE TRIGGER stock_20_history;   (the payments stay, as credit)
--   ALTER TABLE public.stock_deliveries DISABLE TRIGGER stock_20_history;
--   DELETE FROM public.stock_deliveries WHERE consignment;
--   ALTER TABLE public.stock_deliveries ENABLE TRIGGER stock_20_history;
--   ALTER TABLE public.stock_deliveries DROP CONSTRAINT IF EXISTS stock_deliveries_consignment_shape, DROP COLUMN consignment;
--   (The CSG series may stay in stock_counters_series_check.)
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the supplier ledger and consignment are applied, and the settle function is as they left it
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
  v_def     text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.stock_deliveries'), ('public.stock_supplier_allocations'), ('public.stock_supplier_payments'),
                 ('public.stock_counters'), ('public.optometry_consignment_lines'), ('public.practice_expenses')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply proposals/2026-10-13-stock-stores-and-suppliers.sql and proposals/2026-10-13-optometry-frames-and-exam.sql first.', v_missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.stock_deliveries'::regclass AND attname = 'on_account' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Stopped: stock_deliveries.on_account is missing. Apply proposals/2026-10-13-stock-stores-and-suppliers.sql first.';
  END IF;
  IF to_regprocedure('public.optometry_consignment_settle(jsonb)') IS NULL OR to_regprocedure('public.stock_next_number(uuid,text,date)') IS NULL
     OR to_regprocedure('public.stock_assert_role(uuid,text[],text)') IS NULL OR to_regprocedure('public.stock_reverse_delivery(uuid,text)') IS NULL
     OR to_regprocedure('public.stock_supplier_invoice_owed(uuid)') IS NULL OR to_regprocedure('public.optometry_today()') IS NULL
     OR to_regprocedure('public.optometry_actor()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: the stock, supplier ledger or consignment functions are missing';
  END IF;
  v_def := pg_get_functiondef('public.optometry_consignment_settle(jsonb)'::regprocedure);
  IF md5(v_def) <> '3fa089fddf7d0dbeabbd0354f7b1605f' AND position('supplier_invoice_id' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Stopped: optometry_consignment_settle changed since 2026-10-13 (merge this file''s version with it by hand)';
  END IF;
  -- A settled line needs its supplier to be put on the supplier's account
  IF EXISTS (SELECT 1 FROM public.optometry_consignment_lines l WHERE l.settled_at IS NOT NULL AND l.supplier_id IS NULL) THEN
    RAISE EXCEPTION 'Stopped: some settled consignment lines have no supplier any more; name it on those lines first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Document numbers: CSG (a supplier invoice for consignment frames sold), added to the series the counter allows
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_series text[];
BEGIN
  SELECT array_agg(DISTINCT s.series ORDER BY s.series) INTO v_series
    FROM (SELECT (regexp_matches(pg_get_constraintdef(c.oid), '''([A-Z]+)''', 'g'))[1] AS series
            FROM pg_constraint c
           WHERE c.conrelid = 'public.stock_counters'::regclass AND c.conname = 'stock_counters_series_check'
          UNION SELECT 'CSG') s;
  ALTER TABLE public.stock_counters DROP CONSTRAINT IF EXISTS stock_counters_series_check;
  -- Written as ARRAY['CNT'::text, ...] (as the stock files wrote it), so the next file can read the list the same way
  EXECUTE format('ALTER TABLE public.stock_counters ADD CONSTRAINT stock_counters_series_check CHECK (series = ANY (ARRAY[%s]))',
                 (SELECT string_agg(quote_literal(s) || '::text', ', ') FROM unnest(v_series) AS s));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. The supplier invoice for consignment frames sold is a supplier document like a delivery's invoice
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.stock_deliveries ADD COLUMN IF NOT EXISTS consignment boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.stock_deliveries.consignment IS
  'A supplier''s invoice for consignment frames sold (optometry_consignment_settle, CSG numbers): owed on account like a delivery''s invoice, with no stock received on it (the frames came in at no value). Its frames are the optometry_consignment_lines with this supplier_invoice_id.';
ALTER TABLE public.stock_deliveries DROP CONSTRAINT IF EXISTS stock_deliveries_consignment_shape;
ALTER TABLE public.stock_deliveries ADD CONSTRAINT stock_deliveries_consignment_shape CHECK (NOT consignment OR kind = 'received');

-- ---------------------------------------------------------------------------------------------
-- 3. Each settled consignment line names the supplier invoice that settled it
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.optometry_consignment_lines ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_consignment_lines'::regclass
                    AND conname = 'optometry_consignment_lines_supplier_invoice_id_fkey') THEN
    ALTER TABLE public.optometry_consignment_lines ADD CONSTRAINT optometry_consignment_lines_supplier_invoice_id_fkey
      FOREIGN KEY (supplier_invoice_id) REFERENCES public.stock_deliveries(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS optometry_consignment_lines_supplier_invoice_idx
  ON public.optometry_consignment_lines (supplier_invoice_id) WHERE supplier_invoice_id IS NOT NULL;
COMMENT ON COLUMN public.optometry_consignment_lines.supplier_invoice_id IS
  'The supplier''s invoice that settled the line: a stock_deliveries row with consignment = true, in the supplier ledger. (invoice_id is the patient''s invoice the frame was sold on.)';

-- ---------------------------------------------------------------------------------------------
-- 4. optometry_consignment_settle({practice_id, supplier_id, supplier_reference, document_date?, line_ids}): the
--    supplier's invoice for consignment frames sold becomes its payable (Finance > Ledgers > Expenses) and a CSG
--    document on the supplier's account, and the lines are settled. Any staff member (as before).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.optometry_consignment_settle(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier public.stock_suppliers;
  v_reference text := NULLIF(btrim(COALESCE(p_payload ->> 'supplier_reference', '')), '');
  v_date date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, public.optometry_today());
  v_ids uuid[] := ARRAY(SELECT DISTINCT NULLIF(x, '')::uuid FROM jsonb_array_elements_text(COALESCE(p_payload -> 'line_ids', '[]'::jsonb)) AS x WHERE NULLIF(x, '') IS NOT NULL);
  v_found integer;
  v_frames integer;
  v_excl numeric;
  v_vat numeric;
  v_total numeric;
  v_expense uuid;
  v_number text;
  v_invoice uuid;
BEGIN
  PERFORM public.stock_assert_role(v_practice, NULL, 'record supplier invoices');
  SELECT * INTO v_supplier FROM public.stock_suppliers WHERE id = NULLIF(p_payload ->> 'supplier_id', '')::uuid AND practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the supplier' USING ERRCODE = '22023';
  END IF;
  IF v_reference IS NULL OR char_length(v_reference) > 60 THEN
    RAISE EXCEPTION 'Type the number on the supplier''s invoice (up to 60 characters)' USING ERRCODE = '22023';
  END IF;
  IF v_date > public.optometry_today() THEN
    RAISE EXCEPTION 'The invoice cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  -- A supplier invoice is recorded once: on a delivery or for consignment frames (a reversed one does not count)
  IF EXISTS (SELECT 1 FROM public.stock_deliveries d WHERE d.practice_id = v_practice AND d.supplier_id = v_supplier.id AND d.kind = 'received'
                AND lower(btrim(d.supplier_reference)) = lower(v_reference) AND d.reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Invoice % from % is already recorded', v_reference, v_supplier.name USING ERRCODE = '23505';
  END IF;
  -- Two people settling the same lines at once: the second waits here, then finds them settled
  PERFORM 1 FROM public.optometry_consignment_lines l WHERE l.id = ANY (v_ids) FOR UPDATE;
  SELECT count(*), COALESCE(SUM(l.quantity), 0), COALESCE(SUM(l.quantity * l.cost_each), 0),
         COALESCE(SUM(round(l.quantity * l.cost_each * l.vat_rate / 100, 2)), 0)
    INTO v_found, v_frames, v_excl, v_vat
    FROM public.optometry_consignment_lines l
   WHERE l.id = ANY (v_ids) AND l.practice_id = v_practice AND l.supplier_id = v_supplier.id AND l.settled_at IS NULL;
  IF cardinality(v_ids) = 0 OR v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Choose lines of this supplier that are not settled yet' USING ERRCODE = '22023';
  END IF;
  v_total := v_excl + v_vat;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Nothing is owed on these lines' USING ERRCODE = '22023';
  END IF;
  IF v_excl < 0 OR v_vat < 0 THEN
    RAISE EXCEPTION 'These lines do not make an invoice: choose the frames sold that the supplier''s invoice is for' USING ERRCODE = '22023';
  END IF;
  v_number := public.stock_next_number(v_practice, 'CSG', v_date);
  INSERT INTO public.practice_expenses (practice_id, expense_type, expense_category, name, description, amount, currency, payment_frequency,
                                        vendor_name, vendor_contact, account_number, expense_date, due_date, status, is_recurring, is_active,
                                        created_by, updated_by)
  VALUES (v_practice, 'supplies', 'one_time', left('Consignment frames sold, from ' || v_supplier.name, 255),
          'Supplier invoice ' || v_reference || ' for ' || v_frames || ' consignment frame(s) sold. Recorded by Optometry > Reports > Consignment ('
            || v_number || ').',
          v_total, 'NAD', 'once_off', left(v_supplier.name, 255), left(COALESCE(v_supplier.phone, v_supplier.email), 255),
          left(v_supplier.account_number, 255), v_date, v_date + v_supplier.payment_terms_days, 'pending', false, true,
          auth.uid(), auth.uid())
  RETURNING id INTO v_expense;
  -- On the supplier's account (the supplier ledger), owed until paid, like a delivery's invoice
  INSERT INTO public.stock_deliveries (practice_id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount,
                                       total_incl_vat, expense_id, notes, created_by, on_account, consignment)
  VALUES (v_practice, v_number, 'received', v_supplier.id, v_reference, v_date, v_excl, v_vat, v_total, v_expense,
          v_frames || ' consignment frame(s) sold', auth.uid(), true, true)
  RETURNING id INTO v_invoice;
  UPDATE public.optometry_consignment_lines l
     SET settled_at = now(), settled_by = public.optometry_actor(), expense_id = v_expense, supplier_reference = v_reference,
         supplier_invoice_id = v_invoice
   WHERE l.id = ANY (v_ids);
  RETURN jsonb_build_object('expense_id', v_expense, 'total_incl_vat', v_total, 'frames', v_frames, 'id', v_invoice, 'number', v_number);
END $$;

REVOKE ALL ON FUNCTION public.optometry_consignment_settle(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optometry_consignment_settle(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. A consignment invoice reversed (captured by mistake): its frames are owed again and not invoiced. Runs after
--    stock_reverse_delivery marks it reversed (that function cancels a payable not yet paid; zz_stock_supplier_release
--    turns what was paid against it into credit with the supplier).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.optometry_consignment_invoice_reversed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.optometry_consignment_lines l
     SET settled_at = NULL, settled_by = NULL, expense_id = NULL, supplier_reference = NULL, supplier_invoice_id = NULL
   WHERE l.supplier_invoice_id = NEW.id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_optometry_consignment_reversed ON public.stock_deliveries;
CREATE TRIGGER zz_optometry_consignment_reversed AFTER UPDATE OF reversed_at ON public.stock_deliveries
  FOR EACH ROW WHEN (NEW.consignment AND OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL)
  EXECUTE FUNCTION public.optometry_consignment_invoice_reversed();

REVOKE ALL ON FUNCTION public.optometry_consignment_invoice_reversed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.optometry_consignment_invoice_reversed() TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Consignment invoices recorded before this file: their CSG document on the supplier's account (one per invoice:
--    the supplier and its invoice number; the settle function never recorded a number twice for a supplier)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_group   record;
  v_date    date;
  v_number  text;
  v_invoice uuid;
BEGIN
  FOR v_group IN
    SELECT l.practice_id, l.supplier_id, lower(btrim(l.supplier_reference)) AS reference_key, min(btrim(l.supplier_reference)) AS reference,
           (array_agg(l.expense_id ORDER BY l.settled_at) FILTER (WHERE l.expense_id IS NOT NULL))[1] AS expense_id,
           min(l.settled_at) AS settled_at,
           (array_agg(l.settled_by ORDER BY l.settled_at) FILTER (WHERE l.settled_by IS NOT NULL))[1] AS settled_by,
           SUM(l.quantity)::integer AS frames,
           SUM(l.quantity * l.cost_each) AS excl,
           SUM(round(l.quantity * l.cost_each * l.vat_rate / 100, 2)) AS vat
      FROM public.optometry_consignment_lines l
     WHERE l.settled_at IS NOT NULL AND l.supplier_invoice_id IS NULL AND l.supplier_id IS NOT NULL
     GROUP BY l.practice_id, l.supplier_id, lower(btrim(l.supplier_reference))
     ORDER BY min(l.settled_at)
  LOOP
    IF v_group.excl < 0 OR v_group.vat < 0 THEN
      RAISE EXCEPTION 'Stopped: consignment invoice % adds up to less than nothing (excl % VAT %); correct its lines by hand first',
        v_group.reference, v_group.excl, v_group.vat;
    END IF;
    SELECT e.expense_date INTO v_date FROM public.practice_expenses e WHERE e.id = v_group.expense_id;
    v_date := COALESCE(v_date, (v_group.settled_at AT TIME ZONE 'Africa/Windhoek')::date);
    v_number := public.stock_next_number(v_group.practice_id, 'CSG', v_date);
    INSERT INTO public.stock_deliveries (practice_id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount,
                                         total_incl_vat, expense_id, notes, created_by, created_at, on_account, consignment)
    VALUES (v_group.practice_id, v_number, 'received', v_group.supplier_id, v_group.reference, v_date, v_group.excl, v_group.vat,
            v_group.excl + v_group.vat, v_group.expense_id, v_group.frames || ' consignment frame(s) sold', v_group.settled_by,
            v_group.settled_at, v_group.expense_id IS NOT NULL, true)
    RETURNING id INTO v_invoice;
    UPDATE public.optometry_consignment_lines l
       SET supplier_invoice_id = v_invoice
     WHERE l.practice_id = v_group.practice_id AND l.supplier_id = v_group.supplier_id AND l.settled_at IS NOT NULL
       AND l.supplier_invoice_id IS NULL AND lower(btrim(l.supplier_reference)) = v_group.reference_key;
  END LOOP;
END $$;

-- A line is settled exactly when it names its supplier invoice
ALTER TABLE public.optometry_consignment_lines DROP CONSTRAINT IF EXISTS optometry_consignment_lines_invoice_settled;
ALTER TABLE public.optometry_consignment_lines ADD CONSTRAINT optometry_consignment_lines_invoice_settled
  CHECK ((settled_at IS NULL) = (supplier_invoice_id IS NULL));

-- ---------------------------------------------------------------------------------------------
-- 7. Checks after: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_counters_series_check'
                    AND pg_get_constraintdef(oid) LIKE '%''CSG''%' AND pg_get_constraintdef(oid) LIKE '%''GRV''%'
                    AND pg_get_constraintdef(oid) LIKE '%''PAY''%' AND pg_get_constraintdef(oid) LIKE '%''TRF''%') THEN
    RAISE EXCEPTION 'Check failed: the CSG series (with the earlier ones) is not allowed by stock_counters';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.stock_deliveries'::regclass AND tgname = 'zz_optometry_consignment_reversed')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.stock_deliveries'::regclass AND tgname = 'zz_stock_supplier_release') THEN
    RAISE EXCEPTION 'Check failed: a trigger on stock_deliveries is missing';
  END IF;
  IF has_function_privilege('anon', 'public.optometry_consignment_settle(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.optometry_consignment_settle(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.optometry_consignment_invoice_reversed()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.optometry_consignment_invoice_reversed()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: who may run the settle function or the reversal trigger''s function';
  END IF;
  -- Every settled line is on a consignment invoice of its own supplier, and every consignment invoice not reversed
  -- adds up to its lines
  SELECT string_agg(l.id::text, ', ') INTO v_bad
    FROM public.optometry_consignment_lines l
    LEFT JOIN public.stock_deliveries d ON d.id = l.supplier_invoice_id
   WHERE l.settled_at IS NOT NULL
     AND (d.id IS NULL OR NOT d.consignment OR d.supplier_id IS DISTINCT FROM l.supplier_id OR d.practice_id <> l.practice_id
          OR d.reversed_at IS NOT NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: settled consignment lines without their supplier invoice: %', v_bad;
  END IF;
  SELECT string_agg(d.number, ', ') INTO v_bad
    FROM public.stock_deliveries d
   CROSS JOIN LATERAL (SELECT COALESCE(SUM(l.quantity * l.cost_each), 0) AS excl,
                              COALESCE(SUM(round(l.quantity * l.cost_each * l.vat_rate / 100, 2)), 0) AS vat
                         FROM public.optometry_consignment_lines l WHERE l.supplier_invoice_id = d.id) s
   WHERE d.consignment AND d.reversed_at IS NULL AND (d.total_excl_vat <> s.excl OR d.vat_amount <> s.vat);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: consignment invoices that do not add up to their frames: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM public.stock_deliveries d WHERE d.consignment AND (d.kind <> 'received'
               OR EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.delivery_id = d.id))) THEN
    RAISE EXCEPTION 'Check failed: a consignment invoice is a return or moved stock';
  END IF;
END $$;

-- PostgREST: pick up the new columns
NOTIFY pgrst, 'reload schema';

ROLLBACK;
