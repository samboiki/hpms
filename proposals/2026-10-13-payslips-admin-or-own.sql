-- Applied 2026-10-13 as migration payslips_admin_or_own_2026_10_13 (version 20261013193652; stored statement md5 2c3f7a8d1d7e11119d9856bbfa5ee1a8 = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: payslips are read by the practice's administrators (all) and by each person (their own only)
-- File:   proposals/2026-10-13-payslips-admin-or-own.sql                  Drafted: 2026-10-13
-- Code:   src/components/finance/financeData.ts + useFinancePage.ts (Finance loads payroll for administrators
--         only and says so to everyone else), src/components/settings/EnhancedUserManagement.tsx and
--         UserManagement/PayrollManagement.tsx (non-administrators already open only their own payslips)
--
-- Why (owner decision, 13 Oct 2026): "Payslips: admins see all, everyone else only their own (doctors lose
-- colleague access)". Today payslips_practice_read and payslip_items_practice_read let every doctor of the
-- practice read every colleague's payslip and its lines through the API (practice-isolation-2, section 4, made
-- that so Finance could show payroll costs to doctors). salary_components (the practice's list of earnings and
-- deductions) is read by administrators and doctors through "Admin and managers can view salary components".
--
-- What it does (only the SELECT rules named below change; writes and every other policy stay as they are)
--   1. payslips_practice_read: administrators of the employee's practice (was administrators and doctors).
--      payslips_own_read (the person's own payslips) and payslips_practice_admin (administrators manage) stay.
--   2. payslip_items_practice_read: the same rule through the payslip's employee. payslip_items_own_read and
--      payslip_items_practice_admin stay.
--   3. salary_components: "Admin and managers can view salary components" (administrators and doctors) is
--      replaced by salary_components_admin_read (the practice's active administrators) and
--      salary_components_own_read (a component on the person's own salary, through employee_salary_components:
--      the person's own salary details screen shows these). "Only admins can manage salary components" stays.
--   4. Checks: no other SELECT or ALL policy on the three tables still lets a non-administrator read rows, so the
--      change is not undone by a permissive policy this file does not know about.
--
-- How to apply: rehearse in a transaction that rolls back with simulated logins (an administrator: every
-- payslip of the practice; a doctor: own payslips only, colleagues' 0; a receptionist: own only; another
-- practice's administrator: 0; anon: refused). Then apply the part between BEGIN; and ROLLBACK; as one migration.
-- The app works before and after: Finance already shows payroll figures to administrators only.
-- Undo:
--   ALTER POLICY payslips_practice_read ON public.payslips
--     USING (public.rls_my_role_for_staff(user_id) IN ('admin', 'doctor'));
--   ALTER POLICY payslip_items_practice_read ON public.payslip_items
--     USING (public.rls_my_role_for_staff((SELECT s.user_id FROM public.payslips s WHERE s.id = payslip_items.payslip_id)) IN ('admin', 'doctor'));
--   DROP POLICY IF EXISTS salary_components_admin_read ON public.salary_components;
--   DROP POLICY IF EXISTS salary_components_own_read ON public.salary_components;
--   CREATE POLICY "Admin and managers can view salary components" ON public.salary_components FOR SELECT
--     USING (auth.uid() IN (SELECT id FROM public.users WHERE practice_id = salary_components.practice_id AND role IN ('admin', 'doctor')));
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the helper and the policies this file changes exist
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_my_role_for_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'rls_my_role_for_staff(uuid) is missing: apply proposals/2026-10-08-practice-isolation-2.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payslips' AND policyname = 'payslips_practice_read') THEN
    RAISE EXCEPTION 'payslips_practice_read is missing: the payslip policies are not the ones this file expects';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payslip_items' AND policyname = 'payslip_items_practice_read') THEN
    RAISE EXCEPTION 'payslip_items_practice_read is missing: the payslip line policies are not the ones this file expects';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. payslips: administrators of the employee's practice read them all (doctors no longer do)
-- ---------------------------------------------------------------------------------------------
ALTER POLICY payslips_practice_read ON public.payslips
  USING (public.rls_my_role_for_staff(user_id) = 'admin');

-- ---------------------------------------------------------------------------------------------
-- 2. payslip_items: the same rule through the payslip's employee
-- ---------------------------------------------------------------------------------------------
ALTER POLICY payslip_items_practice_read ON public.payslip_items
  USING (public.rls_my_role_for_staff((SELECT s.user_id FROM public.payslips s WHERE s.id = payslip_items.payslip_id)) = 'admin');

-- ---------------------------------------------------------------------------------------------
-- 3. salary_components: administrators read the practice's list; everyone else the components on their own salary
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and managers can view salary components" ON public.salary_components;

DROP POLICY IF EXISTS salary_components_admin_read ON public.salary_components;
CREATE POLICY salary_components_admin_read ON public.salary_components FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.role = 'admin'
                    AND u.practice_id = salary_components.practice_id));

DROP POLICY IF EXISTS salary_components_own_read ON public.salary_components;
CREATE POLICY salary_components_own_read ON public.salary_components FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_salary_components esc
                  WHERE esc.component_id = salary_components.id AND esc.user_id = (SELECT auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after: every SELECT/ALL policy left on the three tables is one this file expects
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  unexpected text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname) INTO unexpected
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('payslips', 'payslip_items', 'salary_components')
     AND cmd IN ('SELECT', 'ALL')
     AND permissive = 'PERMISSIVE'
     AND policyname NOT IN (
       'payslips_own_read', 'payslips_practice_read', 'payslips_practice_admin',
       'payslip_items_own_read', 'payslip_items_practice_read', 'payslip_items_practice_admin',
       'salary_components_admin_read', 'salary_components_own_read', 'Only admins can manage salary components');
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Other read policies still open these tables: % (review them before applying)', unexpected;
  END IF;
END $$;

ROLLBACK;
