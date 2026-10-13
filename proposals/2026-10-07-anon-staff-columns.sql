-- Applied 2026-10-07 as migration anon_staff_columns_2026_10_07
-- =============================================================================================
-- PROPOSAL: the public key reads only the staff columns practice websites show
-- File:   proposals/2026-10-07-anon-staff-columns.sql                   Drafted: 2026-10-07
--
-- Why: the anon key could read every column of active staff rows in public.users (policy
-- allow_anon_read_practice_users), including staff bank details (account_number, bank_name,
-- branch_code, account_type). 15 staff rows hold bank details.
--
-- Who reads users without signing in (Supabase API logs, 4 and 7 October 2026): only practice
-- websites (e.g. a client practice's own site) listing their team, always with
--   select=id,full_name,email,role,job_title,staff_title,hpcsa_number,avatar
--   filters practice_id, is_active; order created_at
-- So anon keeps SELECT on exactly those columns plus the ones it filters and sorts on, and loses
-- the rest. The row policy (active staff of a practice) is unchanged. Signed-in users are not
-- affected (their grants are separate).
--
-- Not changed here: practices stays fully readable by anon, because the practice-website
-- platform reads it server-side with select=* by slug or domain (a column grant would make
-- select=* fail and take those websites down). admin_password and gmail_refresh_token are empty
-- in every row; the 5 practices with bank details print them on their invoices anyway. The fix
-- for practices is a public listing view the website platform switches to (phase 2 of
-- 2026-10-07-close-anonymous-access.sql).
--
-- Undo: REVOKE SELECT ON public.users FROM anon; GRANT SELECT ON public.users TO anon;
-- =============================================================================================

BEGIN;

REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, full_name, email, role, job_title, staff_title, hpcsa_number, avatar, practice_id, is_active, created_at)
  ON public.users TO anon;

-- Checks
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.users', 'account_number', 'SELECT')
     OR has_column_privilege('anon', 'public.users', 'bank_name', 'SELECT')
     OR has_column_privilege('anon', 'public.users', 'branch_code', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: anon can still read staff bank details';
  END IF;
  IF NOT has_column_privilege('anon', 'public.users', 'hpcsa_number', 'SELECT')
     OR NOT has_column_privilege('anon', 'public.users', 'created_at', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: practice websites lost a column they show or sort on';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
