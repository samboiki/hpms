-- Applied 2026-10-09 as migration inert_anon_policies_2026_10_09 (stored statement md5 e6b1335e0b5d002476861b815fce6166)
-- Rehearsed: staff of a practice saw the same branches (1) and settings (4) before and after.
-- =============================================================================================
-- PROPOSAL: remove two "anon full access" policies that only wait for a grant to come back
-- File:   proposals/2026-10-09-inert-anon-policies.sql                  Drafted: 2026-10-09
--
-- Why: branches and practice_settings each still carry a 2025 policy "Allow anon full access to ..."
-- (FOR ALL, TO anon, USING true, WITH CHECK true). Today they do nothing: the public key lost its table
-- privileges on both on 2026-10-07 (2026-10-07-close-anonymous-access.sql). But a future GRANT, a restore or
-- a copied setup would bring back full read and write for anyone with the public key, across every practice.
-- Staff access is untouched: their own policies on both tables stay as they are.
--
-- Undo (not recommended):
--   CREATE POLICY "Allow anon full access to branches" ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow anon full access to practice_settings" ON public.practice_settings FOR ALL TO anon USING (true) WITH CHECK (true);
-- =============================================================================================

BEGIN;

DROP POLICY IF EXISTS "Allow anon full access to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow anon full access to practice_settings" ON public.practice_settings;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('branches', 'practice_settings') AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Check failed: a policy for the public key is still on branches or practice_settings';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
