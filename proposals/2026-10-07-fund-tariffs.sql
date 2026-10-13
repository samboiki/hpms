-- Applied 2026-10-07 as migration fund_tariffs_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: fund tariff schedules (the funds' own prices), contracts, 8109 staff count
-- File:    proposals/2026-10-07-fund-tariffs.sql                         Drafted: 2026-10-07
-- Code:    src/utils/billing/fundPricing.ts  (THE price rule: fundPriceFor; tested)
--          src/utils/billing/tariffImport.ts (reading NAMAF / fund schedule files; tested)
--          src/utils/billing/tariffRules.ts  (8109, 8346, restoration and per-visit code lists)
--          src/services/fundPricingService.ts (reads and writes), src/components/visits/useFundPricing.ts
-- Screens: Admin > Tariffs (src/pages/admin/TariffManagement.tsx); every billing screen prices from it
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- Why
--   HPMS had one price per tariff code (practice_tariffs.price, per practice type). PSEMAS (fund code
--   MAG1, about 65% of the dental practice's claim value) pays its own dental tariff, about 61% of the
--   NAMAF 2024 benchmark and unchanged in 2025; the private funds (NMC1, NHPM, NAMM, PROS) follow the
--   NAMAF benchmark. PSEMAS claims would have gone out at private rates and been cut on assessment.
--
-- How prices are chosen (fundPriceFor; the app, not the database, applies it)
--   For a patient's fund (medical_aid_details -> medical_aid_providers.medical_aid_reference) on the
--   service date, most specific first:
--     1. this practice's own prices for the fund (fund_tariffs with practice_id set): the patient's plan
--        option first, then every plan;
--     2. this practice's contract with the fund (fund_tariff_contracts): a percentage of the practice
--        tariff or of a fund's schedule, rounded half up to the cent;
--     3. the fund's schedule for every practice of the type (fund_tariffs with practice_id NULL);
--     4. the practice tariff (practice_tariffs), exactly as before.
--   Within one level the newest effective_from in effect wins; two different prices starting the same
--   day are refused (the unique index below stops them being saved). 8346 is always 10% of its
--   restoration's price for that fund, so it never gets a fund row.
--   Patients without medical aid, and funds without rows, get the practice tariff unchanged.
--
-- How to apply
--   1. Review. Run it on a Supabase branch (or a copy of the database) with the final ROLLBACK changed
--      to COMMIT. In section 7 replace <13-digit practice number> with the practice number printed on
--      the claim files first (or leave it: nothing is changed for 8109's default then).
--   2. Check in the app (Admin > Tariffs):
--        - "Fund prices" > PSEMAS (MAG1): 31 codes at the PSEMAS price, e.g. 8369 N$ 386.10 against the
--          practice tariff N$ 663.00; NMC1 shows every code at the practice tariff;
--        - a visit for a PSEMAS patient: the billing tab says "PSEMAS (MAG1) prices", 8369 is N$ 386.10,
--          its 8346 is N$ 38.61 and 8109 is 2 x N$ 20.00; a private patient's lines are unchanged;
--        - a quote for a PSEMAS patient estimates the PSEMAS lines as the fund's portion.
--      Until this script is applied the app behaves exactly as before (no fund prices, 8109 quantity 1
--      by default but now changeable from 1 to 3) and the Tariffs page says fund prices are not on.
--   3. Apply to production the same way (one transaction).
--   4. Confirm the current PSEMAS dental schedule with PSEMAS: the seed is what PSEMAS paid from
--      December 2023 to March 2025. A newer schedule is imported on Admin > Tariffs > Import a schedule
--      with its start date; the seeded prices then stop applying from that date by themselves.
--
-- Contents
--   0. Look first (read only)
--   1. fund_tariffs: the funds' own prices, per practice type, with effective dates
--   2. fund_tariffs_with_types: the view the app reads (filtered by practice type name, like
--      practice_tariffs_with_types)
--   3. fund_tariff_contracts: a practice's agreed price with a fund as a percentage of a schedule
--   4. RLS: practice staff read; practice admins write their practice's rows; platform administrators
--      write the shared schedules; practice_tariffs: platform administrators may add new versions
--   5. Seed: PSEMAS (MAG1) dental schedule, 31 codes, from the claim history aggregates
--   6. 8109 per clinical staff member: the dental tariff's multiply rule becomes YES
--   7. Practice setting: 8109 default staff count 2 for this practice
--   8. Retire medical_aid_service_prices (demo rows only; the quotes estimate now uses fund_tariffs)
--   9. Patient portal guard (when that proposal is applied) and checks
--   Undo at the end.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Look first (read only)
-- ---------------------------------------------------------------------------------------------

-- The dental practice type the seed is for (exactly one row expected)
SELECT id, name FROM public.practice_types WHERE lower(btrim(name)) = 'dental';

-- The fund codes the seed and the app use (MAG1 must exist for PSEMAS patients to get PSEMAS prices)
SELECT id, name, short_name, medical_aid_reference
FROM public.medical_aid_providers
WHERE medical_aid_reference IN ('MAG1', 'NMC1', 'NHPM', 'NAMM', 'PROS')
ORDER BY medical_aid_reference;

-- 8109 on the dental tariff today (expected: can_be_multiplied SOMETIMES)
SELECT pt.code, pt.price, pt.can_be_multiplied, pt.effective_from, t.name AS practice_type
FROM public.practice_tariffs pt JOIN public.practice_types t ON t.id = pt.practice_type_id
WHERE pt.code = '8109';

-- ---------------------------------------------------------------------------------------------
-- 1. fund_tariffs
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fund_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scoped like practice_tariffs: a schedule belongs to a discipline (dental, GP, urology...)
  practice_type_id uuid NOT NULL REFERENCES public.practice_types(id) ON DELETE RESTRICT,
  -- NULL: the fund's schedule for every practice of the type; set: this practice's own agreed prices
  practice_id uuid REFERENCES public.practices(id) ON DELETE CASCADE,
  -- medical_aid_providers.medical_aid_reference, the fund code on claims (MAG1 = PSEMAS)
  fund_reference text NOT NULL CHECK (fund_reference ~ '^[A-Z0-9]{2,10}$'),
  -- NULL: every plan option of the fund; set: only patients whose plan (or scheme) has this name
  plan_option text CHECK (plan_option IS NULL OR char_length(btrim(plan_option)) BETWEEN 1 AND 60),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{1,10}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0 AND unit_price <= 1000000),
  effective_from date NOT NULL,
  effective_to date CHECK (effective_to IS NULL OR effective_to >= effective_from),
  is_active boolean NOT NULL DEFAULT true,
  -- Where the prices came from (imported file, or how the seed was derived)
  source text CHECK (source IS NULL OR char_length(source) <= 300),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.fund_tariffs IS
  'The funds'' own prices per practice type (e.g. the PSEMAS dental tariff) with effective dates. The app bills a medical aid patient the fund''s price where it has one (src/utils/billing/fundPricing.ts), otherwise the practice tariff.';

-- One price per fund, plan option, scope, code and start date: a second price starting the same day is
-- ambiguous, so it is refused here as well as in the app
CREATE UNIQUE INDEX IF NOT EXISTS fund_tariffs_one_version_per_day
  ON public.fund_tariffs (
    practice_type_id,
    COALESCE(practice_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fund_reference,
    lower(COALESCE(plan_option, '')),
    code,
    effective_from
  )
  WHERE is_active;
CREATE INDEX IF NOT EXISTS fund_tariffs_by_type_and_fund ON public.fund_tariffs (practice_type_id, fund_reference, code);
CREATE INDEX IF NOT EXISTS fund_tariffs_by_practice ON public.fund_tariffs (practice_id) WHERE practice_id IS NOT NULL;

-- Codes and fund codes compare in capitals without spaces; updated_at / updated_by on every change
CREATE OR REPLACE FUNCTION public.fund_tariffs_normalise()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.fund_reference := upper(btrim(NEW.fund_reference));
  NEW.code := upper(btrim(NEW.code));
  NEW.plan_option := NULLIF(btrim(NEW.plan_option), '');
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS fund_tariffs_normalise ON public.fund_tariffs;
CREATE TRIGGER fund_tariffs_normalise
  BEFORE INSERT OR UPDATE ON public.fund_tariffs
  FOR EACH ROW EXECUTE FUNCTION public.fund_tariffs_normalise();

-- ---------------------------------------------------------------------------------------------
-- 2. fund_tariffs_with_types (the app filters by practice type name, as for practice_tariffs)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.fund_tariffs_with_types
WITH (security_invoker = true) AS
SELECT ft.*, pt.name AS practice_type_name
FROM public.fund_tariffs ft
JOIN public.practice_types pt ON pt.id = ft.practice_type_id;
COMMENT ON VIEW public.fund_tariffs_with_types IS 'fund_tariffs with the practice type name; RLS of fund_tariffs applies (security_invoker).';

-- ---------------------------------------------------------------------------------------------
-- 3. fund_tariff_contracts
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fund_tariff_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  fund_reference text NOT NULL CHECK (fund_reference ~ '^[A-Z0-9]{2,10}$'),
  plan_option text CHECK (plan_option IS NULL OR char_length(btrim(plan_option)) BETWEEN 1 AND 60),
  -- NULL: a percentage of the practice tariff; a fund code: a percentage of that fund's schedule
  -- (the fund's own code here is "contract % x scheme rate")
  base_fund_reference text CHECK (base_fund_reference IS NULL OR base_fund_reference ~ '^[A-Z0-9]{2,10}$'),
  percent numeric(6,2) NOT NULL CHECK (percent > 0 AND percent <= 500),
  effective_from date NOT NULL,
  effective_to date CHECK (effective_to IS NULL OR effective_to >= effective_from),
  is_active boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.fund_tariff_contracts IS
  'A practice''s agreed price with a fund as a percentage of the practice tariff or of a fund''s schedule. Applies after the practice''s own fixed fund prices and before the fund''s shared schedule.';

CREATE UNIQUE INDEX IF NOT EXISTS fund_tariff_contracts_one_per_day
  ON public.fund_tariff_contracts (practice_id, fund_reference, lower(COALESCE(plan_option, '')), effective_from)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.fund_tariff_contracts_normalise()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.fund_reference := upper(btrim(NEW.fund_reference));
  NEW.base_fund_reference := NULLIF(upper(btrim(NEW.base_fund_reference)), '');
  NEW.plan_option := NULLIF(btrim(NEW.plan_option), '');
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS fund_tariff_contracts_normalise ON public.fund_tariff_contracts;
CREATE TRIGGER fund_tariff_contracts_normalise
  BEFORE INSERT OR UPDATE ON public.fund_tariff_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fund_tariff_contracts_normalise();

-- ---------------------------------------------------------------------------------------------
-- 4. RLS (the practice_tariffs rule: staff of the practice read, admins write; shared rows are
--    platform data, so only platform administrators change them)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.fund_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_tariff_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fund_tariffs_select ON public.fund_tariffs;
CREATE POLICY fund_tariffs_select ON public.fund_tariffs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (COALESCE(u.is_super_admin, false) OR fund_tariffs.practice_id IS NULL OR u.practice_id = fund_tariffs.practice_id)
    )
  );

DROP POLICY IF EXISTS fund_tariffs_write ON public.fund_tariffs;
CREATE POLICY fund_tariffs_write ON public.fund_tariffs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          COALESCE(u.is_super_admin, false)
          OR (fund_tariffs.practice_id IS NOT NULL AND u.role = 'admin' AND u.practice_id = fund_tariffs.practice_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          COALESCE(u.is_super_admin, false)
          OR (fund_tariffs.practice_id IS NOT NULL AND u.role = 'admin' AND u.practice_id = fund_tariffs.practice_id)
        )
    )
  );

