-- Applied 2026-10-09 as migration staff_records_admins_2026_10_09 (stored statement md5 7a793ce60ce6a95a082bd8cfd3a71300).
-- Rehearsed with simulated logins: doctor -> colleague 1 row before, 0 after; doctor -> own row 1; administrator ->
-- colleague 1 (sees all 7 practice staff); support 1; anon refused (42501).
-- =============================================================================================
-- PROPOSAL: only a practice's administrators (and OneHealth support) change colleagues' staff records
-- File:   proposals/2026-10-09-staff-records-admins.sql                 Drafted: 2026-10-09
--
-- Why (found by the diary work, 2026-10-09): the users policy users_practice_admin used rls_is_practice_admin(),
-- which counts role 'doctor' as an administrator. So any doctor could change a colleague's staff record through
-- the API, including role, permissions and active state: a doctor could make a receptionist an administrator or
-- switch a colleague off. The app already lets only administrators and support manage staff
-- (isStaffAdmin, src/components/settings/UserManagement/staffUtils.ts), so this aligns the database with the app
-- and takes away nothing a screen offers. Unchanged: everyone still updates their own row (users_self_update,
-- which keeps role and access fields fixed), support keeps users_super_admin, and the Gmail and social account
-- policies keep rls_is_practice_admin (administrators and doctors connect those, as the app allows).
-- Counts on 2026-10-09: 2 practices have active staff; 1 has an active administrator. The other practice's staff
-- are managed by OneHealth support until it names an administrator, as in the app today.
--
-- Undo: ALTER POLICY users_practice_admin ON public.users
--         USING ((SELECT rls_is_practice_admin()) AND practice_id = (SELECT rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false))
--         WITH CHECK ((SELECT rls_is_practice_admin()) AND practice_id = (SELECT rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false));
--       DROP FUNCTION public.rls_is_staff_admin();
-- =============================================================================================

BEGIN;

-- An active administrator of the caller's practice (role 'admin'); runs as owner so policies on users can call it
CREATE OR REPLACE FUNCTION public.rls_is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.rls_is_staff_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_is_staff_admin() TO authenticated;

ALTER POLICY users_practice_admin ON public.users
  USING ((SELECT public.rls_is_staff_admin()) AND practice_id = (SELECT public.rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false))
  WITH CHECK ((SELECT public.rls_is_staff_admin()) AND practice_id = (SELECT public.rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_practice_admin'
       AND (qual ILIKE '%rls_is_practice_admin%' OR with_check ILIKE '%rls_is_practice_admin%')
  ) THEN
    RAISE EXCEPTION 'Check failed: users_practice_admin still lets doctors manage staff';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
