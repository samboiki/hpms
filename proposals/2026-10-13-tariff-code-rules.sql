-- Applied 2026-10-13 as migration tariff_code_rules_2026_10_13 (version 20261012223227; stored statement md5 563f77092fe0b7ff7619ebd723ea5b86 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: save_practice_tariff_rules adc302bfa1dea6d52b9803a50055fceb, apply_practice_tariff_increase
-- 9c90c5a4592b119e8021ba837cbb80db; 2 policies (read, portal guard).
-- Rehearsed (rolled back) with simulated logins: the practice administrator saved ' zz01 ' tidied (code, reason, place,
-- linked codes upper case), saved it again (one row, changed), a reason without a recall was dropped, emptied rules
-- removed the row; a place 99, 0, 6.5 and 61 months, a 1-letter reason, a code bringing itself, a code linked twice,
-- quantity 0 or as text, 11 links, a flag as text and a malformed code were refused (22023); another practice's rules
-- and direct inserts were refused (42501). The yearly increase saved 2 versions from 1 Jan 2027 and kept the earlier
-- version (450.00) and "per unit"; a retry added no rows; a half-cent price named its code and saved nothing (22023);
-- the same code twice, no codes, no date and a price as text were refused (22023). A receptionist read the rules but
-- could not save or increase (42501); another practice's doctor read 0 and could do neither (42501); OneHealth support
-- saved; a patient-app login read 0 (42501 on saving); anon 42501 throughout. Repeated after applying.
-- =============================================================================================
-- PROPOSAL: what happens when a practice bills a code (flags, recall, place of service, linked codes), and a yearly
--           percentage increase of the practice's prices (parity E9, D13, O2, E3)
-- File:   proposals/2026-10-13-tariff-code-rules.sql                    Drafted: 2026-10-13
-- Code:   src/utils/billing/codeRules.ts (the rules, the line notices, the recall suggestions; tested),
--         src/utils/billing/tariffIncrease.ts (the increase and its preview; tested),
--         src/services/codeRulesService.ts (reads and saves), src/services/practiceTariffService.ts (the rules ride on
--         the tariff rows billing reads), src/components/tariffs/CodeRulesForm.tsx and TariffIncreaseForm.tsx
--         (Admin > Tariffs > Practice tariff), src/components/visits/useCodeRulesOnVisit.ts, linkedCodeLines.ts and
--         recallOffer.tsx (the visit's Billing tab)
--
-- Why: (E9) Eminance marks each tariff code: needs pre-authorisation, lab work, time-based, a recall type, an EDI stop
-- and a default place of service, and staff are prompted when they bill it. OneHealth's codes only knew "per unit",
-- "needs a tooth" and who pays. (D13) Only dental had linked codes (8346 after a restoration, 8109 per visit), built
-- into the app: a GP or a physiotherapist could not have a code bring its consumables. (O2) Eminance offers a recall
-- when a code with a recall type is invoiced. (E3) A practice changed its prices one code at a time; Eminance puts a
-- whole price list up by a percentage from a date.
--
-- What it does (additive: no existing table, policy or row is changed; practice_tariffs, practice_own_tariffs and
-- their policies are not touched)
--   1. practice_tariff_rules: per practice and code: needs the fund's authorisation number, includes lab work, charged
--      by time, a recall after 1 to 60 months (and what for), a default place of service (claim field 42: the codes
--      visit_claim_details accepts) and the codes it brings with it (at most 10, each with a quantity of 1 to 99).
--      "Do not claim" is NOT kept here: it is the practice's existing "Who pays: patient pays all" for the code
--      (practice_settings tariff_portions), which invoice_services.paid_by and sync_invoice_to_batch already honour.
--   2. RLS: staff of the practice (and OneHealth support) read it; nobody writes it directly; the patient app's guard.
--   3. save_practice_tariff_rules(practice, code, rules jsonb): practice administrators (and support); checks every
--      value as the table does; a code with no rules left loses its row.
--   4. apply_practice_tariff_increase(practice, from, items jsonb): the yearly increase in one step. Every new price is
--      saved through save_practice_tariff (proposals/2026-10-09-practice-own-tariffs.sql), so each code gets a version
--      that starts on that date and keeps its earlier versions (the history: older visits keep their prices). Either
--      every code changes or none does. Practice administrators (and support).
--   5. Checks: row level security, the guard, the functions' rights, nothing for the public key.
--   Needs practice isolation's rls_my_practice_id() and rls_is_super_admin(), and save_practice_tariff().
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the Practice tariff tab says the rules and the yearly increase are not set up yet, and visits
-- bill exactly as before.
-- Undo: DROP FUNCTION IF EXISTS public.apply_practice_tariff_increase(uuid, date, jsonb);
--       DROP FUNCTION IF EXISTS public.save_practice_tariff_rules(uuid, text, jsonb);
--       DROP TABLE IF EXISTS public.practice_tariff_rules;
--       (prices an increase saved stay as the practice's own versions; remove them per code with "Shared price")
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the functions this file builds on are missing
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(signature, ', ') INTO v_missing
    FROM (VALUES ('public.rls_my_practice_id()'), ('public.rls_is_super_admin()'),
                 ('public.save_practice_tariff(uuid,text,text,numeric,boolean,boolean,date)')) AS t(signature)
   WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. practice_tariff_rules
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practice_tariff_rules (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- As billed and claimed (upper case): 0190, 8101
  code text NOT NULL CHECK (code ~ '^[0-9A-Z]{1,10}$'),
  -- A medical aid line of the code without the fund's authorisation number is flagged on the visit
  needs_authorisation boolean NOT NULL DEFAULT false,
  -- The line asks for the lab and its slip number (printed on the invoice)
  lab_work boolean NOT NULL DEFAULT false,
  -- The line asks how long the service took (printed on the invoice)
  time_based boolean NOT NULL DEFAULT false,
  -- When the code is invoiced, staff are offered a recall this many months after the service
  recall_months integer CHECK (recall_months IS NULL OR recall_months BETWEEN 1 AND 60),
  -- What the recall is for (NULL: the code's description)
  recall_reason text CHECK (recall_reason IS NULL OR (char_length(recall_reason) BETWEEN 2 AND 120 AND recall_reason = btrim(recall_reason))),
  -- The visit's place of service (claim field 42) when it has none; the same codes visit_claim_details accepts
  place_of_service text CHECK (place_of_service IS NULL OR place_of_service ~ '^(1[0-4]|2[0-4]|3[0-2]|4[0-6]|5[0-2]|6[0-6]|7[0-2]|8[0-3])$'),
  -- The codes it brings with it: [{"code": "0201", "quantity": 1}, ...]
  linked_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(linked_codes) = 'array' AND jsonb_array_length(linked_codes) <= 10),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (practice_id, code)
);

COMMENT ON TABLE public.practice_tariff_rules IS
  'What happens when a practice bills a code: authorisation, lab work, time, a recall, a default place of service and '
  'the codes it brings with it. "Do not claim" is the practice''s tariff_portions setting (patient pays all), not here. '
  'Changed only through save_practice_tariff_rules (practice administrators).';

-- ---------------------------------------------------------------------------------------------
-- 2. Who reads it: staff of the practice and OneHealth support; nobody writes it directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.practice_tariff_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_tariff_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_tariff_rules TO authenticated;
GRANT ALL ON public.practice_tariff_rules TO service_role;

DROP POLICY IF EXISTS practice_tariff_rules_read ON public.practice_tariff_rules;
CREATE POLICY practice_tariff_rules_read ON public.practice_tariff_rules FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.practice_tariff_rules';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.practice_tariff_rules AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Saving one code's rules: practice administrators of that practice, or support
-- ---------------------------------------------------------------------------------------------

-- p_rules: {"needs_authorisation": bool, "lab_work": bool, "time_based": bool, "recall_months": 1-60 or null,
--           "recall_reason": text or null, "place_of_service": "11" or null, "linked_codes": [{"code", "quantity"}]}
-- A missing key is "no"; a code with no rules left loses its row
CREATE OR REPLACE FUNCTION public.save_practice_tariff_rules(p_practice_id uuid, p_code text, p_rules jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(btrim(COALESCE(p_code, '')));
  v_rules jsonb := COALESCE(p_rules, '{}'::jsonb);
  v_months integer;
  v_reason text;
  v_place text;
  v_links jsonb := '[]'::jsonb;
  v_item jsonb;
  v_link text;
  v_quantity numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice administrator can change what happens when a code is billed.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR v_code !~ '^[0-9A-Z]{1,10}$' THEN
    RAISE EXCEPTION 'Enter the code: 1 to 10 letters or digits (for example 0190).' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_rules) <> 'object' THEN
    RAISE EXCEPTION 'The rules could not be read.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['needs_authorisation', 'lab_work', 'time_based']) AS k(name)
              WHERE jsonb_typeof(v_rules -> k.name) NOT IN ('boolean', 'null')) THEN
    RAISE EXCEPTION 'Authorisation, lab work and time are each yes or no.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(v_rules -> 'recall_months'), 'null') <> 'null' THEN
    IF jsonb_typeof(v_rules -> 'recall_months') <> 'number'
       OR (v_rules ->> 'recall_months')::numeric NOT BETWEEN 1 AND 60
       OR (v_rules ->> 'recall_months')::numeric <> trunc((v_rules ->> 'recall_months')::numeric) THEN
      RAISE EXCEPTION 'A recall is a whole number of months, 1 to 60, after the visit.' USING ERRCODE = '22023';
    END IF;
    v_months := (v_rules ->> 'recall_months')::integer;
    v_reason := NULLIF(btrim(regexp_replace(COALESCE(v_rules ->> 'recall_reason', ''), '\s+', ' ', 'g')), '');
    IF v_reason IS NOT NULL AND char_length(v_reason) NOT BETWEEN 2 AND 120 THEN
      RAISE EXCEPTION 'Say what the recall is for in 2 to 120 characters, or leave it empty.' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_place := NULLIF(regexp_replace(COALESCE(v_rules ->> 'place_of_service', ''), '\s', '', 'g'), '');
  IF v_place IS NOT NULL AND v_place !~ '^(1[0-4]|2[0-4]|3[0-2]|4[0-6]|5[0-2]|6[0-6]|7[0-2]|8[0-3])$' THEN
    RAISE EXCEPTION 'A place of service is a two-digit code from the fund list.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(v_rules -> 'linked_codes'), 'null') <> 'null' THEN
    IF jsonb_typeof(v_rules -> 'linked_codes') <> 'array' OR jsonb_array_length(v_rules -> 'linked_codes') > 10 THEN
      RAISE EXCEPTION 'A code brings at most 10 other codes.' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_rules -> 'linked_codes') LOOP
      v_link := CASE WHEN jsonb_typeof(v_item) = 'object' THEN upper(btrim(COALESCE(v_item ->> 'code', ''))) ELSE '' END;
      IF v_link !~ '^[0-9A-Z]{1,10}$' THEN
        RAISE EXCEPTION 'Each linked code is 1 to 10 letters or digits.' USING ERRCODE = '22023';
      END IF;
      IF v_link = v_code THEN
        RAISE EXCEPTION 'A code cannot bring itself.' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_item -> 'quantity') <> 'number' THEN
        RAISE EXCEPTION 'The quantity of % is a whole number from 1 to 99.', v_link USING ERRCODE = '22023';
      END IF;
      v_quantity := (v_item ->> 'quantity')::numeric;
      IF v_quantity NOT BETWEEN 1 AND 99 OR v_quantity <> trunc(v_quantity) THEN
        RAISE EXCEPTION 'The quantity of % is a whole number from 1 to 99.', v_link USING ERRCODE = '22023';
      END IF;
      IF v_links @> jsonb_build_array(jsonb_build_object('code', v_link)) THEN
        RAISE EXCEPTION 'Code % is linked twice.', v_link USING ERRCODE = '22023';
      END IF;
      v_links := v_links || jsonb_build_array(jsonb_build_object('code', v_link, 'quantity', v_quantity::integer));
    END LOOP;
  END IF;

  IF NOT (COALESCE((v_rules ->> 'needs_authorisation')::boolean, false) OR COALESCE((v_rules ->> 'lab_work')::boolean, false)
          OR COALESCE((v_rules ->> 'time_based')::boolean, false) OR v_months IS NOT NULL OR v_place IS NOT NULL
          OR jsonb_array_length(v_links) > 0) THEN
    DELETE FROM public.practice_tariff_rules WHERE practice_id = p_practice_id AND code = v_code;
    RETURN;
  END IF;

  INSERT INTO public.practice_tariff_rules AS r (
    practice_id, code, needs_authorisation, lab_work, time_based, recall_months, recall_reason, place_of_service,
    linked_codes, updated_by, updated_at
  )
  VALUES (
    p_practice_id, v_code,
    COALESCE((v_rules ->> 'needs_authorisation')::boolean, false),
    COALESCE((v_rules ->> 'lab_work')::boolean, false),
    COALESCE((v_rules ->> 'time_based')::boolean, false),
    v_months, v_reason, v_place, v_links, auth.uid(), now()
  )
  ON CONFLICT (practice_id, code) DO UPDATE
     SET needs_authorisation = EXCLUDED.needs_authorisation,
         lab_work = EXCLUDED.lab_work,
         time_based = EXCLUDED.time_based,
         recall_months = EXCLUDED.recall_months,
         recall_reason = EXCLUDED.recall_reason,
         place_of_service = EXCLUDED.place_of_service,
         linked_codes = EXCLUDED.linked_codes,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The yearly increase: many codes' new prices from one date, all or nothing