DROP POLICY IF EXISTS fund_tariff_contracts_select ON public.fund_tariff_contracts;
CREATE POLICY fund_tariff_contracts_select ON public.fund_tariff_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (COALESCE(u.is_super_admin, false) OR u.practice_id = fund_tariff_contracts.practice_id)
    )
  );

DROP POLICY IF EXISTS fund_tariff_contracts_write ON public.fund_tariff_contracts;
CREATE POLICY fund_tariff_contracts_write ON public.fund_tariff_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (COALESCE(u.is_super_admin, false) OR (u.role = 'admin' AND u.practice_id = fund_tariff_contracts.practice_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (COALESCE(u.is_super_admin, false) OR (u.role = 'admin' AND u.practice_id = fund_tariff_contracts.practice_id))
    )
  );

GRANT SELECT ON public.fund_tariffs_with_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_tariffs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_tariff_contracts TO authenticated;

-- 4b. practice_tariffs: the Tariffs page adds next year's NAMAF benchmark as new versions (never
--     changing existing rows). Look at the live policies first; this adds an INSERT policy for platform
--     administrators only, leaving every other policy as it is.
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'practice_tariffs';

DROP POLICY IF EXISTS practice_tariffs_insert_platform_admin ON public.practice_tariffs;
CREATE POLICY practice_tariffs_insert_platform_admin ON public.practice_tariffs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_super_admin, false)));

