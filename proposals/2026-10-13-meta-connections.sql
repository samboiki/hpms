-- =============================================================================================
-- PROPOSAL: a practice's own Facebook pages and Instagram business accounts, with their tokens kept server-side
-- File:   proposals/2026-10-13-meta-connections.sql                       Drafted: 2026-10-13
-- Code:   supabase/functions-proposals/meta-oauth/ (index.ts: the connect flow; metaOAuth.ts: pure rules, tested),
--         src/services/metaConnectService.ts and src/components/settings/MetaConnectCards.tsx (Settings > Social)
--
-- Why (owner decision, 13 Oct 2026): practices connect THEIR OWN Facebook pages and Instagram business accounts.
-- The old Settings > Social "Add account" wrote unknown columns of practice_social_accounts and always failed, and
-- that table keeps tokens in columns the browser can read. A page token lets anyone post as the practice, so the
-- new table's token column is never readable by staff: meta-oauth (service role) writes and deletes rows; staff of
-- the practice read only the names and dates (column privileges).
--
-- What it does (new table only; no existing table or policy changes)
--   1. practice_meta_connections: one row per connected Facebook page, and one per Instagram business account linked
--      to a page (it posts with the page's token). Unique per practice, platform and Meta id.
--   2. Row-level security on; staff of the practice SELECT their practice's rows; no INSERT/UPDATE/DELETE for
--      signed-in users (only the service role, i.e. meta-oauth). Column SELECT excludes access_token.
--      The RESTRICTIVE portal_staff_only policy when public.portal_is_staff() exists (patient app logins see nothing).
--   3. Checks: staff cannot read access_token; anon has no rights.
--
-- How to apply: rehearse in a transaction that rolls back (a practice's staff: their rows without the token column,
-- selecting access_token refused 42501; another practice's staff: 0 rows; anon: refused). Then apply the part between
-- BEGIN; and ROLLBACK; as one migration, and deploy meta-oauth (steps in its header). Until then Settings > Social
-- shows Facebook and Instagram as "not set up yet".
-- Undo: DROP TABLE IF EXISTS public.practice_meta_connections;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.practice_meta_connections') IS NOT NULL THEN
    RAISE EXCEPTION 'practice_meta_connections already exists';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.practice_meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook_page', 'instagram_business')),
  -- The page id or the Instagram business account id at Meta
  external_id text NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 64),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 200),
  -- The Facebook page the connection posts through (for a page, itself)
  page_id text NOT NULL CHECK (char_length(page_id) BETWEEN 1 AND 64),
  -- The page access token: server only (no SELECT for signed-in users, section 2)
  access_token text NOT NULL,
  token_expires_at timestamptz,
  connected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practice_id, platform, external_id)
);

CREATE INDEX practice_meta_connections_practice_idx ON public.practice_meta_connections (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Access: staff of the practice read names and dates; only the service role writes
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.practice_meta_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.practice_meta_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, practice_id, platform, external_id, display_name, page_id, token_expires_at, connected_by, connected_at, updated_at)
  ON public.practice_meta_connections TO authenticated;
GRANT ALL ON public.practice_meta_connections TO service_role;

CREATE POLICY practice_meta_connections_staff_read ON public.practice_meta_connections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
                    AND u.practice_id = practice_meta_connections.practice_id));

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    CREATE POLICY portal_staff_only ON public.practice_meta_connections AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.practice_meta_connections', 'access_token', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: signed-in users can read page tokens';
  END IF;
  IF has_table_privilege('anon', 'public.practice_meta_connections', 'SELECT')
     OR has_table_privilege('authenticated', 'public.practice_meta_connections', 'INSERT')
     OR has_table_privilege('authenticated', 'public.practice_meta_connections', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.practice_meta_connections', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: only the service role may write connections, and anon may not read them';
  END IF;
END $$;

ROLLBACK;
