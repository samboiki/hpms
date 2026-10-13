-- Applied 2026-10-09 as migration practice_own_tariffs_2026_10_09 (version 20261009103702; stored statement md5 604818a14afcc193027cbbeeed35beab = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Rehearsed with simulated logins: the practice administrator added ' zz01 ' (saved as ZZ01, stamped as the changer),
-- changed it on the same date (same version) and added a later version (2); a malformed code or a price in fractions
-- of a cent was refused (22023), another practice's list (42501) and direct table writes (42501); a receptionist read
-- the practice's 2 rows but could not change or remove them (42501); staff of another practice saw 0 rows and could
-- not change their own list (42501); removing switched both versions off; the public key can neither read nor run
-- anything (42501). Repeated after applying.
-- =============================================================================================
-- PROPOSAL: a practice's own tariff codes and prices, for every discipline (parity E13)
-- File:   proposals/2026-10-09-practice-own-tariffs.sql                Drafted: 2026-10-09
-- Code:   src/utils/billing/practiceTariffs.ts (the practice's own list wins over the shared one; tested),
--         src/services/practiceTariffService.ts (reads, saves, merges into the tariff list billing uses),
--         src/components/tariffs/PracticeTariffPanel.tsx and OwnTariffForm.tsx (Admin > Tariffs > Practice tariff)
--
-- Why (parity E13): practice_tariffs is shared by every practice of a type (practice_type_id, no practice_id) and
-- only OneHealth support may insert into it, so a practice administrator could neither add a single code nor change
-- a price; changing it would also change every other practice of the type. GP and specialist practices have no
-- shared list at all, so they had no codes to bill or bundle.
--
-- What it does (additive; practice_tariffs and its policies are not touched)
--   1. practice_own_tariffs: one version of a code per practice and start date: description, price, "once per line"
--      or "per unit", needs a tooth. The app bills the practice's own version instead of the shared one from its
--      first start date (a visit dated earlier keeps the shared price of its date).
--   2. RLS: staff of the practice (and OneHealth support) read it; nobody writes the table directly.
--   3. save_practice_tariff(practice, code, description, price, per unit, needs tooth, from): adds the version that
--      starts on that date, or changes it; remove_practice_tariff(practice, code): switches all versions of the code
--      off, so the shared price (if any) applies again. Practice administrators (and support) only; SECURITY DEFINER,
--      checks the caller's role and practice; EXECUTE for signed-in users only.
--   4. The patient app's staff-only guard, as on every OneHealth table (when the portal is set up).
--   Needs the practice-isolation helpers rls_my_practice_id() and rls_is_super_admin()
--   (proposals/2026-10-07-practice-isolation.sql).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the Tariffs page says the practice's own codes are not set up yet and billing uses the
-- shared list only, as before.
-- Undo: DROP FUNCTION IF EXISTS public.remove_practice_tariff(uuid, text);
--       DROP FUNCTION IF EXISTS public.save_practice_tariff(uuid, text, text, numeric, boolean, boolean, date);
--       DROP TABLE IF EXISTS public.practice_own_tariffs;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practice_own_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- As billed and claimed (upper case): 0190, GP01
  code text NOT NULL CHECK (code ~ '^[0-9A-Z]{1,10}$'),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  price numeric(12, 2) NOT NULL CHECK (price >= 0 AND price <= 1000000),
  -- NO: once per line; YES: per unit (as practice_tariffs)
  can_be_multiplied text NOT NULL DEFAULT 'NO' CHECK (can_be_multiplied IN ('NO', 'YES')),
  requires_tooth_number text NOT NULL DEFAULT 'NO' CHECK (requires_tooth_number IN ('NO', 'YES')),
  -- The price applies to services on and after this date, until a later version of the code
  effective_from date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_own_tariffs_version_key UNIQUE (practice_id, code, effective_from)
);

COMMENT ON TABLE public.practice_own_tariffs IS
  'A practice''s own tariff codes and prices; billing uses them instead of the shared practice_tariffs version of the same code from their first date. Changed only through save_practice_tariff / remove_practice_tariff (practice administrators).';

-- ---------------------------------------------------------------------------------------------
-- 2. Who reads it: staff of the practice and OneHealth support; nobody writes it directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.practice_own_tariffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_own_tariffs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_own_tariffs TO authenticated;

DROP POLICY IF EXISTS practice_own_tariffs_read ON public.practice_own_tariffs;
CREATE POLICY practice_own_tariffs_read ON public.practice_own_tariffs FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 3. Adding, changing and removing a code: practice administrators of that practice, or support
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_practice_tariff(
  p_practice_id uuid,
  p_code text,
  p_description text,
  p_price numeric,
  p_per_unit boolean,
  p_needs_tooth boolean,
  p_from date
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(btrim(COALESCE(p_code, '')));
  v_description text := btrim(COALESCE(p_description, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice administrator can change the practice''s tariff list.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR v_code !~ '^[0-9A-Z]{1,10}$' THEN
    RAISE EXCEPTION 'Enter the code: 1 to 10 letters or digits (for example 0190).' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_description) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Describe the service in 1 to 200 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 1000000 OR p_price <> round(p_price, 2) THEN
    RAISE EXCEPTION 'The price must be from N$ 0 to N$ 1,000,000, in whole cents.' USING ERRCODE = '22023';
  END IF;
  IF p_from IS NULL THEN
    RAISE EXCEPTION 'Choose the date the price starts.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.practice_own_tariffs AS t (
    practice_id, code, description, price, can_be_multiplied, requires_tooth_number, effective_from, is_active, created_by, updated_by
  )
  VALUES (
    p_practice_id, v_code, v_description, p_price,
    CASE WHEN COALESCE(p_per_unit, false) THEN 'YES' ELSE 'NO' END,
    CASE WHEN COALESCE(p_needs_tooth, false) THEN 'YES' ELSE 'NO' END,
    p_from, true, auth.uid(), auth.uid()
  )
  ON CONFLICT (practice_id, code, effective_from) DO UPDATE
     SET description = EXCLUDED.description,
         price = EXCLUDED.price,
         can_be_multiplied = EXCLUDED.can_be_multiplied,
         requires_tooth_number = EXCLUDED.requires_tooth_number,
         is_active = true,
         updated_by = auth.uid(),
         updated_at = now()
  RETURNING t.id INTO v_id;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.remove_practice_tariff(p_practice_id uuid, p_code text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(btrim(COALESCE(p_code, '')));
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice administrator can change the practice''s tariff list.' USING ERRCODE = '42501';
  END IF;
  -- Switched off, not deleted: who changed what stays on record; invoices keep the prices they were billed at
  UPDATE public.practice_own_tariffs
     SET is_active = false, updated_by = auth.uid(), updated_at = now()
   WHERE practice_id = p_practice_id AND code = v_code AND is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

REVOKE ALL ON FUNCTION public.save_practice_tariff(uuid, text, text, numeric, boolean, boolean, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_practice_tariff(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_practice_tariff(uuid, text, text, numeric, boolean, boolean, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_practice_tariff(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.practice_own_tariffs';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.practice_own_tariffs AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'practice_own_tariffs' ORDER BY policyname;

SELECT has_table_privilege('anon', 'public.practice_own_tariffs', 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', 'public.practice_own_tariffs', 'INSERT') AS staff_insert_directly,
       has_function_privilege('anon', 'public.save_practice_tariff(uuid, text, text, numeric, boolean, boolean, date)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.save_practice_tariff(uuid, text, text, numeric, boolean, boolean, date)', 'EXECUTE') AS staff_run;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
