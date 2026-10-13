-- Applied 2026-10-09 as migration screen_access_2026_10_08 (md5 of the part between BEGIN; and ROLLBACK; = md5 of the stored statement: d98f345ca0f5739845adcfed66233ed6)
-- =============================================================================================
-- PROPOSAL: Practice administrators choose which roles open Finance and Stock (screen access)
-- File:   proposals/2026-10-08-screen-access.sql                         Drafted: 2026-10-08
-- Code:   src/utils/auth/screenAccess.ts (GUARDED_SCREENS, CHOOSABLE_ROLES and the rule, unit tested),
--         src/services/screenAccessService.ts, src/hooks/useScreenAccess.ts,
--         src/components/settings/ScreenAccessSettings.tsx (Settings > Users > Screen access),
--         src/App.tsx (RequireRole screen=...), src/components/layout/Sidebar.tsx
--
-- Why: every role opens Finance and Stock (parity row Q1). The owner has not chosen role rights, so each practice's
-- administrators choose per screen which roles may open it; administrators and OneHealth support always can. The
-- choice is one practice_settings row per practice, key 'screen_access', a JSON object such as
--   {"finance": ["doctor"], "stock": ["doctor", "nurse"]}
-- A screen missing from the object is open to every role (today's behaviour), so nothing changes until an
-- administrator chooses. Staff read their practice's row through the existing practice_settings_select_policy.
--   * set_screen_access(practice, screen, roles) is the one way to write it: an active administrator of that
--     practice, or OneHealth support (rls_is_super_admin()); known screens and roles only (v_screens and v_roles
--     below, the app's GUARDED_SCREENS and CHOOSABLE_ROLES; a unit test compares them); roles NULL opens the screen
--     to every role again; every change goes to audit_logs (who, when, before and after).
--   * three restrictive policies stop direct inserts, updates and deletes of 'screen_access' rows: the existing
--     policies let any practice administrator (active or not) write any key directly. No other key, policy or table
--     changes.
-- Not enforced here: the app hides the screens and closes their routes, but the database still lets every staff
-- member of the practice read invoices, receipts, claims, remittances and stock, and record receipts.
-- Requires: 2026-10-07-practice-isolation.sql (rls_is_super_admin).
--
-- How to apply: rehearse (scripts/db/rehearsal.ts runs it in one rolled-back transaction), then apply the part
-- between BEGIN; and ROLLBACK; as a migration. Until then Settings > Users > Screen access says it is not set up and
-- every role opens Finance and Stock, as before.
-- Undo: DROP FUNCTION public.set_screen_access(uuid, text, text[]);
--       DROP POLICY practice_settings_screen_access_insert ON public.practice_settings;  (and _update, _delete)
--       DELETE FROM public.practice_settings WHERE setting_key = 'screen_access';  (every role opens every screen)
-- =============================================================================================

BEGIN;
-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'rls_is_super_admin() must exist first (2026-10-07-practice-isolation.sql)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.practice_settings'::regclass AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (practice_id, setting_key)'
  ) THEN
    RAISE EXCEPTION 'practice_settings needs its UNIQUE (practice_id, setting_key) constraint';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Choosing who opens a screen
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_screen_access(p_practice_id uuid, p_screen text, p_roles text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Screens a practice can limit (the app's GUARDED_SCREENS) and the roles it chooses between (the app's
  -- CHOOSABLE_ROLES; administrators always open every screen)
  v_screens constant text[] := ARRAY['finance', 'stock'];
  v_roles constant text[] := ARRAY['doctor', 'nurse', 'receptionist'];
  v_caller_role text;
  v_before public.practice_settings%ROWTYPE;
  v_after public.practice_settings%ROWTYPE;
  v_value jsonb;
BEGIN
  IF public.rls_is_super_admin() THEN
    v_caller_role := 'super_admin';
  ELSIF EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
  ) THEN
    v_caller_role := 'admin';
  ELSE
    RAISE EXCEPTION 'Only the practice''s administrators choose who can open Finance and Stock.' USING ERRCODE = '42501';
  END IF;
  IF p_screen IS NULL OR NOT (p_screen = ANY (v_screens)) THEN
    RAISE EXCEPTION 'There is no screen "%" to choose access for.', COALESCE(p_screen, '') USING ERRCODE = '22023';
  END IF;
  IF p_roles IS NOT NULL
     AND EXISTS (SELECT 1 FROM unnest(p_roles) AS r(role) WHERE r.role IS NULL OR NOT (r.role = ANY (v_roles))) THEN
    RAISE EXCEPTION 'Choose from doctor, nurse and receptionist (administrators can always open it).' USING ERRCODE = '22023';
  END IF;
  IF p_practice_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.id = p_practice_id) THEN
    RAISE EXCEPTION 'This practice does not exist.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_before FROM public.practice_settings s
   WHERE s.practice_id = p_practice_id AND s.setting_key = 'screen_access'
   FOR UPDATE;

  -- The other screen keeps its choice; a value that is not an object starts again from "every screen open"
  v_value := CASE WHEN jsonb_typeof(v_before.setting_value) = 'object' THEN v_before.setting_value ELSE '{}'::jsonb END;
  IF p_roles IS NULL THEN
    v_value := v_value - p_screen;
  ELSE
    v_value := jsonb_set(v_value, ARRAY[p_screen],
      (SELECT COALESCE(jsonb_agg(DISTINCT r.role ORDER BY r.role), '[]'::jsonb) FROM unnest(p_roles) AS r(role)));
  END IF;

  INSERT INTO public.practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
  VALUES (p_practice_id, 'screen_access', v_value, 'json',
          'Who can open Finance and Stock: the roles per screen (administrators always can; a screen not listed is open to every role)',
          false)
  ON CONFLICT (practice_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_type = 'json'
  RETURNING * INTO v_after;

  -- Who changed it and when (super admins read every entry, the practice's administrators their practice's)
  INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, user_role, description)
  VALUES (
    'practice_settings', v_after.id,
    CASE WHEN v_before.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    CASE WHEN v_before.id IS NULL THEN NULL
         ELSE jsonb_build_object('practice_id', p_practice_id, 'setting_key', 'screen_access',
                                 'setting_value', v_before.setting_value) END,
    jsonb_build_object('practice_id', p_practice_id, 'setting_key', 'screen_access', 'setting_value', v_after.setting_value),
    auth.uid(), v_caller_role,
    CASE WHEN p_roles IS NULL THEN format('%s opens for every role again', initcap(p_screen))
         ELSE format('Who can open %s changed', initcap(p_screen)) END
  );

  RETURN v_after.setting_value;
