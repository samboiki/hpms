-- Applied 2026-10-13 as migration patient_price_rates_2026_10_13 (version 20261013044128; stored statement md5 2ae4e0640fcf0eff33bb5dbd168e750c = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: set_patient_price_rate 9df7ed941bc9ae9ef40285c882c2ffb2; 2 policies (read, portal guard).
-- Rehearsed (rolled back) with simulated logins, and the checks repeated after applying: a practitioner set a staff
-- rate of 50% (by them), changed it to ' Contract ' 80.5 (one row, contract 80.50), a staff rate of 100% and a
-- private rate without a percentage kept "the usual price"; a kind 'vip', 5%, 600% and 50.555% (22023), another
-- practice's patient and no patient (42501) were refused; removing it twice left no row. The administrator set a
-- private rate of 120%; direct inserts and updates were refused (42501). A receptionist read it but could not set one
-- (42501). Another practice's doctor read 0 and could not set this practice's patient's rate either way (42501), only
-- their own patient's. A patient-app login read 0 and could not set one (42501); anon 42501 on both.
-- =============================================================================================
-- PROPOSAL: a patient's price rate (private, staff or contract), on the practice's existing prices (parity R28)
-- File:   proposals/2026-10-13-patient-price-rates.sql                  Drafted: 2026-10-13
-- Code:   src/utils/billing/patientRates.ts (the rate, its limits and words; tested), src/services/patientRateService.ts
--         (reads and the one write; "not set up" before this file), src/components/patients/PatientPriceRatePanel.tsx
--         (the patient file's Billing tab), visitBillingLines.ts priceForPatient (the visit's and the quote's prices),
--         useFundPricing.ts (loads it with the fund), quoteService.ts (quotes), StockLineMenu.tsx (staff medicine price)
--
-- Why (R28): Eminance lets an account carry a price rate (a private, staff or contract rate) that sets the price of what
-- is billed to it. OneHealth priced every patient alike: the practice tariff, the fund's prices for a medical aid
-- patient and the treating practitioner's own rate, so a staff member or a contract patient was charged in full and
-- the discount was typed on every line by hand.
--
-- How it prices (no second price list: it works on the prices OneHealth already has)
--   - A rate is a percentage of the usual price (10% to 500%; none or 100%: the usual price). It prices the codes billed
--     at the practice's price list: the price the treating practitioner charges anyone (the practice tariff at their
--     own rate), times the patient's rate. A medical aid's own price (its schedule, the practice's agreed price, a fund
--     contract) is never changed, so claims keep the fund's prices. A fee changed by hand stays as typed.
--   - A staff rate also bills the patient's medicines at the practice's staff medicine price (Stock > Settings), when
--     the practice has one.
--   - Lines already on a visit or quote keep their prices; new lines and quotes use the rate.
--
-- What it does (additive: no existing table, policy or row is changed; patients and its policies are not touched)
--   1. patient_price_rates: at most one rate per patient: what it is (private, staff, contract), the percentage, who
--      set it and when. Removing the rate removes the row. Patient merges keep the kept file's rate (one row a patient).
--   2. RLS: staff of the practice (and OneHealth support) read; nobody writes directly; the patient app's guard.
--   3. set_patient_price_rate(practice, patient, kind, percent): practice administrators and practitioners (the
--      billing extras' billing_assert_staff); kind null removes the rate; the database checks the kind and the
--      percentage as the screen does.
--   4. Checks: row level security, the guard, the function's rights, nothing for the public key.
--   Needs practice isolation's rls_my_practice_id() and rls_is_super_admin(), and billing_assert_staff() from
--   proposals/2026-10-13-billing-extras.sql.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the Billing tab says price rates are not set up yet and every patient is priced as before.
-- Undo (rates are lost; patients are priced as before; invoices already made keep their prices):
--   DROP FUNCTION IF EXISTS public.set_patient_price_rate(uuid, uuid, text, numeric);
--   DROP TABLE IF EXISTS public.patient_price_rates;
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the functions this file builds on are missing
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(signature, ', ') INTO v_missing
    FROM (VALUES ('public.rls_my_practice_id()'), ('public.rls_is_super_admin()'),
                 ('public.billing_assert_staff(uuid,text[],text)')) AS t(signature)
   WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. patient_price_rates
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_price_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- What the rate is: private, staff or contract (a staff rate also takes the staff medicine price)
  kind text NOT NULL CHECK (kind IN ('private', 'staff', 'contract')),
  -- Percentage of the usual price (src/utils/billing/patientRates.ts); NULL: the usual price
  percent numeric(5,2) CHECK (percent IS NULL OR (percent BETWEEN 10 AND 500 AND percent <> 100)),
  set_by uuid DEFAULT auth.uid(),
  set_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_price_rates_patient_key UNIQUE (patient_id)
);

COMMENT ON TABLE public.patient_price_rates IS
  'A patient''s price rate (private, staff or contract): a percentage of the usual price for the codes billed at the '
  'practice''s price list; a medical aid''s own prices are never changed. Written only by set_patient_price_rate().';

CREATE INDEX IF NOT EXISTS patient_price_rates_practice_idx ON public.patient_price_rates (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Who reads it: staff of the practice and OneHealth support; nobody writes it directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_price_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_price_rates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_price_rates TO authenticated;
GRANT ALL ON public.patient_price_rates TO service_role;

DROP POLICY IF EXISTS patient_price_rates_read ON public.patient_price_rates;
CREATE POLICY patient_price_rates_read ON public.patient_price_rates FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.patient_price_rates';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.patient_price_rates AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Setting or removing a patient's rate: practice administrators and practitioners
-- ---------------------------------------------------------------------------------------------

-- p_kind NULL removes the rate; p_percent NULL or 100 is the usual price (a staff rate may be just that: the staff
-- medicine price on the usual fees)
CREATE OR REPLACE FUNCTION public.set_patient_price_rate(p_practice_id uuid, p_patient_id uuid, p_kind text, p_percent numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := lower(btrim(p_kind));
  v_percent numeric := CASE WHEN p_percent = 100 THEN NULL ELSE p_percent END;
BEGIN
  PERFORM public.billing_assert_staff(p_practice_id, ARRAY['admin', 'doctor'],
                                      'Only a practice administrator or a practitioner can change a patient''s price rate.');
  IF p_patient_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'This patient is not a patient of the practice.' USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NULL THEN
    DELETE FROM public.patient_price_rates r WHERE r.patient_id = p_patient_id AND r.practice_id = p_practice_id;
    RETURN;
  END IF;
  IF v_kind NOT IN ('private', 'staff', 'contract') THEN
    RAISE EXCEPTION 'A price rate is a private, staff or contract rate.' USING ERRCODE = '22023';
  END IF;
  IF v_percent IS NOT NULL AND (v_percent < 10 OR v_percent > 500 OR v_percent <> round(v_percent, 2)) THEN
    RAISE EXCEPTION 'A rate is from 10%% to 500%% of the usual price, with at most 2 decimals.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.patient_price_rates AS r (practice_id, patient_id, kind, percent, set_by, set_at)
  VALUES (p_practice_id, p_patient_id, v_kind, v_percent, auth.uid(), now())
  ON CONFLICT ON CONSTRAINT patient_price_rates_patient_key DO UPDATE
    SET kind = EXCLUDED.kind, percent = EXCLUDED.percent, set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at
  WHERE r.practice_id = EXCLUDED.practice_id;
END $$;

REVOKE ALL ON FUNCTION public.set_patient_price_rate(uuid, uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_price_rate(uuid, uuid, text, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks: row level security, the guard, the function's rights, nothing for the public key
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.patient_price_rates'::regclass) THEN
    RAISE EXCEPTION 'check failed: row level security is off on patient_price_rates';
  END IF;
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patient_price_rates'
       AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'check failed: the patient app''s guard is missing on patient_price_rates';
  END IF;
  IF has_table_privilege('anon', 'public.patient_price_rates', 'SELECT')
     OR has_table_privilege('authenticated', 'public.patient_price_rates', 'INSERT')
     OR has_table_privilege('authenticated', 'public.patient_price_rates', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.patient_price_rates', 'DELETE') THEN
    RAISE EXCEPTION 'check failed: the public key reads the rates, or staff can write them directly';
  END IF;
  IF has_function_privilege('anon', 'public.set_patient_price_rate(uuid, uuid, text, numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can set a price rate';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_patient_price_rate(uuid, uuid, text, numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: signed-in staff cannot set a price rate';
  END IF;
  RAISE NOTICE 'patient price rates ready: row level security on, the guard, the function''s rights checked';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only): the policies and the rates (none yet)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'patient_price_rates' ORDER BY policyname;
SELECT count(*) AS patient_price_rates FROM public.patient_price_rates;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
