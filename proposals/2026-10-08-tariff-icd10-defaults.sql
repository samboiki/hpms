-- Applied 2026-10-09 as migration tariff_icd10_defaults_2026_10_08 (version 20261009005703; stored statement md5 086b470fd9112bb78e53b6c7919ca2ae = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Rehearsed with simulated logins: the practice administrator set ' 0190 '/'j06.9' (saved as 0190=J06.9), changed and
-- cleared codes, stamped as the changer; a malformed or external-cause code was refused (22023), another practice's
-- codes (42501) and direct table writes (42501); a receptionist read the practice's 2 codes but could not change them
-- (42501); staff of another practice saw 0; the public key can neither read nor run anything. Repeated after applying.
-- =============================================================================================
-- PROPOSAL: a practice's usual ICD-10 code per tariff code, for every discipline
-- File:   proposals/2026-10-08-tariff-icd10-defaults.sql                Drafted: 2026-10-09
-- Code:   src/utils/billing/icd10Defaults.ts (one rule for the visit Billing tab and claim review; tested),
--         src/services/icd10DefaultsService.ts (reads and saves),
--         src/components/tariffs/PracticeTariffPanel.tsx (Admin > Tariffs > Practice tariff: "Usual ICD-10")
--
-- Why (parity E8): only dental codes had a usual diagnosis, built into the app (tariffRules.ts USUAL_ICD10_BY_CODE,
-- dentalIcd10Map.ts) and not changeable; GPs and specialists had none. practice_tariffs is shared by every practice
-- of a type (practice_type_id, no practice_id), so a practice's own choice needs its own small table. The dental
-- built-ins stay as the fallback when a practice has not chosen a code.
--
-- What it does (additive)
--   1. tariff_icd10_defaults: one usual ICD-10 code per tariff code per practice; it becomes the main code of new
--      billing lines, so an external cause code (V-Y) is refused.
--   2. RLS: staff of the practice (and OneHealth support) read it; nobody writes the table directly.
--   3. set_tariff_icd10_default(practice, tariff code, ICD-10 code or NULL to clear): practice administrators (and
--      support) only; SECURITY DEFINER, checks the caller's role and practice; EXECUTE for signed-in users only.
--   4. The patient app's staff-only guard, as on every OneHealth table (when the portal is set up).
--   Needs the practice-isolation helpers rls_my_practice_id() and rls_is_super_admin()
--   (proposals/2026-10-07-practice-isolation.sql).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Section 5 shows the result.
-- Undo: DROP FUNCTION IF EXISTS public.set_tariff_icd10_default(uuid, text, text);
--       DROP TABLE IF EXISTS public.tariff_icd10_defaults;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tariff_icd10_defaults (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- As billed on the line (practice_tariffs.code, upper case): 0190, 8101
  tariff_code text NOT NULL CHECK (tariff_code ~ '^[0-9A-Z]{1,10}$'),
  icd10_code text NOT NULL CHECK (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' AND icd10_code !~ '^[VWXY]'),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (practice_id, tariff_code)
);

COMMENT ON TABLE public.tariff_icd10_defaults IS
  'A practice''s usual ICD-10 code per tariff code: new billing lines start with it and claim review suggests it. Changed only through set_tariff_icd10_default (practice administrators).';

-- ---------------------------------------------------------------------------------------------
-- 2. Who reads it: staff of the practice and OneHealth support; nobody writes it directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.tariff_icd10_defaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tariff_icd10_defaults FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tariff_icd10_defaults TO authenticated;

DROP POLICY IF EXISTS tariff_icd10_defaults_read ON public.tariff_icd10_defaults;
CREATE POLICY tariff_icd10_defaults_read ON public.tariff_icd10_defaults FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 3. Setting or clearing one code: practice administrators of that practice, or support
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_tariff_icd10_default(p_practice_id uuid, p_tariff_code text, p_icd10_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(btrim(COALESCE(p_tariff_code, '')));
  v_icd10 text := upper(regexp_replace(COALESCE(p_icd10_code, ''), '\s+', '', 'g'));
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice administrator can change the usual ICD-10 codes.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR v_code !~ '^[0-9A-Z]{1,10}$' THEN
    RAISE EXCEPTION 'Choose a tariff code (for example 0190).' USING ERRCODE = '22023';
  END IF;

  -- No code: the tariff code goes back to the built-in suggestion (dental) or none
  IF v_icd10 = '' THEN
    DELETE FROM public.tariff_icd10_defaults WHERE practice_id = p_practice_id AND tariff_code = v_code;
    RETURN;
  END IF;
  IF v_icd10 !~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' THEN
    RAISE EXCEPTION '"%" is not an ICD-10 code (example: J06.9).', v_icd10 USING ERRCODE = '22023';
  END IF;
  IF v_icd10 ~ '^[VWXY]' THEN
    RAISE EXCEPTION '% says how an injury happened, so it cannot be the main code of a line.', v_icd10 USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tariff_icd10_defaults (practice_id, tariff_code, icd10_code, updated_by, updated_at)
  VALUES (p_practice_id, v_code, v_icd10, auth.uid(), now())
  ON CONFLICT (practice_id, tariff_code)
  DO UPDATE SET icd10_code = EXCLUDED.icd10_code, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
END
$$;

REVOKE ALL ON FUNCTION public.set_tariff_icd10_default(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tariff_icd10_default(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.tariff_icd10_defaults';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.tariff_icd10_defaults AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tariff_icd10_defaults' ORDER BY policyname;

SELECT has_table_privilege('anon', 'public.tariff_icd10_defaults', 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', 'public.tariff_icd10_defaults', 'INSERT') AS staff_insert_directly,
       has_function_privilege('anon', 'public.set_tariff_icd10_default(uuid, text, text)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.set_tariff_icd10_default(uuid, text, text)', 'EXECUTE') AS staff_run;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
