-- Applied 2026-10-07 as migration quotes_and_bundles_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: quotes (treatment estimates) and code bundles ("macros")
-- File:    proposals/2026-10-07-quotes-and-bundles.sql                Drafted: 2026-10-07
-- Code:    src/components/quotes/* (billingLines.ts, bundles.ts, quotes.ts: the tested rules;
--          quoteService.ts: reads and writes; BundleMenu, BundleManager, Quote* screens)
-- Screens: visit billing tabs ("Code bundles"), patient file > Billing > Quotes, Finance > Quotes
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review. Run it on a Supabase branch (or a copy of the database) with the final ROLLBACK
--      changed to COMMIT. Then check in the app:
--        - a visit's Billing tab > "Code bundles" > "Manage bundles": add a starter suggestion,
--          review its codes and save it; use it on a visit (8109, 8110 and 8145 appear once);
--        - a patient's file > Billing > Quotes > "New quote": add codes and a bundle, save, print,
--          accept, then "Convert to invoice" for a visit without an invoice;
--        - Finance > Quotes lists the practice's quotes.
--      Until this script is applied those screens show "Quotes are not switched on yet" and change
--      nothing; the visit screens work exactly as before.
--   2. Apply to production the same way (one transaction; it only adds objects).
--   3. If the patient portal proposal (2026-10-07-patient-portal.sql) is applied, this script also
--      re-runs portal_apply_staff_guard() at the end so patient-app logins cannot read the new tables.
--
-- Contents
--   0. Shared trigger function for updated_at / updated_by
--   1. billing_code_bundles and billing_code_bundle_lines (no price column, on purpose)
--   2. save_code_bundle(): a bundle and its lines in one call
--   3. Quote numbering per practice: quote_number_counters + quotes_assign_number()
--   4. quotes: header, status, validity, medical aid estimate, pre-authorisation, links to the invoice
--   5. quote_lines: priced lines with tooth numbers and the estimate per line
--   6. Guards: status changes, what may change in which status, practice consistency
--   7. save_quote(): a quote and all its lines in one call; totals are always the sum of the lines
--   8. RLS (same rule as existing tables: the user's practice in public.users) and grants
--
-- Rules the database enforces (the app enforces them too; tests in src/components/quotes/__tests__)
--   - Bundles hold codes, quantities, optional tooth and note: never a price. Prices come from the
--     tariffs in effect when the bundle is used, so tariff increases reach every bundle.
--   - A quote line's total is unit price x quantity rounded to the cent (the computeLine rule), and its
--     medical aid estimate plus patient estimate equals its total. The quote's totals are the sums.
--   - Status changes: draft -> sent / accepted / declined / expired; sent -> draft (edited) / sent /
--     accepted / declined / expired; accepted -> converted / declined; declined / expired -> draft;
--     converted is final. Lines change only while the quote is draft or sent.
--   - A converted quote names its invoice, and that invoice belongs to the same patient and practice.
--   - Only drafts can be deleted; sent and answered quotes stay as records.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. updated_at / updated_by on every change of a bundle (quotes do this in quotes_guard)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.billing_code_bundles_touch_audit()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 1. Code bundles
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.billing_code_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  colour text NOT NULL DEFAULT 'cyan'
    CHECK (colour IN ('cyan', 'teal', 'emerald', 'amber', 'orange', 'rose', 'violet', 'indigo', 'slate')),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  sort_order integer NOT NULL DEFAULT 0,
  -- The starter suggestion it was made from (src/components/quotes/bundles.ts), if any
  preset_key text CHECK (preset_key IS NULL OR char_length(preset_key) <= 60),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.billing_code_bundles IS
  'Practice-defined sets of tariff codes added to a visit or quote in one click. No prices: lines are priced from the tariffs in effect when used.';

-- One name per practice, ignoring case and outer spaces
CREATE UNIQUE INDEX IF NOT EXISTS billing_code_bundles_practice_name_key
  ON public.billing_code_bundles (practice_id, lower(btrim(name)));

DROP TRIGGER IF EXISTS billing_code_bundles_touch_audit ON public.billing_code_bundles;
CREATE TRIGGER billing_code_bundles_touch_audit
  BEFORE UPDATE ON public.billing_code_bundles
  FOR EACH ROW EXECUTE FUNCTION public.billing_code_bundles_touch_audit();

CREATE TABLE IF NOT EXISTS public.billing_code_bundle_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.billing_code_bundles(id) ON DELETE CASCADE,
  -- Copied from the bundle by the trigger below (kept for RLS); a client value is ignored
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 30),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9./-]{1,20}$'),
  quantity numeric(6,2) NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  -- A tooth that is always the same for this bundle (FDI); usually empty and asked for when used
  tooth_number text CHECK (tooth_number IS NULL OR tooth_number ~ '^([1-4][1-8]|[5-8][1-5])$'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_code_bundle_lines_line_key UNIQUE (bundle_id, line_no)
  -- Deliberately no price column: see the table comment on billing_code_bundles
);
COMMENT ON TABLE public.billing_code_bundle_lines IS
  'The codes of a code bundle, in order. Quantity, optional fixed tooth and a note; never a price.';

CREATE INDEX IF NOT EXISTS billing_code_bundle_lines_practice_idx ON public.billing_code_bundle_lines (practice_id);

CREATE OR REPLACE FUNCTION public.billing_code_bundle_lines_set_practice()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_practice uuid;
BEGIN
  -- Runs as the signed-in user, so RLS hides other practices' bundles: their lines cannot be written
  SELECT b.practice_id INTO v_practice FROM public.billing_code_bundles b WHERE b.id = NEW.bundle_id;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'Code bundle % not found', NEW.bundle_id USING ERRCODE = 'P0002';
  END IF;
  NEW.practice_id := v_practice;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS billing_code_bundle_lines_set_practice ON public.billing_code_bundle_lines;
CREATE TRIGGER billing_code_bundle_lines_set_practice
  BEFORE INSERT OR UPDATE ON public.billing_code_bundle_lines
  FOR EACH ROW EXECUTE FUNCTION public.billing_code_bundle_lines_set_practice();

-- ---------------------------------------------------------------------------------------------
-- 2. save_code_bundle(p_bundle, p_lines): creates or replaces a bundle with its lines in one call.
--    SECURITY INVOKER: every insert, update and delete goes through the RLS policies below.
--    p_bundle: {id?, practice_id, name, colour, description, preset_key}
--    p_lines:  [{code, quantity, tooth_number, notes}, ...] in order (1 to 30 lines)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_code_bundle(p_bundle jsonb, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public AS $$
DECLARE
  v_id uuid := NULLIF(p_bundle->>'id', '')::uuid;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'A code bundle needs 1 to 30 lines' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.billing_code_bundles (practice_id, name, colour, description, preset_key)
    VALUES (
      (p_bundle->>'practice_id')::uuid,
      btrim(p_bundle->>'name'),
      COALESCE(NULLIF(p_bundle->>'colour', ''), 'cyan'),
      NULLIF(btrim(COALESCE(p_bundle->>'description', '')), ''),
      NULLIF(p_bundle->>'preset_key', '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.billing_code_bundles
    SET name = btrim(p_bundle->>'name'),
        colour = COALESCE(NULLIF(p_bundle->>'colour', ''), 'cyan'),
        description = NULLIF(btrim(COALESCE(p_bundle->>'description', '')), '')
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Code bundle % not found', v_id USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.billing_code_bundle_lines WHERE bundle_id = v_id;
  END IF;

  INSERT INTO public.billing_code_bundle_lines (bundle_id, practice_id, line_no, code, quantity, tooth_number, notes)
  SELECT v_id,
         b.practice_id,
         l.ordinality::smallint,
         upper(btrim(l.value->>'code')),
         COALESCE((l.value->>'quantity')::numeric, 1),
         NULLIF(btrim(COALESCE(l.value->>'tooth_number', '')), ''),
         NULLIF(btrim(COALESCE(l.value->>'notes', '')), '')
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS l(value, ordinality)
  CROSS JOIN (SELECT practice_id FROM public.billing_code_bundles WHERE id = v_id) b;

  RETURN v_id;
END
$$;
COMMENT ON FUNCTION public.save_code_bundle(jsonb, jsonb) IS
  'Creates or replaces a code bundle and its lines in one transaction (RLS applies).';

-- ---------------------------------------------------------------------------------------------
-- 3. Quote numbers per practice and year: Q2026-0001, Q2026-0002, ...
--    The counter row is locked by the upsert, so two quotes saved at once get different numbers. A
--    failed save rolls the counter back with it, so numbers are not skipped.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quote_number_counters (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  last_number integer NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (practice_id, year)
);
COMMENT ON TABLE public.quote_number_counters IS
  'Last quote number used per practice and year. Written only by quotes_assign_number().';

-- 4. quotes (created before its numbering trigger below)

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  quote_number text NOT NULL,                       -- set by quotes_assign_number()
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  quote_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Windhoek')::date),
  valid_until date NOT NULL,
  -- The medical aid as quoted, so a reprint shows what the patient was given
  medical_aid_name text CHECK (medical_aid_name IS NULL OR char_length(medical_aid_name) <= 120),
  medical_aid_scheme text CHECK (medical_aid_scheme IS NULL OR char_length(medical_aid_scheme) <= 120),
  membership_number text CHECK (membership_number IS NULL OR char_length(membership_number) <= 60),
  -- private: no medical aid; all_rates / some_rates / no_rates: how much of the estimate rests on
  -- fund rates the practice knows (medical_aid_service_prices). Unknown lines are patient portion.
  estimate_basis text NOT NULL DEFAULT 'no_rates'
    CHECK (estimate_basis IN ('private', 'all_rates', 'some_rates', 'no_rates')),
  estimate_note text CHECK (estimate_note IS NULL OR char_length(estimate_note) <= 1000),
  preauth_number text CHECK (preauth_number IS NULL OR char_length(preauth_number) <= 40),
  fund_reference text CHECK (fund_reference IS NULL OR char_length(fund_reference) <= 60),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  -- Always the sums of the lines (save_quote recalculates them)
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  medical_aid_estimate numeric(12,2) NOT NULL DEFAULT 0 CHECK (medical_aid_estimate >= 0),
  patient_estimate numeric(12,2) NOT NULL DEFAULT 0 CHECK (patient_estimate >= 0),
  sent_at timestamptz,
  sent_via text CHECK (sent_via IS NULL OR sent_via IN ('sms', 'email', 'print')),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  status_changed_at timestamptz,
  status_changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  converted_invoice_id uuid REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  converted_visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  converted_at timestamptz,
  converted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_number_key UNIQUE (practice_id, quote_number),
  CONSTRAINT quotes_validity CHECK (valid_until >= quote_date),
  CONSTRAINT quotes_estimate_adds_up CHECK (medical_aid_estimate + patient_estimate = subtotal),
  CONSTRAINT quotes_converted_when CHECK (status <> 'converted' OR converted_at IS NOT NULL)
);
COMMENT ON TABLE public.quotes IS
  'Treatment estimates (quotes) per patient. Lines in quote_lines; see proposals/2026-10-07-quotes-and-bundles.sql.';

CREATE INDEX IF NOT EXISTS quotes_practice_status_idx ON public.quotes (practice_id, status);
CREATE INDEX IF NOT EXISTS quotes_practice_created_idx ON public.quotes (practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_patient_idx ON public.quotes (patient_id);
CREATE INDEX IF NOT EXISTS quotes_converted_invoice_idx ON public.quotes (converted_invoice_id) WHERE converted_invoice_id IS NOT NULL;

-- Numbers new quotes and checks the patient belongs to the quote's practice. SECURITY DEFINER only for
-- the counter table (no policies); the quote row itself still passes the RLS insert check afterwards.
CREATE OR REPLACE FUNCTION public.quotes_assign_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM NEW.quote_date)::integer;
  v_next integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.practice_id = NEW.practice_id
  ) THEN
    RAISE EXCEPTION 'The patient does not belong to this practice' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.quote_number_counters AS c (practice_id, year, last_number)
  VALUES (NEW.practice_id, v_year, 1)
  ON CONFLICT (practice_id, year) DO UPDATE SET last_number = c.last_number + 1
  RETURNING last_number INTO v_next;
  NEW.quote_number := 'Q' || v_year || '-' || lpad(v_next::text, 4, '0');
  NEW.status := 'draft';
  NEW.created_at := now();
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS quotes_assign_number ON public.quotes;
CREATE TRIGGER quotes_assign_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_assign_number();

-- ---------------------------------------------------------------------------------------------
-- 5. quote_lines
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  -- Copied from the quote by the guard below (kept for RLS); a client value is ignored
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 200),
  -- The tariff row the price came from (no FK: tariff rows can be replaced by a new version)
  tariff_id uuid,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9./-]{1,20}$'),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 300),
  quantity numeric(6,2) NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0 AND unit_price <= 1000000),
  total_price numeric(12,2) NOT NULL,
  -- Comma-separated FDI teeth, as invoice_services.tooth_number
  tooth_numbers text CHECK (tooth_numbers IS NULL OR tooth_numbers ~ '^([1-4][1-8]|[5-8][1-5])(,([1-4][1-8]|[5-8][1-5]))*$'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 200),
  is_auto_generated boolean NOT NULL DEFAULT false,      -- 8109 once per visit, 8346 with its filling
  parent_line_id uuid REFERENCES public.quote_lines(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  medical_aid_estimate numeric(12,2) NOT NULL DEFAULT 0 CHECK (medical_aid_estimate >= 0),
  patient_estimate numeric(12,2) NOT NULL DEFAULT 0 CHECK (patient_estimate >= 0),
  estimate_basis text NOT NULL DEFAULT 'no_rate' CHECK (estimate_basis IN ('private', 'fund_rate', 'no_rate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_lines_line_key UNIQUE (quote_id, line_no),
  -- The computeLine rule: unit price x quantity, rounded half up to the cent
  CONSTRAINT quote_lines_total_is_unit_times_quantity CHECK (total_price = round(unit_price * quantity, 2)),
  CONSTRAINT quote_lines_estimate_adds_up CHECK (medical_aid_estimate + patient_estimate = total_price)
);
COMMENT ON TABLE public.quote_lines IS
  'Priced lines of a quote, built with the visit screens'' line builder so the invoice matches the quote.';

CREATE INDEX IF NOT EXISTS quote_lines_practice_idx ON public.quote_lines (practice_id);
CREATE INDEX IF NOT EXISTS quote_lines_parent_idx ON public.quote_lines (parent_line_id) WHERE parent_line_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 6. Guards
-- ---------------------------------------------------------------------------------------------

-- Status changes, what may change in which status, and the invoice link
CREATE OR REPLACE FUNCTION public.quotes_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_allowed text[];
  v_invoice record;
BEGIN
  IF NEW.practice_id IS DISTINCT FROM OLD.practice_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.quote_number IS DISTINCT FROM OLD.quote_number
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A quote''s practice, patient, number and creator cannot be changed' USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'converted' THEN
    -- The one change allowed: the database clearing a link when the invoice or visit is deleted
    -- (ON DELETE SET NULL). The quote stays invoiced; nothing else about it may change.
    IF NEW.status = 'converted'
       AND (NEW.converted_invoice_id IS NULL OR NEW.converted_invoice_id IS NOT DISTINCT FROM OLD.converted_invoice_id)
       AND (NEW.converted_visit_id IS NULL OR NEW.converted_visit_id IS NOT DISTINCT FROM OLD.converted_visit_id)
       AND (to_jsonb(NEW) - ARRAY['converted_invoice_id', 'converted_visit_id', 'updated_at', 'updated_by'])
           = (to_jsonb(OLD) - ARRAY['converted_invoice_id', 'converted_visit_id', 'updated_at', 'updated_by']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Quote % has been invoiced and cannot be changed', OLD.quote_number USING ERRCODE = '23514';
  END IF;

  -- The prices, dates and estimate are what the patient was given: they change only while the
  -- quote is a draft or sent (being edited). Pre-authorisation and fund reference may arrive later.
  IF NEW.status NOT IN ('draft', 'sent') AND (
       NEW.quote_date IS DISTINCT FROM OLD.quote_date
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.medical_aid_estimate IS DISTINCT FROM OLD.medical_aid_estimate
       OR NEW.patient_estimate IS DISTINCT FROM OLD.patient_estimate
       OR NEW.estimate_basis IS DISTINCT FROM OLD.estimate_basis
       OR NEW.estimate_note IS DISTINCT FROM OLD.estimate_note
       OR NEW.medical_aid_name IS DISTINCT FROM OLD.medical_aid_name
       OR NEW.medical_aid_scheme IS DISTINCT FROM OLD.medical_aid_scheme
       OR NEW.membership_number IS DISTINCT FROM OLD.membership_number) THEN
    RAISE EXCEPTION 'Quote % is %: its lines, dates and estimate can no longer be changed', OLD.quote_number, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed := CASE OLD.status
      WHEN 'draft' THEN ARRAY['sent', 'accepted', 'declined', 'expired']
      WHEN 'sent' THEN ARRAY['draft', 'sent', 'accepted', 'declined', 'expired']
      WHEN 'accepted' THEN ARRAY['converted', 'declined']
      WHEN 'declined' THEN ARRAY['draft']
      WHEN 'expired' THEN ARRAY['draft']
      ELSE ARRAY[]::text[]
    END;
    IF NOT (NEW.status = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'A % quote cannot become %', OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
    -- Accepting an expired quote is refused: its prices may be out of date (extend it first)
    IF NEW.status = 'accepted' AND OLD.valid_until < (now() AT TIME ZONE 'Africa/Windhoek')::date THEN
      RAISE EXCEPTION 'Quote % expired on %; extend its validity before it is accepted', OLD.quote_number, OLD.valid_until
        USING ERRCODE = '23514';
    END IF;
    NEW.status_changed_at := now();
    NEW.status_changed_by := auth.uid();
    IF NEW.status = 'accepted' THEN NEW.accepted_at := now(); END IF;
    IF NEW.status = 'declined' THEN NEW.declined_at := now(); END IF;
  END IF;

  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent' OR NEW.sent_at IS DISTINCT FROM OLD.sent_at) THEN
    NEW.sent_at := COALESCE(NEW.sent_at, now());
    NEW.sent_by := auth.uid();
  END IF;

  IF NEW.status = 'converted' THEN
    IF NEW.converted_invoice_id IS NULL THEN
      RAISE EXCEPTION 'An invoiced quote must name its invoice' USING ERRCODE = '23514';
    END IF;
    -- Runs as the signed-in user: an invoice of another practice is not visible and is refused
    SELECT i.patient_id, i.practice_id INTO v_invoice FROM public.invoices_enhanced i WHERE i.id = NEW.converted_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice % not found', NEW.converted_invoice_id USING ERRCODE = '23514';
    END IF;
    IF v_invoice.patient_id IS DISTINCT FROM NEW.patient_id
       OR (v_invoice.practice_id IS NOT NULL AND v_invoice.practice_id IS DISTINCT FROM NEW.practice_id) THEN
      RAISE EXCEPTION 'The invoice belongs to another patient or practice' USING ERRCODE = '23514';
    END IF;
    NEW.converted_at := now();
    NEW.converted_by := auth.uid();
  ELSIF NEW.converted_invoice_id IS NOT NULL OR NEW.converted_visit_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an invoiced quote links to an invoice' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS quotes_guard ON public.quotes;
CREATE TRIGGER quotes_guard
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_guard();

-- Lines follow their quote's practice and change only while the quote is a draft or sent
CREATE OR REPLACE FUNCTION public.quote_lines_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_quote record;
BEGIN
  SELECT q.practice_id, q.status, q.quote_number INTO v_quote
  FROM public.quotes q
  WHERE q.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END;

  IF TG_OP = 'DELETE' THEN
    -- No quote: it is being deleted itself (drafts only, see the delete policy)
    IF FOUND AND v_quote.status NOT IN ('draft', 'sent') THEN
      RAISE EXCEPTION 'Quote % is %: its lines can no longer be changed', v_quote.quote_number, v_quote.status
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', NEW.quote_id USING ERRCODE = 'P0002';
  END IF;
  IF v_quote.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Quote % is %: its lines can no longer be changed', v_quote.quote_number, v_quote.status
      USING ERRCODE = '23514';
  END IF;
  NEW.practice_id := v_quote.practice_id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS quote_lines_guard ON public.quote_lines;
CREATE TRIGGER quote_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.quote_lines_guard();

-- ---------------------------------------------------------------------------------------------
-- 7. save_quote(p_quote, p_lines): creates or replaces a quote with all its lines in one call.
--    SECURITY INVOKER: RLS and the guards above apply. The header totals are recalculated from the
--    lines here; the client never sends them.
--    p_quote: {id?, practice_id, patient_id, status ('draft' or 'sent'), quote_date, valid_until,
--              medical_aid_name, medical_aid_scheme, membership_number, estimate_basis, estimate_note,
--              preauth_number, fund_reference, notes}
--    p_lines: [{id, tariff_id, code, description, quantity, unit_price, total_price, tooth_numbers,
--              notes, is_auto_generated, parent_line_id, medical_aid_estimate, patient_estimate,
--              estimate_basis}, ...] in screen order
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_quote(p_quote jsonb, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public AS $$
DECLARE
  v_id uuid := NULLIF(p_quote->>'id', '')::uuid;
  v_status text := COALESCE(NULLIF(p_quote->>'status', ''), 'draft');
  v_current text;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'A quote needs 1 to 200 lines' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Only a draft or sent quote can be saved with new lines' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.quotes (
      practice_id, patient_id, quote_date, valid_until, medical_aid_name, medical_aid_scheme,
      membership_number, estimate_basis, estimate_note, preauth_number, fund_reference, notes
    )
    VALUES (
      (p_quote->>'practice_id')::uuid,
      (p_quote->>'patient_id')::uuid,
      (p_quote->>'quote_date')::date,
      (p_quote->>'valid_until')::date,
      NULLIF(btrim(COALESCE(p_quote->>'medical_aid_name', '')), ''),
      NULLIF(btrim(COALESCE(p_quote->>'medical_aid_scheme', '')), ''),
      NULLIF(btrim(COALESCE(p_quote->>'membership_number', '')), ''),
      COALESCE(NULLIF(p_quote->>'estimate_basis', ''), 'no_rates'),
      NULLIF(btrim(COALESCE(p_quote->>'estimate_note', '')), ''),
      NULLIF(btrim(COALESCE(p_quote->>'preauth_number', '')), ''),
      NULLIF(btrim(COALESCE(p_quote->>'fund_reference', '')), ''),
      NULLIF(btrim(COALESCE(p_quote->>'notes', '')), '')
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT q.status INTO v_current FROM public.quotes q WHERE q.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quote % not found', v_id USING ERRCODE = 'P0002';
    END IF;
    IF v_current NOT IN ('draft', 'sent') THEN
      RAISE EXCEPTION 'Only a draft or sent quote can be changed (this one is %)', v_current USING ERRCODE = '23514';
    END IF;
    UPDATE public.quotes
    SET status = v_status,
        quote_date = (p_quote->>'quote_date')::date,
        valid_until = (p_quote->>'valid_until')::date,
        medical_aid_name = NULLIF(btrim(COALESCE(p_quote->>'medical_aid_name', '')), ''),
        medical_aid_scheme = NULLIF(btrim(COALESCE(p_quote->>'medical_aid_scheme', '')), ''),
        membership_number = NULLIF(btrim(COALESCE(p_quote->>'membership_number', '')), ''),
        estimate_basis = COALESCE(NULLIF(p_quote->>'estimate_basis', ''), 'no_rates'),
        estimate_note = NULLIF(btrim(COALESCE(p_quote->>'estimate_note', '')), ''),
        preauth_number = NULLIF(btrim(COALESCE(p_quote->>'preauth_number', '')), ''),
        fund_reference = NULLIF(btrim(COALESCE(p_quote->>'fund_reference', '')), ''),
        notes = NULLIF(btrim(COALESCE(p_quote->>'notes', '')), '')
    WHERE id = v_id;
    DELETE FROM public.quote_lines WHERE quote_id = v_id;
  END IF;

  INSERT INTO public.quote_lines (
    id, quote_id, practice_id, line_no, tariff_id, code, description, quantity, unit_price, total_price,
    tooth_numbers, notes, is_auto_generated, parent_line_id, medical_aid_estimate, patient_estimate, estimate_basis
  )
  SELECT COALESCE(NULLIF(l.value->>'id', '')::uuid, gen_random_uuid()),
         v_id,
         q.practice_id,
         l.ordinality::smallint,
         NULLIF(l.value->>'tariff_id', '')::uuid,
         upper(btrim(l.value->>'code')),
         btrim(l.value->>'description'),
         (l.value->>'quantity')::numeric,
         (l.value->>'unit_price')::numeric,
         (l.value->>'total_price')::numeric,
         NULLIF(btrim(COALESCE(l.value->>'tooth_numbers', '')), ''),
         NULLIF(btrim(COALESCE(l.value->>'notes', '')), ''),
         COALESCE((l.value->>'is_auto_generated')::boolean, false),
         NULLIF(l.value->>'parent_line_id', '')::uuid,
         COALESCE((l.value->>'medical_aid_estimate')::numeric, 0),
         COALESCE((l.value->>'patient_estimate')::numeric, (l.value->>'total_price')::numeric),
         COALESCE(NULLIF(l.value->>'estimate_basis', ''), 'no_rate')
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS l(value, ordinality)
  CROSS JOIN (SELECT practice_id FROM public.quotes WHERE id = v_id) q;

  UPDATE public.quotes q
  SET subtotal = s.total,
      medical_aid_estimate = s.fund,
      patient_estimate = s.patient
  FROM (
    SELECT COALESCE(sum(total_price), 0) AS total,
           COALESCE(sum(medical_aid_estimate), 0) AS fund,
           COALESCE(sum(patient_estimate), 0) AS patient
    FROM public.quote_lines
    WHERE quote_id = v_id
  ) s
  WHERE q.id = v_id;

  RETURN v_id;
END
$$;
COMMENT ON FUNCTION public.save_quote(jsonb, jsonb) IS
  'Creates or replaces a draft/sent quote and all its lines in one transaction; totals are the sums of the lines.';

-- ---------------------------------------------------------------------------------------------
-- 8. RLS: staff see and change only their own practice's bundles and quotes
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.billing_code_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_code_bundle_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_counters ENABLE ROW LEVEL SECURITY;   -- no policies: function-only
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_code_bundles_select ON public.billing_code_bundles;
CREATE POLICY billing_code_bundles_select ON public.billing_code_bundles FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundles.practice_id));

DROP POLICY IF EXISTS billing_code_bundles_insert ON public.billing_code_bundles;
CREATE POLICY billing_code_bundles_insert ON public.billing_code_bundles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundles.practice_id));

DROP POLICY IF EXISTS billing_code_bundles_update ON public.billing_code_bundles;
CREATE POLICY billing_code_bundles_update ON public.billing_code_bundles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundles.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundles.practice_id));

DROP POLICY IF EXISTS billing_code_bundles_delete ON public.billing_code_bundles;
CREATE POLICY billing_code_bundles_delete ON public.billing_code_bundles FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundles.practice_id));

DROP POLICY IF EXISTS billing_code_bundle_lines_select ON public.billing_code_bundle_lines;
CREATE POLICY billing_code_bundle_lines_select ON public.billing_code_bundle_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundle_lines.practice_id));

DROP POLICY IF EXISTS billing_code_bundle_lines_insert ON public.billing_code_bundle_lines;
CREATE POLICY billing_code_bundle_lines_insert ON public.billing_code_bundle_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundle_lines.practice_id));

DROP POLICY IF EXISTS billing_code_bundle_lines_update ON public.billing_code_bundle_lines;
CREATE POLICY billing_code_bundle_lines_update ON public.billing_code_bundle_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundle_lines.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundle_lines.practice_id));

DROP POLICY IF EXISTS billing_code_bundle_lines_delete ON public.billing_code_bundle_lines;
CREATE POLICY billing_code_bundle_lines_delete ON public.billing_code_bundle_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = billing_code_bundle_lines.practice_id));

DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quotes.practice_id));

DROP POLICY IF EXISTS quotes_insert ON public.quotes;
CREATE POLICY quotes_insert ON public.quotes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quotes.practice_id));

DROP POLICY IF EXISTS quotes_update ON public.quotes;
CREATE POLICY quotes_update ON public.quotes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quotes.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quotes.practice_id));

-- Only drafts can be deleted: a quote the patient was given stays on record
DROP POLICY IF EXISTS quotes_delete ON public.quotes;
CREATE POLICY quotes_delete ON public.quotes FOR DELETE
  USING (
    quotes.status = 'draft'
    AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quotes.practice_id)
  );

DROP POLICY IF EXISTS quote_lines_select ON public.quote_lines;
CREATE POLICY quote_lines_select ON public.quote_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quote_lines.practice_id));

DROP POLICY IF EXISTS quote_lines_insert ON public.quote_lines;
CREATE POLICY quote_lines_insert ON public.quote_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quote_lines.practice_id));

DROP POLICY IF EXISTS quote_lines_update ON public.quote_lines;
CREATE POLICY quote_lines_update ON public.quote_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quote_lines.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quote_lines.practice_id));

DROP POLICY IF EXISTS quote_lines_delete ON public.quote_lines;
CREATE POLICY quote_lines_delete ON public.quote_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = quote_lines.practice_id));

-- Grants: signed-in staff only (RLS decides which rows); never anonymous
REVOKE ALL ON public.billing_code_bundles, public.billing_code_bundle_lines, public.quotes, public.quote_lines,
  public.quote_number_counters FROM anon;
REVOKE ALL ON public.quote_number_counters FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_code_bundles, public.billing_code_bundle_lines,
  public.quotes, public.quote_lines TO authenticated;
GRANT ALL ON public.billing_code_bundles, public.billing_code_bundle_lines, public.quotes, public.quote_lines,
  public.quote_number_counters TO service_role;

REVOKE ALL ON FUNCTION public.save_code_bundle(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_quote(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_code_bundle(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_quote(jsonb, jsonb) TO authenticated, service_role;
-- Trigger functions are not called directly
REVOKE ALL ON FUNCTION public.quotes_assign_number() FROM PUBLIC, anon, authenticated;

-- With the patient portal applied: patient-app logins get nothing from the new tables either
DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Checks to run on the branch before COMMIT (expected results in comments)
-- ---------------------------------------------------------------------------------------------
-- 1. Quote line rule matches computeLine (half up):
--    SELECT round(135.40 * 3, 2), round(13.545 * 1, 2);          -- 406.20, 13.55
-- 2. A line whose total is not unit x quantity is refused:
--    INSERT ... total_price = 406.19 for 135.40 x 3              -- quote_lines_total_is_unit_times_quantity
-- 3. Converted is final:
--    UPDATE public.quotes SET status = 'draft' WHERE status = 'converted';   -- error, no rows changed
-- 4. RLS: as a user of practice A, SELECT count(*) FROM public.quotes WHERE practice_id = '<B>'; -- 0

ROLLBACK;
