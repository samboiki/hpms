-- Applied 2026-10-08 as migration practice_features_switch_2026_10_08 (md5 of the part between BEGIN; and
-- ROLLBACK; = md5 of the stored statement: e72aa43594946c01b386266e1fc3f6c4)
-- =============================================================================================
-- PROPOSAL: OneHealth support switches a practice's SMS replies on and off (set_practice_feature)
-- File:   proposals/2026-10-08-practice-features-switch.sql             Drafted: 2026-10-08
-- Code:   src/services/practiceFeatureService.ts (SUPPORT_SWITCHED_FEATURES, setPracticeFeature),
--         src/components/admin/SmsRepliesSwitch.tsx, src/pages/admin/PracticesManagement.tsx
--
-- Why: since 2026-10-08 reminders, booking confirmations and the welcome invite a reply ("Reply 1 to confirm")
-- only while the practice has a practice_features row 'sms_replies' with is_enabled true (the senders read it with
-- the service key, staff read their own practice's row). Nobody could write that row except with the service key,
-- so OneHealth support had to run SQL by hand. This function is the one way to switch it:
--   * only an active OneHealth super admin (public.rls_is_super_admin()) may call it: practice administrators and
--     staff are refused, because a practice must not invite replies its SMS number cannot receive;
--   * only known keys (v_known below, the app's SUPPORT_SWITCHED_FEATURES; a unit test compares them), first
--     'sms_replies';
--   * the row is created or updated (updated_at = now()) and every change goes to audit_logs: who (user_id), when
--     (created_at), before and after. Super admins read every entry, the practice's administrators their own.
-- Requires: 2026-10-07-practice-isolation.sql (rls_is_super_admin). No policy changes: practice_features keeps its
-- practice-isolation policies (staff read their practice's rows, nobody writes directly).
--
-- How to apply: rehearse (scripts/db/rehearsal.ts runs it in one rolled-back transaction), then apply the part
-- between BEGIN; and ROLLBACK; as a migration. Until then the switch in Practice Management says it is not set up.
-- Undo: DROP FUNCTION public.set_practice_feature(uuid, text, boolean);  (rows and audit entries it wrote stay)
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
     WHERE conrelid = 'public.practice_features'::regclass AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (practice_id, feature_key)'
  ) THEN
    RAISE EXCEPTION 'practice_features needs its UNIQUE (practice_id, feature_key) constraint';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The switch
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_practice_feature(p_practice_id uuid, p_feature_key text, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Features OneHealth support switches per practice (the app's SUPPORT_SWITCHED_FEATURES)
  v_known constant text[] := ARRAY['sms_replies'];
  v_before public.practice_features%ROWTYPE;
  v_after public.practice_features%ROWTYPE;
BEGIN
  IF NOT public.rls_is_super_admin() THEN
    RAISE EXCEPTION 'Only OneHealth support can switch practice features.' USING ERRCODE = '42501';
  END IF;
  IF p_feature_key IS NULL OR NOT (p_feature_key = ANY (v_known)) THEN
    RAISE EXCEPTION 'OneHealth support cannot switch the feature "%".', COALESCE(p_feature_key, '') USING ERRCODE = '22023';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Say whether the feature is on or off.' USING ERRCODE = '22023';
  END IF;
  IF p_practice_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.id = p_practice_id) THEN
    RAISE EXCEPTION 'This practice does not exist.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_before FROM public.practice_features f
   WHERE f.practice_id = p_practice_id AND f.feature_key = p_feature_key
   FOR UPDATE;

  INSERT INTO public.practice_features (practice_id, feature_key, is_enabled, created_at, updated_at)
  VALUES (p_practice_id, p_feature_key, p_enabled, now(), now())
  ON CONFLICT (practice_id, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now()
  RETURNING * INTO v_after;

  -- Who switched it and when (super admins read every entry, the practice's administrators their practice's)
  INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, user_role, description)
  VALUES (
    'practice_features', v_after.id,
    CASE WHEN v_before.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    CASE WHEN v_before.id IS NULL THEN NULL
         ELSE jsonb_build_object('practice_id', v_before.practice_id, 'feature_key', v_before.feature_key,
                                 'is_enabled', v_before.is_enabled) END,
    jsonb_build_object('practice_id', v_after.practice_id, 'feature_key', v_after.feature_key,
                       'is_enabled', v_after.is_enabled),
    auth.uid(), 'super_admin',
    format('OneHealth support switched %s %s', p_feature_key, CASE WHEN p_enabled THEN 'on' ELSE 'off' END)
  );

  RETURN jsonb_build_object('practice_id', v_after.practice_id, 'feature_key', v_after.feature_key,
                            'is_enabled', v_after.is_enabled, 'updated_at', v_after.updated_at);
END;
$$;
COMMENT ON FUNCTION public.set_practice_feature(uuid, text, boolean) IS
  'OneHealth support (active super admins) switches a practice feature on or off; known keys only (sms_replies). Every change is in audit_logs.';

-- ---------------------------------------------------------------------------------------------
-- 2. Signed-in users only (the function itself refuses everyone but super admins)
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_practice_feature(uuid, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_practice_feature(uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.set_practice_feature(uuid, text, boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.set_practice_feature(uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: only signed-in users may call set_practice_feature';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_practice_feature(uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: signed-in users cannot call set_practice_feature';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = 'public.set_practice_feature(uuid, text, boolean)'::regprocedure
       AND prosecdef AND proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'Check failed: set_practice_feature must run as its owner with an empty search_path';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