-- ---------------------------------------------------------------------------------------------

-- p_items: [{"code": "0190", "description": "...", "price": 477.00, "per_unit": false, "needs_tooth": false}, ...]
-- The app works out the new prices (src/utils/billing/tariffIncrease.ts, from the prices billing uses the day before);
-- each one is saved by save_practice_tariff, which checks the caller and every value. Returns how many codes changed.
CREATE OR REPLACE FUNCTION public.apply_practice_tariff_increase(p_practice_id uuid, p_from date, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_code text;
  v_codes text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice administrator can change the practice''s prices.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL THEN
    RAISE EXCEPTION 'Choose the date the new prices start.' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Choose 1 to 3,000 codes to change.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_code := CASE WHEN jsonb_typeof(v_item) = 'object' THEN upper(btrim(COALESCE(v_item ->> 'code', ''))) ELSE '' END;
    IF v_code = ANY (v_codes) THEN
      RAISE EXCEPTION 'Code % is listed twice.', v_code USING ERRCODE = '22023';
    END IF;
    v_codes := v_codes || v_code;
    IF jsonb_typeof(v_item -> 'price') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item -> 'per_unit') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(v_item -> 'needs_tooth') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Code %: the new price could not be read.', v_code USING ERRCODE = '22023';
    END IF;
    BEGIN
      PERFORM public.save_practice_tariff(p_practice_id, v_code, v_item ->> 'description', (v_item ->> 'price')::numeric,
                                          (v_item ->> 'per_unit')::boolean, (v_item ->> 'needs_tooth')::boolean, p_from);
    EXCEPTION WHEN OTHERS THEN
      -- Name the code; the whole increase is undone
      RAISE EXCEPTION 'Code %: %', v_code, SQLERRM USING ERRCODE = SQLSTATE;
    END;
  END LOOP;
  RETURN array_length(v_codes, 1);
