-- Applied 2026-10-13 as migration billing_extras_2026_10_13 (version 20261013011352; stored statement md5 22ca946cfb979e1acc1aacf46a8c7925 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back) on the demo practice with invented names and amounts: the public key ran
-- nothing (42501); reception could not change promotions, packages or price rules (42501); an administrator started
-- 10 % off 0190 and 8261 (codes tidied, the repeat dropped), a second promotion on 0190 on overlapping days was refused
-- (23P01) and one on another code saved; a bad code, 150 %, a last day before the first and three years were refused
-- (22023); another practice's administrator read 0 promotions and could not end one (42501); an ended promotion could
-- not be changed (22023). A package type saved; the same name in other case and 0 sessions were refused (23505, 22023);
-- reception sold it: invoice INV-, N$ 4,500.00, the fund 0.00, not batched, line PKG paid by the patient, on a cancelled
-- carrier visit (package_sale), valid 182 days; another practice and a foreign patient were refused (42501). A use line of
-- 2 sessions at N$ 0.00 counted 2 used, 0 with that invoice left out and 0 once its invoice was cancelled; another
-- practice and a patient-app login read nothing. Reception could not cancel a package (42501), a practitioner could, with
-- a reason. A plan of N$ 1,000.00 (400.00 forty days ago in a closed month, 300.00 today, 300.00 in 30 days): sums that
-- do not add up, dates out of order, a foreign patient and another practice's practitioner were refused; another practice
-- and anon could not post (42501); reception posted 2 (N$ 700.00), the first dated the first open day, both PLAN lines paid
-- by the patient on one carrier visit under the plan's practitioner; posting again posted nothing; a stopped plan posted
-- nothing more, a new plan posted for the whole practice; direct inserts were refused (42501). The administrator saved
-- tiers and the rule-013 figures (4240.20, 8016.80); an unknown tier and a 0 limit were refused; a practitioner kept and
-- cleared a medicine's reference price, a material and reception were refused. No invoice total or policy changed.
-- =============================================================================================
-- PROPOSAL: billing and pricing extras - payment plans, prepaid packages, promotions, materials at cost plus the
--           NAMAF rule 013 handling fee, medicine price tiers and fund reference prices
--           (parity D16, D17, D18, D29, E7)
-- File:   proposals/2026-10-13-billing-extras.sql                       Drafted: 2026-10-13
-- Code:   src/utils/stock/pricingRules.ts (the medicine tiers, the material rule, reference prices; tested),
--         src/utils/billing/paymentPlans.ts, promotions.ts, packages.ts (the rules; tested),
--         src/services/billing/billingExtrasService.ts and src/services/stock/pricingRulesService.ts (reads and
--         writes; "not set up yet" before this file), src/components/billingExtras/* (the patient file's Billing tab,
--         the visit's Billing tab, Admin > Tariffs > Contracts and co-payments, Finance > Overview's daily controls),
--         src/components/stock/PricingRulesCards.tsx (Stock > Settings), src/utils/billing/invoiceLineRow.ts (the two
--         new line columns), src/components/finance/practiceReports/discountListing.ts (promotions in Discounts given).
--
-- Why
--   D16: a dental or specialist practice agrees a treatment's total with the patient and lets them pay it off. Eminance
--   keeps payment plans whose instalments post as invoice lines; OneHealth had none.
--   D17: a practice sells a package (10 physiotherapy sessions, 5 consultations) paid up front; each visit uses one.
--   D18: a promotion takes a percentage or an amount off chosen codes between two dates.
--   D29: NAMAF rule 013 bills materials at cost plus a handling fee (35 % up to N$ 4,240.20, 10 % above, the fee at most
--   N$ 8,016.80 in the 2025 dental schedule). Medicines and materials shared one price rule.
--   E7: a dispensing practice prices medicine by cost, markup and dispensing fee, with tiers (medical aid, private,
--   staff) and the fund's reference price per medicine.
--
-- What it does (new tables and functions; two nullable columns on invoice_services; nothing that exists changes)
--   1. stock_pricing_rules: per practice, the medicine price tiers (each tier its own markup and dispensing fee) and the
--      material rule (handling fee by cost, with a ceiling). No row, or an empty one, prices exactly as before: every
--      item by the price bands of stock_settings.price_rule. stock_reference_prices: a medicine's fund reference price.
--   2. billing_promotions: a percentage or an amount off chosen codes from one day to another (no two promotions on the
--      same code at the same time); the visit's Billing tab applies it to a private patient's line.
--   3. billing_package_types (what the practice sells) and patient_packages (what a patient bought: sessions, the codes
--      they cover, valid until). A package is sold on its own invoice; each visit line that uses it carries its id.
--   4. payment_plans and payment_plan_instalments: an agreed total and its instalments, each posted on its date as an
--      invoice line the patient pays (never claimed). There is no scheduler: due instalments post when staff open the
--      patient's Billing tab, or with "Post due instalments" in Finance > Overview.
--   5. invoice_services.promotion_id and .package_id (nullable): the promotion a line's discount came from, the package a
--      line was paid from. A package's sessions used are counted from these lines on invoices that are not cancelled.
--   6. Functions (SECURITY DEFINER, search_path public; each checks the caller is active staff of the practice with
--      the role it needs): stock_save_pricing_rules (administrators), stock_save_reference_price (administrators,
--      practitioners, nurses), billing_save_promotion and billing_end_promotion (administrators),
--      billing_save_package_type (administrators), billing_sell_package (anyone with billing rights),
--      billing_cancel_package (administrators and practitioners), billing_save_payment_plan, billing_stop_payment_plan
--      and billing_post_due_instalments (anyone with billing rights). billing_patient_packages reads a patient's
--      packages with the sessions used (runs with the caller's rights). Instalments and package sales are invoices
--      made by billing_post_patient_invoice on a carrier visit (cancelled, not scheduled, noted "Not a consultation",
--      as the Eminance import's opening balances): invoices_enhanced.visit_id is required. They go through every
--      existing trigger (number, period lock, daybook, totals); a closed month moves an instalment to the first open day.
--   7. Row level security: staff of the practice read; nobody writes the tables directly; the patient app's logins get
--      nothing (portal_staff_only).
--   8. Checks, including that no policy of invoice_services, invoices_enhanced, practice_inventory, visits or patients
--      changed and every invoice balance is as before.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. Needs receipts' ar_today(), ar_is_cancelled(), the debtors file's
-- dc_first_open_day(), the stock file's stock_assert_role(), stock_amount() and stock_int(), and line-portions' paid_by. Until then
-- the screens say these parts are not set up yet and every price is worked out as before.
-- Undo (only while nothing was sold, posted or priced with them):
--   DROP FUNCTION public.billing_post_due_instalments(uuid, uuid), public.billing_stop_payment_plan(uuid, text),
--     public.billing_save_payment_plan(jsonb), public.billing_patient_packages(uuid, uuid),
--     public.billing_cancel_package(uuid, text), public.billing_sell_package(uuid, uuid, uuid),
--     public.billing_save_package_type(jsonb), public.billing_end_promotion(uuid), public.billing_save_promotion(jsonb),
--     public.stock_save_reference_price(uuid, numeric), public.stock_save_pricing_rules(uuid, jsonb),
--     public.billing_post_patient_invoice(uuid, uuid, uuid, date, text, text, numeric, uuid, text),
--     public.billing_carrier_visit(uuid, uuid, text, text), public.billing_codes(jsonb, integer),
--     public.billing_assert_staff(uuid, text[], text);
--   ALTER TABLE public.invoice_services DROP COLUMN promotion_id, DROP COLUMN package_id;
--   DROP TABLE public.payment_plan_instalments, public.payment_plans, public.patient_packages,
--     public.billing_package_types, public.billing_promotions, public.stock_reference_prices, public.stock_pricing_rules;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.practices'), ('public.patients'), ('public.visits'), ('public.users'), ('public.invoices_enhanced'),
                 ('public.invoice_services'), ('public.practice_inventory'), ('public.stock_settings'), ('public.period_closes')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %', v_missing;
  END IF;
  SELECT string_agg(f.name, ', ') INTO v_missing
    FROM (VALUES ('public.ar_today()'), ('public.ar_is_cancelled(text)'), ('public.dc_first_open_day(uuid,date)'),
                 ('public.stock_assert_role(uuid,text[],text)'), ('public.stock_amount(jsonb,text,numeric)'),
                 ('public.stock_int(jsonb,text,integer,integer)')) AS f(name)
   WHERE to_regprocedure(f.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: % (apply receipts, debtors and the stock file first)', v_missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice_services' AND column_name = 'paid_by') THEN
    RAISE EXCEPTION 'Stopped: invoice_services.paid_by is missing; apply proposals/2026-10-09-line-portions.sql first';
  END IF;
  -- The policies of the tables this file reads or extends, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'practice_inventory', 'visits', 'patients', 'users', 'stock_settings')
  ), true);
  -- Every invoice's total and split before, to check at the end that nothing already billed changed
  PERFORM set_config('onehealth.invoices_before', (
    SELECT md5(COALESCE(string_agg(id::text || '|' || COALESCE(total, 0)::text || '|' || COALESCE(medical_aid_total, 0)::text || '|' || COALESCE(patient_total, 0)::text, ';' ORDER BY id), ''))
      FROM public.invoices_enhanced
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Medicine tiers, the material rule and fund reference prices
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_pricing_rules (
  practice_id     uuid PRIMARY KEY,
  -- {"medical_aid": {"markup_percent": n, "fee": N$}, "private": {...}, "staff": {...}}; a tier left out uses the bands
  medicine_tiers  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- null: materials are priced by the bands, as before. {"lower_percent": n, "threshold": N$, "upper_percent": n,
  -- "max_fee": N$ | null}: cost plus lower_percent of the cost up to threshold and upper_percent of the rest, at most max_fee
  material_rule   jsonb,
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_pricing_rules_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT stock_pricing_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT stock_pricing_rules_tiers_check CHECK (jsonb_typeof(medicine_tiers) = 'object'),
  CONSTRAINT stock_pricing_rules_material_check CHECK (material_rule IS NULL OR jsonb_typeof(material_rule) = 'object')
);
COMMENT ON TABLE public.stock_pricing_rules IS
  'A practice''s medicine price tiers and material rule (NAMAF rule 013 handling fee). No row prices every item by stock_settings.price_rule, as before. Written through stock_save_pricing_rules; src/utils/stock/pricingRules.ts applies it.';

CREATE TABLE IF NOT EXISTS public.stock_reference_prices (
  item_id          uuid PRIMARY KEY,
  practice_id      uuid NOT NULL,
  -- What the fund pays at most per unit, VAT included
  reference_price  numeric(12,2) NOT NULL,
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_reference_prices_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.practice_inventory(id) ON DELETE CASCADE,
  CONSTRAINT stock_reference_prices_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT stock_reference_prices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT stock_reference_prices_price_check CHECK (reference_price > 0 AND reference_price <= 1000000)
);
COMMENT ON TABLE public.stock_reference_prices IS
  'A medicine''s fund reference price per unit (VAT included): the most a medical aid pays for it. Written through stock_save_reference_price.';
CREATE INDEX IF NOT EXISTS stock_reference_prices_practice_idx ON public.stock_reference_prices (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Promotions
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL,
  name         text NOT NULL,
  -- percent: value % of each line; amount: N$ value off each unit (never more than the line)
  kind         text NOT NULL,
  value        numeric(12,2) NOT NULL,
  -- Tariff codes as billed (upper case)
  codes        text[] NOT NULL,
  starts_on    date NOT NULL,
  ends_on      date NOT NULL,
  -- Ended early by an administrator: it applies to nothing new
  ended_at     timestamptz,
  ended_by     uuid,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_promotions_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT billing_promotions_ended_by_fkey FOREIGN KEY (ended_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_promotions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_promotions_name_check CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  CONSTRAINT billing_promotions_kind_check CHECK (kind IN ('percent', 'amount')),
  CONSTRAINT billing_promotions_value_check CHECK (value > 0 AND value <= 1000000 AND (kind <> 'percent' OR value <= 100)),
  CONSTRAINT billing_promotions_codes_check CHECK (
    cardinality(codes) BETWEEN 1 AND 50 AND array_position(codes, NULL) IS NULL
    AND array_to_string(codes, ' ') ~ '^[A-Z0-9./-]{1,20}( [A-Z0-9./-]{1,20})*$'),
  CONSTRAINT billing_promotions_dates_check CHECK (ends_on >= starts_on AND ends_on <= starts_on + 731)
);
COMMENT ON TABLE public.billing_promotions IS
  'Promotions: a percentage or an amount off chosen codes from starts_on to ends_on, applied to a private patient''s line on the visit''s Billing tab (invoice_services.promotion_id). Written through billing_save_promotion and billing_end_promotion.';
CREATE INDEX IF NOT EXISTS billing_promotions_practice_idx ON public.billing_promotions (practice_id, starts_on);

-- ---------------------------------------------------------------------------------------------
-- 3. Prepaid packages
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_package_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   uuid NOT NULL,
  name          text NOT NULL,
  -- The codes a session covers
  codes         text[] NOT NULL,
  sessions      integer NOT NULL,
  price         numeric(12,2) NOT NULL,
  valid_months  smallint NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_package_types_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT billing_package_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_package_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_package_types_name_check CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  CONSTRAINT billing_package_types_codes_check CHECK (
    cardinality(codes) BETWEEN 1 AND 20 AND array_position(codes, NULL) IS NULL
    AND array_to_string(codes, ' ') ~ '^[A-Z0-9./-]{1,20}( [A-Z0-9./-]{1,20})*$'),
  CONSTRAINT billing_package_types_sessions_check CHECK (sessions BETWEEN 1 AND 100),
  CONSTRAINT billing_package_types_price_check CHECK (price > 0 AND price <= 1000000),
  CONSTRAINT billing_package_types_valid_check CHECK (valid_months BETWEEN 1 AND 60)
);
COMMENT ON TABLE public.billing_package_types IS
  'The prepaid packages a practice sells: sessions of chosen codes for a price, valid for some months. Written through billing_save_package_type.';
CREATE UNIQUE INDEX IF NOT EXISTS billing_package_types_name_key ON public.billing_package_types (practice_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.patient_packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  package_type_id  uuid,
  -- What was sold, as it was on the day (a later change to the package type changes nothing here)
  name             text NOT NULL,
  codes            text[] NOT NULL,
  sessions         integer NOT NULL,
  price            numeric(12,2) NOT NULL,
  sold_on          date NOT NULL,
  -- Usable up to and including this day
  expires_on       date NOT NULL,
  sale_invoice_id  uuid,
  visit_id         uuid,
  sold_by          uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid,
  cancel_reason    text,
  CONSTRAINT patient_packages_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_packages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_packages_type_fkey FOREIGN KEY (package_type_id) REFERENCES public.billing_package_types(id) ON DELETE SET NULL,
  CONSTRAINT patient_packages_sale_invoice_fkey FOREIGN KEY (sale_invoice_id) REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  CONSTRAINT patient_packages_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT patient_packages_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_packages_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_packages_sessions_check CHECK (sessions BETWEEN 1 AND 100),
  CONSTRAINT patient_packages_dates_check CHECK (expires_on >= sold_on),
  CONSTRAINT patient_packages_cancel_check CHECK ((cancelled_at IS NULL) = (cancel_reason IS NULL)
    AND (cancel_reason IS NULL OR char_length(btrim(cancel_reason)) BETWEEN 3 AND 200))
);
COMMENT ON TABLE public.patient_packages IS
  'Prepaid packages a patient bought (sold on their own invoice). Sessions used are the quantities of invoice lines with this package_id on invoices that are not cancelled (billing_patient_packages). Written through billing_sell_package and billing_cancel_package.';
CREATE INDEX IF NOT EXISTS patient_packages_patient_idx ON public.patient_packages (patient_id);
CREATE INDEX IF NOT EXISTS patient_packages_practice_idx ON public.patient_packages (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 4. Payment plans
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  title            text NOT NULL,
  total            numeric(12,2) NOT NULL,
  -- The practitioner the instalment invoices are recorded under (null: none)
  practitioner_id  uuid,
  notes            text,
  -- The carrier visit the instalment invoices hang on (made with the first posting)
  visit_id         uuid,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  stopped_at       timestamptz,
  stopped_by       uuid,
  stop_reason      text,
  CONSTRAINT payment_plans_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT payment_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT payment_plans_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_plans_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT payment_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_plans_stopped_by_fkey FOREIGN KEY (stopped_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_plans_title_check CHECK (char_length(btrim(title)) BETWEEN 2 AND 60),
  CONSTRAINT payment_plans_total_check CHECK (total > 0 AND total <= 10000000),
  CONSTRAINT payment_plans_notes_check CHECK (notes IS NULL OR char_length(notes) <= 280),
  CONSTRAINT payment_plans_stop_check CHECK ((stopped_at IS NULL) = (stop_reason IS NULL)
    AND (stop_reason IS NULL OR char_length(btrim(stop_reason)) BETWEEN 3 AND 200))
);
COMMENT ON TABLE public.payment_plans IS
  'Payment plans: an agreed total paid off in instalments (payment_plan_instalments), each posted on its date as an invoice the patient pays. Written through billing_save_payment_plan, billing_stop_payment_plan and billing_post_due_instalments.';
CREATE INDEX IF NOT EXISTS payment_plans_patient_idx ON public.payment_plans (patient_id);
CREATE INDEX IF NOT EXISTS payment_plans_practice_idx ON public.payment_plans (practice_id);

CREATE TABLE IF NOT EXISTS public.payment_plan_instalments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL,
  practice_id  uuid NOT NULL,
  number       smallint NOT NULL,
  due_on       date NOT NULL,
  amount       numeric(12,2) NOT NULL,
  -- Set when posted: the invoice, the day it is dated (the due day, or the first open day after a closed month), who
  invoice_id   uuid,
  posted_on    date,
  posted_at    timestamptz,
  posted_by    uuid,
  CONSTRAINT payment_plan_instalments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  CONSTRAINT payment_plan_instalments_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT payment_plan_instalments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  CONSTRAINT payment_plan_instalments_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_plan_instalments_number_key UNIQUE (plan_id, number),
  CONSTRAINT payment_plan_instalments_number_check CHECK (number BETWEEN 1 AND 120),
  CONSTRAINT payment_plan_instalments_amount_check CHECK (amount > 0 AND amount <= 10000000),
  CONSTRAINT payment_plan_instalments_posted_check CHECK ((posted_at IS NULL) = (posted_on IS NULL))
);
COMMENT ON TABLE public.payment_plan_instalments IS
  'The instalments of a payment plan; posted_at is set once the instalment is on the patient''s account (invoice_id: its invoice).';
CREATE INDEX IF NOT EXISTS payment_plan_instalments_due_idx ON public.payment_plan_instalments (practice_id, due_on) WHERE posted_at IS NULL;
CREATE INDEX IF NOT EXISTS payment_plan_instalments_invoice_idx ON public.payment_plan_instalments (invoice_id) WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 5. Invoice lines: the promotion a discount came from, the package a line was paid from
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS promotion_id uuid;
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS package_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_promotion_id_fkey') THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_promotion_id_fkey
      FOREIGN KEY (promotion_id) REFERENCES public.billing_promotions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_services_package_id_fkey') THEN
    ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES public.patient_packages(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS invoice_services_promotion_idx ON public.invoice_services (promotion_id) WHERE promotion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_services_package_idx ON public.invoice_services (package_id) WHERE package_id IS NOT NULL;
COMMENT ON COLUMN public.invoice_services.promotion_id IS 'The promotion (billing_promotions) the line''s discount came from; null for a discount typed by hand';
COMMENT ON COLUMN public.invoice_services.package_id IS 'The prepaid package (patient_packages) the line was paid from: the line is billed at N$ 0.00 and uses its quantity of sessions';

-- ---------------------------------------------------------------------------------------------
-- 6. Functions
-- ---------------------------------------------------------------------------------------------

-- 6a. The caller's role when they are active staff of the practice with one of the roles (NULL: any role); raises
--     otherwise. Internal. auth.uid() is NULL in the SQL editor and for the service role, so they cannot use these.
CREATE OR REPLACE FUNCTION public.billing_assert_staff(p_practice_id uuid, p_roles text[], p_refusal text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT u.role INTO v_role
    FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND p_practice_id IS NOT NULL AND u.practice_id = p_practice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only work with the billing of your own practice' USING ERRCODE = '42501';
  END IF;
  IF p_roles IS NOT NULL AND NOT (COALESCE(v_role, '') = ANY (p_roles)) THEN
    RAISE EXCEPTION '%', p_refusal USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END
$$;

-- 6b. Tariff codes from a JSON array: trimmed, upper case, each once, in the order given; raises when one is not a
--     code or there are none or more than p_max. Internal.
CREATE OR REPLACE FUNCTION public.billing_codes(p_codes jsonb, p_max integer)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_codes text[] := '{}';
  v_code text;
BEGIN
  IF p_codes IS NULL OR jsonb_typeof(p_codes) <> 'array' THEN
    RAISE EXCEPTION 'Give at least one code' USING ERRCODE = '22023';
  END IF;
  FOR v_code IN SELECT upper(btrim(value)) FROM jsonb_array_elements_text(p_codes) WITH ORDINALITY AS t(value, n) ORDER BY n LOOP
    IF v_code = '' THEN
      CONTINUE;
    END IF;
    IF v_code !~ '^[A-Z0-9./-]{1,20}$' THEN
      RAISE EXCEPTION '"%" is not a tariff code (letters, digits, dots, dashes or slashes, up to 20)', left(v_code, 30) USING ERRCODE = '22023';
    END IF;
    IF NOT (v_code = ANY (v_codes)) THEN
      v_codes := v_codes || v_code;
    END IF;
  END LOOP;
  IF cardinality(v_codes) = 0 THEN
    RAISE EXCEPTION 'Give at least one code' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_codes) > p_max THEN
    RAISE EXCEPTION 'At most % codes', p_max USING ERRCODE = '22023';
  END IF;
  RETURN v_codes;
END
$$;

-- 6c. The carrier visit an invoice without a consultation hangs on (invoices_enhanced.visit_id is required): cancelled,
--     not scheduled, so it stays out of the diary, today's list, recalls and visit counts. Internal.
CREATE OR REPLACE FUNCTION public.billing_carrier_visit(p_practice_id uuid, p_patient_id uuid, p_subtype text, p_note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_visit uuid;
BEGIN
  INSERT INTO public.visits (patient_id, practice_id, visit_date, visit_type, status, is_cancelled, is_scheduled, visit_subtype,
                             automation_source, notes)
  VALUES (p_patient_id, p_practice_id, public.ar_today(), 'consultation', 'cancelled', true, false, p_subtype, 'system', p_note)
  RETURNING id INTO v_visit;
  RETURN v_visit;
END
$$;

-- 6d. An invoice of one line the patient pays (never claimed), dated p_date; numbered, totalled, locked by closed
--     months and recorded in the daybook by the existing triggers. Internal.
CREATE OR REPLACE FUNCTION public.billing_post_patient_invoice(
  p_practice_id uuid, p_patient_id uuid, p_visit_id uuid, p_date date, p_code text, p_description text, p_amount numeric,
  p_practitioner_id uuid, p_notes text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice uuid;
BEGIN
  INSERT INTO public.invoices_enhanced (invoice_number, patient_id, visit_id, practice_id, practitioner_id, issue_date, due_date,
                                        payment_status, notes, created_by)
  VALUES ('PENDING', p_patient_id, p_visit_id, p_practice_id, p_practitioner_id, p_date, p_date, 'pending', p_notes, auth.uid())
  RETURNING id INTO v_invoice;
  INSERT INTO public.invoice_services (invoice_id, tariff_id, code, description, quantity, unit_price, total_price,
                                       medical_aid_covered, patient_portion, paid_by, service_date)
  VALUES (v_invoice, NULL, p_code, left(p_description, 200), 1, p_amount, p_amount, 0, p_amount, 'patient', p_date);
  RETURN v_invoice;
END
$$;

-- 6e. stock_save_pricing_rules(practice, {"medicine_tiers": {tier: {"markup_percent", "fee"} | null},
--     "material_rule": null | {"lower_percent", "threshold", "upper_percent", "max_fee" | null}}): administrators.
CREATE OR REPLACE FUNCTION public.stock_save_pricing_rules(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tiers     jsonb := '{}'::jsonb;
  v_material  jsonb;
  v_key       text;
  v_tier      jsonb;
  v_rule      jsonb := p_payload -> 'material_rule';
  v_threshold numeric;
  v_max       numeric;
BEGIN
  PERFORM public.stock_assert_role(p_practice_id, ARRAY['admin'], 'change the selling price rules');
  IF p_payload ? 'medicine_tiers' AND jsonb_typeof(p_payload -> 'medicine_tiers') NOT IN ('object', 'null') THEN
    RAISE EXCEPTION 'The price tiers must be a list of tiers' USING ERRCODE = '22023';
  END IF;
  FOR v_key, v_tier IN SELECT key, value FROM jsonb_each(COALESCE(NULLIF(p_payload -> 'medicine_tiers', 'null'::jsonb), '{}'::jsonb)) LOOP
    IF v_key NOT IN ('medical_aid', 'private', 'staff') THEN
      RAISE EXCEPTION 'Unknown price tier "%"', left(v_key, 30) USING ERRCODE = '22023';
    END IF;
    CONTINUE WHEN v_tier IS NULL OR jsonb_typeof(v_tier) = 'null';
    IF jsonb_typeof(v_tier) <> 'object' THEN
      RAISE EXCEPTION 'The % tier must give a markup and a dispensing fee', v_key USING ERRCODE = '22023';
    END IF;
    v_tiers := v_tiers || jsonb_build_object(v_key, jsonb_build_object(
      'markup_percent', public.stock_amount(v_tier -> 'markup_percent', format('The %s tier''s markup', replace(v_key, '_', ' ')), 1000),
      'fee', public.stock_amount(v_tier -> 'fee', format('The %s tier''s dispensing fee', replace(v_key, '_', ' ')), 100000)));
  END LOOP;

  IF v_rule IS NULL OR jsonb_typeof(v_rule) = 'null' THEN
    v_material := NULL;
  ELSIF jsonb_typeof(v_rule) <> 'object' THEN
    RAISE EXCEPTION 'The material rule must give the handling fee' USING ERRCODE = '22023';
  ELSE
    v_threshold := public.stock_amount(v_rule -> 'threshold', 'The cost limit', 10000000);
    IF v_threshold <= 0 THEN
      RAISE EXCEPTION 'The cost limit must be more than N$ 0.00' USING ERRCODE = '22023';
    END IF;
    IF v_rule -> 'max_fee' IS NULL OR jsonb_typeof(v_rule -> 'max_fee') = 'null' THEN
      v_max := NULL;
    ELSE
      v_max := public.stock_amount(v_rule -> 'max_fee', 'The largest handling fee', 10000000);
      IF v_max <= 0 THEN
        RAISE EXCEPTION 'The largest handling fee must be more than N$ 0.00, or left empty' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_material := jsonb_build_object(
      'lower_percent', public.stock_amount(v_rule -> 'lower_percent', 'The handling fee up to the cost limit', 1000),
      'threshold', v_threshold,
      'upper_percent', public.stock_amount(v_rule -> 'upper_percent', 'The handling fee above the cost limit', 1000),
      'max_fee', v_max);
  END IF;

  INSERT INTO public.stock_pricing_rules AS r (practice_id, medicine_tiers, material_rule, updated_by, updated_at)
  VALUES (p_practice_id, v_tiers, v_material, auth.uid(), now())
  ON CONFLICT (practice_id) DO UPDATE
    SET medicine_tiers = EXCLUDED.medicine_tiers,
        material_rule = EXCLUDED.material_rule,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
  RETURN jsonb_build_object('practice_id', p_practice_id, 'medicine_tiers', v_tiers, 'material_rule', v_material);
END
$$;

-- 6f. stock_save_reference_price(item, N$ per unit incl VAT | null or 0 to clear): administrators, practitioners and
--     nurses (as for changing an item). Medicines only.
CREATE OR REPLACE FUNCTION public.stock_save_reference_price(p_item_id uuid, p_reference_price numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item record;
BEGIN
  SELECT i.id, i.practice_id, i.category INTO v_item FROM public.practice_inventory i WHERE i.id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock item not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.stock_assert_role(v_item.practice_id, ARRAY['admin', 'doctor', 'nurse'], 'add or change stock items');
  IF p_reference_price IS NULL OR p_reference_price = 0 THEN
    DELETE FROM public.stock_reference_prices WHERE item_id = p_item_id;
    RETURN jsonb_build_object('item_id', p_item_id, 'reference_price', NULL);
  END IF;
  IF COALESCE(v_item.category, '') <> 'medications' THEN
    RAISE EXCEPTION 'A fund reference price is kept for medicines' USING ERRCODE = '22023';
  END IF;
  IF p_reference_price < 0 OR p_reference_price > 1000000 OR p_reference_price <> round(p_reference_price, 2) THEN
    RAISE EXCEPTION 'The reference price must be from N$ 0.01 to N$ 1,000,000.00 with at most 2 decimals' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.stock_reference_prices AS r (item_id, practice_id, reference_price, updated_by, updated_at)
  VALUES (p_item_id, v_item.practice_id, p_reference_price, auth.uid(), now())
  ON CONFLICT (item_id) DO UPDATE SET reference_price = EXCLUDED.reference_price, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN jsonb_build_object('item_id', p_item_id, 'reference_price', p_reference_price);
END
$$;

-- 6g. billing_save_promotion({id?, practice_id, name, kind, value, codes, starts_on, ends_on}): administrators. A new
--     promotion, or a change to one that has not ended. Two promotions never cover the same code on the same day.
CREATE OR REPLACE FUNCTION public.billing_save_promotion(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id       uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_existing public.billing_promotions%ROWTYPE;
  v_practice uuid;
  v_name     text := btrim(COALESCE(p_payload ->> 'name', ''));
  v_kind     text := COALESCE(p_payload ->> 'kind', '');
  v_value    numeric;
  v_codes    text[];
  v_starts   date := NULLIF(p_payload ->> 'starts_on', '')::date;
  v_ends     date := NULLIF(p_payload ->> 'ends_on', '')::date;
  v_clash    record;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.billing_promotions WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promotion not found' USING ERRCODE = 'P0002';
    END IF;
    v_practice := v_existing.practice_id;
  ELSE
    v_practice := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  END IF;
  PERFORM public.billing_assert_staff(v_practice, ARRAY['admin'], 'Only a practice administrator can change promotions');
  IF v_id IS NOT NULL AND v_existing.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'This promotion has ended, so it cannot be changed. Start a new one.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Give the promotion a name of 2 to 60 characters' USING ERRCODE = '22023';
  END IF;
  IF v_kind NOT IN ('percent', 'amount') THEN
    RAISE EXCEPTION 'A promotion takes a percentage or an amount off' USING ERRCODE = '22023';
  END IF;
  v_value := public.stock_amount(p_payload -> 'value', CASE v_kind WHEN 'percent' THEN 'The percentage' ELSE 'The amount' END,
                                 CASE v_kind WHEN 'percent' THEN 100 ELSE 1000000 END);
  IF v_value <= 0 THEN
    RAISE EXCEPTION '% must be more than 0', CASE v_kind WHEN 'percent' THEN 'The percentage' ELSE 'The amount' END USING ERRCODE = '22023';
  END IF;
  v_codes := public.billing_codes(p_payload -> 'codes', 50);
  IF v_starts IS NULL OR v_ends IS NULL THEN
    RAISE EXCEPTION 'Give the first and the last day of the promotion' USING ERRCODE = '22023';
  END IF;
  IF v_ends < v_starts THEN
    RAISE EXCEPTION 'The last day cannot be before the first day' USING ERRCODE = '22023';
  END IF;
  IF v_ends > v_starts + 731 THEN
    RAISE EXCEPTION 'A promotion runs for at most two years' USING ERRCODE = '22023';
  END IF;
  SELECT p.name, ARRAY(SELECT unnest(p.codes) INTERSECT SELECT unnest(v_codes) ORDER BY 1) AS shared INTO v_clash
    FROM public.billing_promotions p
   WHERE p.practice_id = v_practice AND p.id IS DISTINCT FROM v_id AND p.ended_at IS NULL
     AND p.codes && v_codes AND p.starts_on <= v_ends AND p.ends_on >= v_starts
   ORDER BY p.starts_on
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'The promotion "%" already covers % on some of these days: one promotion per code at a time', v_clash.name,
      array_to_string(v_clash.shared, ', ') USING ERRCODE = '23P01';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.billing_promotions (practice_id, name, kind, value, codes, starts_on, ends_on, created_by, updated_by)
    VALUES (v_practice, v_name, v_kind, v_value, v_codes, v_starts, v_ends, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.billing_promotions
       SET name = v_name, kind = v_kind, value = v_value, codes = v_codes, starts_on = v_starts, ends_on = v_ends,
           updated_by = auth.uid(), updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END
$$;

-- 6h. billing_end_promotion(id): administrators. It applies to nothing new; lines that had it keep their discount.
CREATE OR REPLACE FUNCTION public.billing_end_promotion(p_promotion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.billing_promotions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.billing_promotions WHERE id = p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.billing_assert_staff(v_row.practice_id, ARRAY['admin'], 'Only a practice administrator can end a promotion');
  IF v_row.ended_at IS NULL THEN
    UPDATE public.billing_promotions SET ended_at = now(), ended_by = auth.uid(), updated_by = auth.uid(), updated_at = now() WHERE id = p_promotion_id;
  END IF;
END
$$;

-- 6i. billing_save_package_type({id?, practice_id, name, codes, sessions, price, valid_months, is_active}):
--     administrators. Packages already sold keep what they were sold as.
CREATE OR REPLACE FUNCTION public.billing_save_package_type(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id       uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_practice uuid;
  v_name     text := btrim(COALESCE(p_payload ->> 'name', ''));
  v_codes    text[];
  v_sessions integer;
  v_price    numeric;
  v_months   integer;
  v_active   boolean := COALESCE((p_payload ->> 'is_active')::boolean, true);
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT t.practice_id INTO v_practice FROM public.billing_package_types t WHERE t.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Package not found' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    v_practice := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  END IF;
  PERFORM public.billing_assert_staff(v_practice, ARRAY['admin'], 'Only a practice administrator can change the packages');
  IF char_length(v_name) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Give the package a name of 2 to 60 characters' USING ERRCODE = '22023';
  END IF;
  v_codes := public.billing_codes(p_payload -> 'codes', 20);
  v_sessions := public.stock_int(p_payload -> 'sessions', 'The number of sessions', 1, 100);
  v_price := public.stock_amount(p_payload -> 'price', 'The price', 1000000);
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'The price must be more than N$ 0.00' USING ERRCODE = '22023';
  END IF;
  v_months := public.stock_int(p_payload -> 'valid_months', 'How many months it is valid', 1, 60);
  IF EXISTS (SELECT 1 FROM public.billing_package_types t
              WHERE t.practice_id = v_practice AND t.id IS DISTINCT FROM v_id AND lower(btrim(t.name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'There is already a package called "%"', v_name USING ERRCODE = '23505';
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.billing_package_types (practice_id, name, codes, sessions, price, valid_months, is_active, created_by, updated_by)
    VALUES (v_practice, v_name, v_codes, v_sessions, v_price, v_months, v_active, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.billing_package_types
       SET name = v_name, codes = v_codes, sessions = v_sessions, price = v_price, valid_months = v_months, is_active = v_active,
           updated_by = auth.uid(), updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END
$$;

-- 6j. billing_sell_package(patient, package type, practitioner?): anyone with billing rights. The package on its own
--     invoice dated today (the patient pays it; never claimed), usable from today for the type's months.
CREATE OR REPLACE FUNCTION public.billing_sell_package(p_patient_id uuid, p_package_type_id uuid, p_practitioner_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type    public.billing_package_types%ROWTYPE;
  v_today   date := public.ar_today();
  v_expires date;
  v_visit   uuid;
  v_invoice uuid;
  v_package uuid := gen_random_uuid();
  v_label   text;
BEGIN
  SELECT * INTO v_type FROM public.billing_package_types WHERE id = p_package_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.billing_assert_staff(v_type.practice_id, ARRAY['admin', 'doctor', 'nurse', 'receptionist'],
                                      'Only staff with billing rights can sell a package');
  IF NOT v_type.is_active THEN
    RAISE EXCEPTION 'The practice no longer sells "%"', v_type.name USING ERRCODE = '22023';
  END IF;
  IF p_patient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = v_type.practice_id) THEN
    RAISE EXCEPTION 'This patient is not a patient of your practice' USING ERRCODE = '42501';
  END IF;
  IF p_practitioner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_practitioner_id AND u.practice_id = v_type.practice_id) THEN
    RAISE EXCEPTION 'The practitioner is not on this practice''s staff' USING ERRCODE = '22023';
  END IF;
  v_expires := (v_today + make_interval(months => v_type.valid_months))::date;
  v_label := 'Prepaid package: ' || v_type.name || ' (' || v_type.sessions || ' x ' || array_to_string(v_type.codes, ', ')
             || '), valid until ' || to_char(v_expires, 'FMDD Mon YYYY');
  v_visit := public.billing_carrier_visit(v_type.practice_id, p_patient_id, 'package_sale',
    'Prepaid package "' || v_type.name || '" sold on ' || to_char(v_today, 'FMDD Mon YYYY') || '. Not a consultation.');
  v_invoice := public.billing_post_patient_invoice(v_type.practice_id, p_patient_id, v_visit, v_today, 'PKG', v_label, v_type.price,
                                                   p_practitioner_id, v_label);
  INSERT INTO public.patient_packages (id, practice_id, patient_id, package_type_id, name, codes, sessions, price, sold_on, expires_on,
                                       sale_invoice_id, visit_id, sold_by)
  VALUES (v_package, v_type.practice_id, p_patient_id, v_type.id, v_type.name, v_type.codes, v_type.sessions, v_type.price, v_today,
          v_expires, v_invoice, v_visit, auth.uid());
  RETURN jsonb_build_object('package_id', v_package, 'invoice_id', v_invoice,
                            'invoice_number', (SELECT i.invoice_number FROM public.invoices_enhanced i WHERE i.id = v_invoice),
                            'expires_on', v_expires);
END
$$;

-- 6k. billing_cancel_package(package, reason): administrators and practitioners. No session can be used from it any
--     more; its invoice stays (credit it in Finance when money goes back).
CREATE OR REPLACE FUNCTION public.billing_cancel_package(p_package_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.patient_packages%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO v_row FROM public.patient_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.billing_assert_staff(v_row.practice_id, ARRAY['admin', 'doctor'],
                                      'Only a practice administrator or practitioner can cancel a package');
  IF v_row.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'This package is already cancelled' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Say why the package is cancelled (3 to 200 characters)' USING ERRCODE = '22023';
  END IF;
  UPDATE public.patient_packages SET cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason WHERE id = p_package_id;
END
$$;

-- 6l. A patient's packages with the sessions used: quantities of invoice lines that carry the package, on the
--     patient's invoices of the package's practice that are not cancelled (one invoice can be left out: the visit being
--     billed, whose lines are on the screen). Runs with the caller's rights, so their policies decide what they see.
CREATE OR REPLACE FUNCTION public.billing_patient_packages(p_patient_id uuid, p_exclude_invoice_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, practice_id uuid, patient_id uuid, package_type_id uuid, name text, codes text[], sessions integer, price numeric,
  sold_on date, expires_on date, sale_invoice_id uuid, sale_invoice_number text, sale_cancelled boolean,
  cancelled_at timestamptz, cancel_reason text, used integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.id, p.practice_id, p.patient_id, p.package_type_id, p.name, p.codes, p.sessions, p.price, p.sold_on, p.expires_on,
         p.sale_invoice_id, si.invoice_number, (si.id IS NULL OR public.ar_is_cancelled(si.payment_status)),
         p.cancelled_at, p.cancel_reason, COALESCE(u.used, 0)::integer
    FROM public.patient_packages p
    LEFT JOIN public.invoices_enhanced si ON si.id = p.sale_invoice_id
    LEFT JOIN LATERAL (
      SELECT sum(COALESCE(s.quantity, 1)) AS used
        FROM public.invoice_services s
        JOIN public.invoices_enhanced i ON i.id = s.invoice_id
       WHERE s.package_id = p.id AND i.patient_id = p.patient_id AND i.practice_id = p.practice_id
         AND NOT public.ar_is_cancelled(i.payment_status)
         AND (p_exclude_invoice_id IS NULL OR i.id <> p_exclude_invoice_id)
    ) u ON true
   WHERE p.patient_id = p_patient_id
   ORDER BY p.sold_on DESC, p.created_at DESC
$$;

-- 6m. billing_save_payment_plan({patient_id, title, total, practitioner_id?, notes?, instalments: [{due_on, amount}]}):
--     anyone with billing rights. The instalments are worked out on the screen (src/utils/billing/paymentPlans.ts) and
--     checked here: 1 to 120, each more than N$ 0.00, on rising days, adding up to the total to the cent.
CREATE OR REPLACE FUNCTION public.billing_save_payment_plan(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient      uuid := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  v_practice     uuid;
  v_title        text := btrim(COALESCE(p_payload ->> 'title', ''));
  v_total        numeric;
  v_practitioner uuid := NULLIF(p_payload ->> 'practitioner_id', '')::uuid;
  v_notes        text := NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), '');
  v_list         jsonb := p_payload -> 'instalments';
  v_item         jsonb;
  v_count        integer;
  v_number       integer := 0;
  v_due          date;
  v_previous     date;
  v_amount       numeric;
  v_sum          numeric := 0;
  v_today        date := public.ar_today();
  v_plan         uuid;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = v_patient;
  PERFORM public.billing_assert_staff(v_practice, ARRAY['admin', 'doctor', 'nurse', 'receptionist'],
                                      'Only staff with billing rights can agree a payment plan');
  IF char_length(v_title) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Say what the plan is for in 2 to 60 characters' USING ERRCODE = '22023';
  END IF;
  v_total := public.stock_amount(p_payload -> 'total', 'The total', 10000000);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'The total must be more than N$ 0.00' USING ERRCODE = '22023';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 280 THEN
    RAISE EXCEPTION 'Keep the note to 280 characters' USING ERRCODE = '22023';
  END IF;
  IF v_practitioner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_practitioner AND u.practice_id = v_practice) THEN
    RAISE EXCEPTION 'The practitioner is not on this practice''s staff' USING ERRCODE = '22023';
  END IF;
  IF v_list IS NULL OR jsonb_typeof(v_list) <> 'array' THEN
    RAISE EXCEPTION 'Give the instalments' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(v_list);
  IF v_count NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'A plan has 1 to 120 instalments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_plans (practice_id, patient_id, title, total, practitioner_id, notes, created_by)
  VALUES (v_practice, v_patient, v_title, v_total, v_practitioner, v_notes, auth.uid())
  RETURNING id INTO v_plan;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(value, n) ORDER BY n LOOP
    v_number := v_number + 1;
    v_due := NULLIF(v_item ->> 'due_on', '')::date;
    IF v_due IS NULL THEN
      RAISE EXCEPTION 'Instalment %: give its date', v_number USING ERRCODE = '22023';
    END IF;
    IF v_due < v_today - 366 OR v_due > v_today + 3653 THEN
      RAISE EXCEPTION 'Instalment %: its date must be within a year back and ten years ahead', v_number USING ERRCODE = '22023';
    END IF;
    IF v_previous IS NOT NULL AND v_due <= v_previous THEN
      RAISE EXCEPTION 'Instalment %: each instalment falls after the one before it', v_number USING ERRCODE = '22023';
    END IF;
    v_amount := public.stock_amount(v_item -> 'amount', format('Instalment %s', v_number), 10000000);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Instalment %: the amount must be more than N$ 0.00', v_number USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.payment_plan_instalments (plan_id, practice_id, number, due_on, amount)
    VALUES (v_plan, v_practice, v_number, v_due, v_amount);
    v_sum := v_sum + v_amount;
    v_previous := v_due;
  END LOOP;
  IF v_sum <> v_total THEN
    RAISE EXCEPTION 'The instalments add up to N$ %, not the total of N$ %', to_char(v_sum, 'FM999999990.00'), to_char(v_total, 'FM999999990.00')
      USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('id', v_plan);
END
$$;

-- 6n. billing_stop_payment_plan(plan, reason): anyone with billing rights. Instalments not posted yet are never
--     posted; those posted stay on the account.
CREATE OR REPLACE FUNCTION public.billing_stop_payment_plan(p_plan_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.payment_plans%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO v_row FROM public.payment_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment plan not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.billing_assert_staff(v_row.practice_id, ARRAY['admin', 'doctor', 'nurse', 'receptionist'],
                                      'Only staff with billing rights can stop a payment plan');
  IF v_row.stopped_at IS NOT NULL THEN
    RAISE EXCEPTION 'This plan is already stopped' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Say why the plan is stopped (3 to 200 characters)' USING ERRCODE = '22023';
  END IF;
  UPDATE public.payment_plans SET stopped_at = now(), stopped_by = auth.uid(), stop_reason = v_reason WHERE id = p_plan_id;
END
$$;

-- 6o. billing_post_due_instalments(practice, patient?): anyone with billing rights. Every instalment of a plan that is
--     not stopped, due today or earlier and not posted becomes an invoice the patient pays, dated its due day (or the
--     first open day after a closed month). Rows another session is posting are skipped (SKIP LOCKED), so opening the
--     same account twice never posts an instalment twice. Returns {posted, total, waiting}: waiting counts instalments
--     that cannot be dated yet because every month up to today is closed.
CREATE OR REPLACE FUNCTION public.billing_post_due_instalments(p_practice_id uuid, p_patient_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         record;
  v_today   date := public.ar_today();
  v_date    date;
  v_visit   uuid;
  v_invoice uuid;
  v_text    text;
  v_posted  integer := 0;
  v_waiting integer := 0;
  v_total   numeric := 0;
BEGIN
  PERFORM public.billing_assert_staff(p_practice_id, ARRAY['admin', 'doctor', 'nurse', 'receptionist'],
                                      'Only staff with billing rights can post payment plan instalments');
  FOR r IN
    SELECT i.id, i.plan_id, i.number, i.due_on, i.amount, p.patient_id, p.title, p.practitioner_id,
           (SELECT count(*) FROM public.payment_plan_instalments x WHERE x.plan_id = i.plan_id) AS of_count
      FROM public.payment_plan_instalments i
      JOIN public.payment_plans p ON p.id = i.plan_id
     WHERE p.practice_id = p_practice_id AND (p_patient_id IS NULL OR p.patient_id = p_patient_id)
       AND p.stopped_at IS NULL AND i.posted_at IS NULL AND i.due_on <= v_today
     ORDER BY i.plan_id, i.number
       FOR UPDATE OF i SKIP LOCKED
  LOOP
    v_date := public.dc_first_open_day(p_practice_id, r.due_on);
    IF v_date > v_today THEN
      v_waiting := v_waiting + 1;
      CONTINUE;
    END IF;
    SELECT p.visit_id INTO v_visit FROM public.payment_plans p WHERE p.id = r.plan_id FOR UPDATE;
    IF v_visit IS NULL THEN
      v_visit := public.billing_carrier_visit(p_practice_id, r.patient_id, 'payment_plan',
        'Payment plan "' || r.title || '": its instalments are billed to this patient''s account. Not a consultation.');
      UPDATE public.payment_plans SET visit_id = v_visit WHERE id = r.plan_id;
    END IF;
    v_text := 'Payment plan: ' || r.title || ', instalment ' || r.number || ' of ' || r.of_count;
    v_invoice := public.billing_post_patient_invoice(p_practice_id, r.patient_id, v_visit, v_date, 'PLAN', v_text, r.amount,
      r.practitioner_id,
      v_text || CASE WHEN v_date <> r.due_on THEN ' (due ' || to_char(r.due_on, 'FMDD Mon YYYY') || ', in a closed month)' ELSE '' END);
    UPDATE public.payment_plan_instalments
       SET invoice_id = v_invoice, posted_on = v_date, posted_at = now(), posted_by = auth.uid()
     WHERE id = r.id;
    v_posted := v_posted + 1;
    v_total := v_total + r.amount;
  END LOOP;
  RETURN jsonb_build_object('posted', v_posted, 'total', v_total, 'waiting', v_waiting);
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Row level security and grants
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['stock_pricing_rules', 'stock_reference_prices', 'billing_promotions', 'billing_package_types',
                                 'patient_packages', 'payment_plans', 'payment_plan_instalments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_staff_read', v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u '
                   'WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = %I.practice_id))',
                   v_table || '_staff_read', v_table, v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
  END LOOP;
END $$;

-- Internal helpers: only the functions below use them
REVOKE ALL ON FUNCTION public.billing_assert_staff(uuid, text[], text), public.billing_codes(jsonb, integer),
  public.billing_carrier_visit(uuid, uuid, text, text),
  public.billing_post_patient_invoice(uuid, uuid, uuid, date, text, text, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
-- What the app calls
REVOKE ALL ON FUNCTION public.stock_save_pricing_rules(uuid, jsonb), public.stock_save_reference_price(uuid, numeric),
  public.billing_save_promotion(jsonb), public.billing_end_promotion(uuid), public.billing_save_package_type(jsonb),
  public.billing_sell_package(uuid, uuid, uuid), public.billing_cancel_package(uuid, text),
  public.billing_patient_packages(uuid, uuid), public.billing_save_payment_plan(jsonb), public.billing_stop_payment_plan(uuid, text),
  public.billing_post_due_instalments(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_save_pricing_rules(uuid, jsonb), public.stock_save_reference_price(uuid, numeric),
  public.billing_save_promotion(jsonb), public.billing_end_promotion(uuid), public.billing_save_package_type(jsonb),
  public.billing_sell_package(uuid, uuid, uuid), public.billing_cancel_package(uuid, text),
  public.billing_patient_packages(uuid, uuid), public.billing_save_payment_plan(jsonb), public.billing_stop_payment_plan(uuid, text),
  public.billing_post_due_instalments(uuid, uuid) TO authenticated, service_role;

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['stock_pricing_rules', 'stock_reference_prices', 'billing_promotions', 'billing_package_types',
                                   'patient_packages', 'payment_plans', 'payment_plan_instalments'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  v_fn text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_pricing_rules', 'stock_reference_prices', 'billing_promotions', 'billing_package_types',
                           'patient_packages', 'payment_plans', 'payment_plan_instalments'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION 'Check failed: %: row level security is off', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_staff_read') <> 1 THEN
      RAISE EXCEPTION 'Check failed: %: expected 1 staff read policy', t;
    END IF;
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION 'Check failed: %: the patient app''s staff-only guard is missing', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles)) THEN
      RAISE EXCEPTION 'Check failed: %: a policy is open to anon', t;
    END IF;
    IF NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       OR has_table_privilege('anon', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION 'Check failed: %: signed-in users must read only, anon nothing', t;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.stock_save_pricing_rules(uuid,jsonb)', 'public.stock_save_reference_price(uuid,numeric)',
    'public.billing_save_promotion(jsonb)', 'public.billing_end_promotion(uuid)', 'public.billing_save_package_type(jsonb)',
    'public.billing_sell_package(uuid,uuid,uuid)', 'public.billing_cancel_package(uuid,text)', 'public.billing_patient_packages(uuid,uuid)',
    'public.billing_save_payment_plan(jsonb)', 'public.billing_stop_payment_plan(uuid,text)', 'public.billing_post_due_instalments(uuid,uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in staff only', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.billing_assert_staff(uuid,text[],text)', 'public.billing_codes(jsonb,integer)',
    'public.billing_carrier_visit(uuid,uuid,text,text)', 'public.billing_post_patient_invoice(uuid,uuid,uuid,date,text,text,numeric,uuid,text)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is internal', v_fn;
    END IF;
  END LOOP;
  -- The new line columns are empty and optional
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice_services'
              AND column_name IN ('promotion_id', 'package_id') AND is_nullable = 'NO') THEN
    RAISE EXCEPTION 'Check failed: the new invoice line columns must be optional';
  END IF;
  -- Nothing already billed changed, and no policy changed
  IF current_setting('onehealth.invoices_before', true) IS DISTINCT FROM (
    SELECT md5(COALESCE(string_agg(id::text || '|' || COALESCE(total, 0)::text || '|' || COALESCE(medical_aid_total, 0)::text || '|' || COALESCE(patient_total, 0)::text, ';' ORDER BY id), ''))
      FROM public.invoices_enhanced) THEN
    RAISE EXCEPTION 'Check failed: an invoice''s total or split changed';
  END IF;
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'practice_inventory', 'visits', 'patients', 'users', 'stock_settings')) THEN
    RAISE EXCEPTION 'Check failed: a policy of invoice_services, invoices_enhanced, practice_inventory, visits, patients, users or stock_settings changed';
  END IF;
END $$;

ROLLBACK;
