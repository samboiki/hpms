-- Applied 2026-10-08 as migration close_public_functions_2026_10_08
-- =============================================================================================
-- PROPOSAL: the public key can no longer run SQL or OneHealth's owner-rights functions
-- File:   proposals/2026-10-08-close-public-functions.sql               Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, section 8 items 1, 2 and 5, verified):
--   * The deployed execute-sql edge function (2025) passes any SQL it is sent to exec_raw_sql with the
--     service key; its only check is that an Authorization header exists, which the public key passes.
--     So anyone could change or delete any data in this shared database. ai-search-patients also runs
--     AI-generated SQL through exec_raw_sql with full rights. Taking EXECUTE away from every role but the
--     owner makes both fail closed without a deploy. (Nothing else calls exec_raw_sql / execute_raw_sql.)
--   * execute_patient_search(query, params) runs any query past row security, and with
--     execute_dynamic_search was callable with the public key. Nothing in the app calls them.
--   * 36 SECURITY DEFINER functions (run as their owner, past every practice's row security) were
--     callable with the public key. API logs (4 and 7 October) show no anonymous calls to any database
--     function: practice websites read tables only. So the public key loses them all.
--     - Functions the app calls while signed in keep EXECUTE for signed-in users (a practice check for
--       the ones without one is the next step: add_invoice_to_batch, prepare_batch_for_sending,
--       get_practice_statistics, send_sms_direct, ...). get_user_practices is used in 2 policies.
--     - Functions nothing calls (no app or function caller, not in a policy or view) lose signed-in access
--       too: arbitrary searches, test "send" functions, data bundles without a practice check. The
--       service key keeps them in case an undocumented deployed function uses one.
-- Undo: GRANT EXECUTE ON FUNCTION <signature> TO anon, authenticated (per function; see the lists below).
-- =============================================================================================

BEGIN;

-- 1. Raw SQL: the owner only
REVOKE EXECUTE ON FUNCTION public.exec_raw_sql(text) FROM PUBLIC, anon, authenticated, service_role;
DO $$
BEGIN
  IF to_regprocedure('public.execute_raw_sql(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.execute_raw_sql(text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END $$;

-- 2 and 3. Owner-rights functions: never the public key
DO $$
DECLARE
  v_unused constant text[] := ARRAY[
    'execute_patient_search', 'execute_dynamic_search', 'process_pending_sms', 'send_pending_sms',
    'send_happy_joy_email_now', 'send_pending_email_for_happy_joy', 'cleanup_expired_oauth_tokens',
    'create_batch_submission', 'get_dashboard_data_bundle', 'get_visit_with_details',
    'handle_gmail_oauth_callback', 'increment_email_usage', 'is_admin', 'is_channel_member', 'log_admin_action'
  ];
  r record;
  v_closed integer := 0;
  v_kept integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature, p.proname, p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.signature);
    IF r.is_trigger THEN
      CONTINUE;
    ELSIF r.proname = ANY (v_unused) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.signature);
      v_closed := v_closed + 1;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.signature);
      v_kept := v_kept + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'closed to everyone but the service key: %, kept for signed-in users: %', v_closed, v_kept;
END $$;

-- Checks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f' AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Check failed: the public key can still run an owner-rights function';
  END IF;
  IF has_function_privilege('service_role', 'public.exec_raw_sql(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.execute_patient_search(text, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: raw SQL or the open search is still callable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.add_invoice_to_batch(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_user_practices(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: signed-in users lost a function the app or a policy uses';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