END
$$;

REVOKE ALL ON FUNCTION public.save_practice_tariff_rules(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_practice_tariff_increase(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_practice_tariff_rules(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_practice_tariff_increase(uuid, date, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks: row level security, the guard, the functions' rights, nothing for the public key
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.practice_tariff_rules'::regclass) THEN
    RAISE EXCEPTION 'check failed: row level security is off on practice_tariff_rules';
  END IF;
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'practice_tariff_rules'
       AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'check failed: the patient app''s guard is missing on practice_tariff_rules';
  END IF;
  IF has_table_privilege('anon', 'public.practice_tariff_rules', 'SELECT')
     OR has_table_privilege('authenticated', 'public.practice_tariff_rules', 'INSERT')
     OR has_table_privilege('authenticated', 'public.practice_tariff_rules', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.practice_tariff_rules', 'DELETE') THEN
    RAISE EXCEPTION 'check failed: the public key reads the rules, or staff can write them directly';
  END IF;
  IF has_function_privilege('anon', 'public.save_practice_tariff_rules(uuid, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_practice_tariff_increase(uuid, date, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can run a rules or increase function';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.save_practice_tariff_rules(uuid, text, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.apply_practice_tariff_increase(uuid, date, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: signed-in staff cannot run the rules or increase function';
  END IF;
  RAISE NOTICE 'tariff code rules ready: row level security on, the guard, the functions'' rights checked';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Result (read only): the policies and the rules (none yet)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'practice_tariff_rules' ORDER BY policyname;
SELECT count(*) AS code_rules FROM public.practice_tariff_rules;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