-- ---------------------------------------------------------------------------------------------
-- 5. Seed: the PSEMAS (MAG1) dental schedule
--
--    Derived from the practice's Eminance claim files (D:\emminance\History, 160 files, 12,527 lines,
--    9,095 priced MAG1 lines with service dates 13 Dec 2023 - 5 Mar 2025), per-code aggregates only:
--    unit price = line amount / quantity. A code is seeded when it has at least 5 priced lines and one
--    price covers at least 95% of them. Every other price seen on those codes is exactly the NAMAF 2024
--    benchmark price (lines sent at the wrong scale), and every seeded price is 61.0-61.2% of NAMAF 2024.
--    The prices did not change during 2025, so the schedule starts on the first service date seen and has
--    no end date. Descriptions stay those of the practice tariff.
--
--    Left out (each is billed at the practice tariff for PSEMAS until a price is added):
--      too few lines (1-4 each, all at 61.2% of NAMAF 2024, but not enough to be sure):
--        8132, 8133, 8140, 8184, 8186, 8210, 8225, 8327, 8339, 8340
--      not a fixed fee: 8146 (resin bonding, by arrangement), 8220 (suture at cost: 400, 950, 1000)
--      computed: 8346 (always 10% of its restoration's price for the fund)
--      laboratory items (technician fees at cost, claimed under 8099 with the lab slip):
--        9301, 9327, 9330, 9351, 9355, 9358, 9447, 9587, 9631, 9700, 9722, 9726, 9776
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.fund_tariffs (practice_type_id, practice_id, fund_reference, plan_option, code, unit_price, effective_from, source)
SELECT pt.id, NULL, 'MAG1', NULL, v.code, v.unit_price, DATE '2023-12-13',
       'PSEMAS dental tariff paid on the practice''s claims, Dec 2023 - Mar 2025 (Eminance history aggregates)'
FROM (VALUES
    ('8101', 148.30),  -- 321 lines, 98.1% at this price
    ('8104', 80.00),   -- 196 lines, 99.0%
    ('8107', 78.90),   -- 167 lines, 99.4% (per film)
    ('8109', 20.00),   -- 522 lines, 98.5% (per clinical staff member)
    ('8110', 44.70),   -- 514 lines, 98.4%
    ('8119', 215.40),  -- 31 lines, 100%
    ('8131', 121.20),  -- 75 lines, 97.3%
    ('8145', 23.50),   -- 373 lines, 98.9%
    ('8151', 121.20),  -- 252 lines, 98.8%
    ('8155', 121.20),  -- 245 lines, 99.6%
    ('8159', 238.90),  -- 246 lines, 97.6%
    ('8161', 121.20),  -- 454 lines, 99.3%
    ('8163', 78.90),   -- 22 lines, 100%
    ('8167', 93.00),   -- 266 lines, 98.9%
    ('8185', 633.30),  -- 8 lines, 100%
    ('8201', 121.20),  -- 65 lines, 100%
    ('8209', 521.40),  -- 22 lines, 100%
    ('8213', 521.40),  -- 54 lines, 98.1%
    ('8255', 116.50),  -- 6 lines, 100%
    ('8273', 90.60),   -- 14 lines, 100%
    ('8303', 162.40),  -- 166 lines, 99.4%
    ('8304', 94.20),   -- 173 lines, 98.8% (per arch)
    ('8338', 841.60),  -- 6 lines, 100%
    ('8351', 240.10),  -- 17 lines, 100%
    ('8352', 304.90),  -- 22 lines, 100%
    ('8353', 361.40),  -- 88 lines, 98.9%
    ('8354', 404.90),  -- 144 lines, 95.1%
    ('8367', 261.30),  -- 109 lines, 99.1%
    ('8368', 321.30),  -- 292 lines, 99.7%
    ('8369', 386.10),  -- 1223 lines, 99.1%
    ('8370', 421.40)   -- 533 lines, 98.9%
  ) AS v(code, unit_price)
JOIN public.practice_types pt ON lower(btrim(pt.name)) = 'dental'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 6. 8109 is billed per dentist, hygienist and assistant (NAMAF 2025: "per dentist, per hygienist,
--    per dental assistant, per visit"; the practice sent quantity 2 on 794 of 798 lines). The app bills
--    it from the practice's staff count (1-3) whatever this flag says; the flag is corrected so every
--    screen and report reads the same rule. The old text "20.00 x procedures" mixed the PSEMAS and NAMAF
--    prices of one staff member.
-- ---------------------------------------------------------------------------------------------

UPDATE public.practice_tariffs
SET can_be_multiplied = 'YES',
    business_rule_formula = 'Per clinical staff member at the visit (dentist, hygienist, assistant), at most 3',
    example_calculation = 'Dentist and assistant: 2 x the 8109 price',
    updated_at = now()
WHERE code = '8109'
  AND practice_type_id IN (SELECT id FROM public.practice_types WHERE lower(btrim(name)) = 'dental');

-- ---------------------------------------------------------------------------------------------
-- 7. The practice's default 8109 staff count (dentist and assistant: 2). Without this row the app bills
--    1, as before; staff can change it on every visit (1-3), and admins on Admin > Tariffs.
--    Replace the placeholder with the practice number printed on the claim files.
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
SELECT p.id, 'infection_control_staff', to_jsonb(2), 'number', '8109 infection control: clinical staff billed per visit (1-3)', false
FROM public.practices p
WHERE p.practice_number = '<13-digit practice number>'
ON CONFLICT (practice_id, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_type = EXCLUDED.setting_type, updated_at = now();

-- ---------------------------------------------------------------------------------------------
-- 8. Retire medical_aid_service_prices. The quotes estimate read the fund's rates from it; it only ever
--    held demo rows, and the estimate now uses the fund's own prices (fund_tariffs). It is renamed, not
--    dropped, so nothing is lost; drop it after a release if nobody misses it. Look first:
-- ---------------------------------------------------------------------------------------------

--   SELECT service_code, service_name, count(*) AS rows FROM public.medical_aid_service_prices GROUP BY 1, 2 ORDER BY 1;

DO $$
BEGIN
  IF to_regclass('public.medical_aid_service_prices') IS NOT NULL AND to_regclass('public.medical_aid_service_prices_retired') IS NULL THEN
    ALTER TABLE public.medical_aid_service_prices RENAME TO medical_aid_service_prices_retired;
    COMMENT ON TABLE public.medical_aid_service_prices_retired IS
      'Retired 2026-10: demo rows only. Fund prices live in fund_tariffs (proposals/2026-10-07-fund-tariffs.sql).';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Patient portal guard (when proposals/2026-10-07-patient-portal.sql is applied, patient logins
--    must not read the new tables), then checks
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

-- Expected: 31 rows, from 2023-12-13, no end date
SELECT count(*) AS psemas_codes, min(effective_from) AS starts, max(effective_to) AS ends
FROM public.fund_tariffs WHERE fund_reference = 'MAG1' AND practice_id IS NULL;

-- Expected: 8369 386.10 (PSEMAS) next to the practice tariff 663.00; 8109 20.00 next to 34.40
SELECT ft.code, ft.unit_price AS psemas, pt.price AS practice_tariff, round(100 * ft.unit_price / NULLIF(pt.price, 0), 1) AS percent
FROM public.fund_tariffs ft
JOIN public.practice_tariffs pt ON pt.code = ft.code AND pt.practice_type_id = ft.practice_type_id
  AND COALESCE(pt.is_active, true) AND (pt.effective_to IS NULL OR pt.effective_to >= current_date)
  AND (pt.effective_from IS NULL OR pt.effective_from <= current_date)
WHERE ft.fund_reference = 'MAG1' AND ft.code IN ('8101', '8109', '8369')
ORDER BY ft.code;

-- Expected: YES for the dental type
SELECT code, can_be_multiplied FROM public.practice_tariffs
WHERE code = '8109' AND practice_type_id IN (SELECT id FROM public.practice_types WHERE lower(btrim(name)) = 'dental');

-- Expected: one row with 2 (none if the placeholder in section 7 was left)
SELECT practice_id, setting_value FROM public.practice_settings WHERE setting_key = 'infection_control_staff';

-- Expected: the policies of section 4
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('fund_tariffs', 'fund_tariff_contracts', 'practice_tariffs') ORDER BY 1, 2;

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction:
--   BEGIN;
--   DROP VIEW IF EXISTS public.fund_tariffs_with_types;
--   DROP TABLE IF EXISTS public.fund_tariff_contracts;
--   DROP TABLE IF EXISTS public.fund_tariffs;
--   DROP FUNCTION IF EXISTS public.fund_tariffs_normalise();
--   DROP FUNCTION IF EXISTS public.fund_tariff_contracts_normalise();
--   DROP POLICY IF EXISTS practice_tariffs_insert_platform_admin ON public.practice_tariffs;
--   UPDATE public.practice_tariffs SET can_be_multiplied = 'SOMETIMES', updated_at = now()
--     WHERE code = '8109' AND practice_type_id IN (SELECT id FROM public.practice_types WHERE lower(btrim(name)) = 'dental');
--   DELETE FROM public.practice_settings WHERE setting_key = 'infection_control_staff';
--   ALTER TABLE IF EXISTS public.medical_aid_service_prices_retired RENAME TO medical_aid_service_prices;
--   COMMIT;
-- The app keeps working after the undo: without the tables every patient is billed the practice
-- tariff and 8109 starts at 1.
-- =============================================================================================