END;
$$;
COMMENT ON FUNCTION public.set_screen_access(uuid, text, text[]) IS
  'Active practice administrators (their own practice) and OneHealth support choose which roles open Finance or Stock (practice_settings screen_access; roles NULL = every role). Every change is in audit_logs.';

-- ---------------------------------------------------------------------------------------------
-- 2. Signed-in users only (the function itself refuses everyone but the practice's administrators and support)
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_screen_access(uuid, text, text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_screen_access(uuid, text, text[]) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Only through set_screen_access: no direct insert, update or delete of the screen_access row (restrictive, so
--    every other key keeps exactly the rights it has; the function runs as the table owner and is not affected)
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS practice_settings_screen_access_insert ON public.practice_settings;
CREATE POLICY practice_settings_screen_access_insert ON public.practice_settings
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (setting_key::text <> 'screen_access');

DROP POLICY IF EXISTS practice_settings_screen_access_update ON public.practice_settings;
CREATE POLICY practice_settings_screen_access_update ON public.practice_settings
  AS RESTRICTIVE FOR UPDATE
  USING (setting_key::text <> 'screen_access')
  WITH CHECK (setting_key::text <> 'screen_access');

DROP POLICY IF EXISTS practice_settings_screen_access_delete ON public.practice_settings;
CREATE POLICY practice_settings_screen_access_delete ON public.practice_settings
  AS RESTRICTIVE FOR DELETE
  USING (setting_key::text <> 'screen_access');

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.set_screen_access(uuid, text, text[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.set_screen_access(uuid, text, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: only signed-in users may call set_screen_access';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_screen_access(uuid, text, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: signed-in users cannot call set_screen_access';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = 'public.set_screen_access(uuid, text, text[])'::regprocedure
       AND prosecdef AND proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'Check failed: set_screen_access must run as its owner with an empty search_path';
  END IF;
  IF (SELECT count(*) FROM pg_policy
       WHERE polrelid = 'public.practice_settings'::regclass AND NOT polpermissive
         AND polname IN ('practice_settings_screen_access_insert', 'practice_settings_screen_access_update',
                         'practice_settings_screen_access_delete')) <> 3 THEN
    RAISE EXCEPTION 'Check failed: the three restrictive screen_access policies are missing';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
