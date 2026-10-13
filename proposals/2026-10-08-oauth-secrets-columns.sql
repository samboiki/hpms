-- =============================================================================================
-- PROPOSAL, NOT APPLIED: signed-in users can no longer read OAuth client secrets or account tokens
-- File:   proposals/2026-10-08-oauth-secrets-columns.sql                 Drafted: 2026-10-08
-- Code:   supabase/functions/exchange-oauth-code (exchanges Google's code with the stored secret, saves the tokens),
--         src/services/gmailConnectService.ts, GmailOAuthSettings.tsx, GmailSettingsModal.tsx,
--         src/pages/oauth/UniversalCallback.tsx, src/pages/Settings.tsx (Social tab)
--
-- !! APPLY ONLY AFTER THE RELEASE that ships those files AND the exchange-oauth-code deploy. !!
-- Today's live app reads practice_oauth_apps.client_secret in the browser to exchange Google's code, and reads
-- these tables with select('*'): applied before the release, connecting Gmail and the Settings > Social tab stop
-- working. It is not in scripts/db/rehearsal.ts DEFAULT_ORDER for that reason.
--
-- Why: row-level security limits rows, not columns. Every administrator or doctor of a practice could read the
-- practice's Google client secret (practice_oauth_apps), and every staff member could read its Gmail refresh and
-- access tokens (practice_oauth_credentials, policy "Practice users can view their OAuth credentials"), which send
-- email as the practice from anywhere. practice_social_accounts holds the same kind of secrets for social
-- platforms. Since the release the server exchanges the code, and only edge functions (service role) use them.
--
-- Postgres ignores a column REVOKE while a table-wide SELECT grant stands, so each table's SELECT is taken from
-- signed-in users and given back column by column, every column except the secret ones (counts on 2026-10-08:
-- practice_oauth_apps 1 row with a secret, practice_oauth_credentials 1 row, practice_social_accounts 0 rows):
--   1. practice_oauth_apps: all but client_secret.
--   2. practice_oauth_credentials: all but refresh_token and access_token.
--   3. practice_social_accounts: all but access_token, refresh_token, access_token_encrypted,
--      refresh_token_encrypted, app_secret, client_secret, webhook_secret and oauth_code_verifier.
--   4. check_gmail_connection(uuid) read refresh_token with the caller's rights (it would now fail); the app no
--      longer calls it, so only the service key keeps it.
-- Writing is unchanged: administrators still save a new client secret in Settings > Social, and disconnecting
-- still deletes the connection. Two things fail after this file, and the released app does neither: a select('*')
-- on these tables (it names its columns), and an upsert of a secret (INSERT ... ON CONFLICT DO UPDATE needs SELECT on
-- the columns it overwrites; saveGoogleOAuthApp inserts or updates instead; rehearsed 2026-10-08). The service key
-- (edge functions) keeps every column. No policy changes.
-- Not here: practice_automation_settings.google_refresh_token and practices.gmail_refresh_token (no row holds a token
-- on 2026-10-08; exchange-oauth-code no longer copies the token into practice_automation_settings), because the
-- browser still reads both tables with select('*').
--
-- How to apply: after the release, rehearse (node scripts/db/rehearse-proposals.ts with this file's path), then
-- apply the part between BEGIN; and ROLLBACK; as a migration.
-- Undo: GRANT SELECT ON public.practice_oauth_apps, public.practice_oauth_credentials, public.practice_social_accounts
--       TO authenticated; GRANT EXECUTE ON FUNCTION public.check_gmail_connection(uuid) TO authenticated;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1-3. Every column but the secrets
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_secret_columns constant jsonb := jsonb_build_object(
    'practice_oauth_apps', jsonb_build_array('client_secret'),
    'practice_oauth_credentials', jsonb_build_array('refresh_token', 'access_token'),
    'practice_social_accounts', jsonb_build_array('access_token', 'refresh_token', 'access_token_encrypted',
      'refresh_token_encrypted', 'app_secret', 'client_secret', 'webhook_secret', 'oauth_code_verifier')
  );
  v_table text;
  v_readable text;
BEGIN
  FOR v_table IN SELECT jsonb_object_keys(v_secret_columns) LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'public.% does not exist', v_table;
    END IF;
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_readable
      FROM pg_attribute a
     WHERE a.attrelid = ('public.' || v_table)::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND NOT (v_secret_columns -> v_table) ? a.attname::text;
    EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated, anon', v_table);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', v_readable, v_table);
    RAISE NOTICE '%: signed-in users read %', v_table, v_readable;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. check_gmail_connection read the refresh token as the caller: the service key only
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.check_gmail_connection(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.check_gmail_connection(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.check_gmail_connection(uuid) TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Checks
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.practice_oauth_apps', 'client_secret', 'SELECT')
     OR has_column_privilege('authenticated', 'public.practice_oauth_credentials', 'refresh_token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.practice_oauth_credentials', 'access_token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.practice_social_accounts', 'access_token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.practice_social_accounts', 'client_secret', 'SELECT')
     OR has_column_privilege('anon', 'public.practice_oauth_credentials', 'refresh_token', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: a signed-in user can still read an OAuth secret';
  END IF;
  -- What the released app reads and writes
  IF NOT has_column_privilege('authenticated', 'public.practice_oauth_apps', 'client_id', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.practice_oauth_credentials', 'email', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.practice_oauth_credentials', 'metadata', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.practice_social_accounts', 'account_name', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.practice_oauth_apps', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.practice_oauth_apps', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.practice_oauth_credentials', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: signed-in users lost a column or write the app uses';
  END IF;
  -- The edge functions keep everything
  IF NOT has_column_privilege('service_role', 'public.practice_oauth_apps', 'client_secret', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.practice_oauth_credentials', 'refresh_token', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: the service key lost an OAuth column';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration (after the release)
ROLLBACK;
