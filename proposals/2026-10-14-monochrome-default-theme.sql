-- Applied 2026-10-14 as migration monochrome_default_theme_2026_10_14 (version 20261014172647, UTC; stored statement md5 b8e400e57b0eb9c63cc5e8b400eebdde = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left). Before: 874 practices (872 on sunset, 2 on monochrome,
-- none without a theme), column default 'sunset'. After: 874 on monochrome, default 'monochrome', updated_at moved on exactly the 872
-- changed rows, a hash of every other column of every practice the same, and a new practice with no theme chosen started on monochrome.
-- The proposal ran as the database owner with nobody signed in (practices_protected_columns let it through). A practice's staff member (not an
-- administrator), its administrator and OneHealth support each read the practice's theme and saved another on 1 row (the guard passed all
-- three); another practice's staff and a patient-app login read and changed 0 rows; the public key was refused (42501) on the save; and a
-- practice that chose Sunset itself afterwards kept it. After the applied migration: 874 on monochrome, the same 3 triggers and 5 policies.
-- =============================================================================================
-- PROPOSAL: Monochrome, the black theme, is the main colour: the default for new practices and the theme of every practice still on the old Sunset default
-- File:   proposals/2026-10-14-monochrome-default-theme.sql            Drafted: 2026-10-14 (agent theme)
-- Code:   src/stores/themeStore.ts (DEFAULT_THEME_ID: the theme a browser starts with and "reset" returns to);
--         src/stores/__tests__/themeStore.default.test.ts says why.
--
-- Why (owner decision, 14 Oct 2026): "I would like the black one, not the orange one." A practice's colours are its theme_id (Settings >
-- Appearance saves it; the app reads it when staff sign in and it wins over whatever the browser remembered). The column's default was
-- 'sunset' (the orange one), so every practice nobody chose for sat on it: 872 of the 874 practices (867 directory leads and 5 others, 2 of
-- them active). The other two, one active and one onboarding, are on 'monochrome' (the dark charcoal sidebar): the 12 staff accounts of
-- those two practices already see it. 1 staff account belongs to a practice on sunset and will see the black theme at its next sign-in.
--
-- What it does (two statements, then a check; no policy, privilege, trigger or other column changes)
--   1. practices.theme_id defaults to 'monochrome' (it was 'sunset'): a practice created from now on starts on the black theme.
--   2. Every practice on 'sunset', or with no theme saved (none today), moves to 'monochrome'. A practice on any other theme keeps it,
--      and a practice that picks Sunset in Settings afterwards keeps that: nothing in the database puts it back.
--   Run it once: the first run is the owner's bulk move, and a second run later would also move a practice that has since chosen
--   Sunset on purpose.
--
-- Checked on practices (a protected table: no policy is touched here)
--   practices_protected_columns (BEFORE UPDATE) compares only the plan, limit, approval, name, type, number and bank columns, and returns at
--     once when nobody is signed in (a migration): a theme_id change passes for the migration, OneHealth support, administrators and staff.
--   update_practices_updated_at (BEFORE UPDATE) sets updated_at: the 872 changed rows get the time of the change (no screen reads or
--     sorts practices by it).
--   add_patient_activity_settings_on_practice_create runs after INSERT only. No constraint names theme_id, no function or view
--     contains 'sunset' (practice_listing only passes theme_id through, and no website reads it).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one migration.
-- Undo: ALTER TABLE public.practices ALTER COLUMN theme_id SET DEFAULT 'sunset';
--       UPDATE public.practices SET theme_id = 'sunset' WHERE theme_id = 'monochrome'
--         AND id NOT IN ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'ffed1160-00ec-4c4f-8810-913a24348d90');
--       (those two practices were on 'monochrome' before this file; any practice that chose Monochrome since is moved too)
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. A new practice starts on Monochrome
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.practices ALTER COLUMN theme_id SET DEFAULT 'monochrome';

-- ---------------------------------------------------------------------------------------------
-- 2. Practices on the old orange default, or with no theme saved, move to Monochrome (any other theme stays)
-- ---------------------------------------------------------------------------------------------

UPDATE public.practices SET theme_id = 'monochrome' WHERE theme_id = 'sunset' OR theme_id IS NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. Check
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'practices' AND column_name = 'theme_id';
  IF v_default IS DISTINCT FROM '''monochrome''::character varying' THEN
    RAISE EXCEPTION 'Check failed: the default of practices.theme_id is %', v_default;
  END IF;
  IF EXISTS (SELECT 1 FROM public.practices WHERE theme_id IS NULL OR theme_id = 'sunset') THEN
    RAISE EXCEPTION 'Check failed: a practice is still on sunset or has no theme';
  END IF;
END $$;

ROLLBACK;
