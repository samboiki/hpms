-- Applied 2026-10-13 as migration report_builder_2026_10_13 (version 20261013012331; stored statement md5 634f79b09fd366ff6b2d69e8a4c0d4c5 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back): anon refused reading, saving and the check (42501); the practice's
-- administrator saved (the name tidied to single spaces), read 1, was refused the same name in other capitals (23505),
-- changed the report in place, and was refused an extra key, the source "patients", SQL as a column, 21 columns, a
-- 201-character filter, half a cent, no name and 4,000 characters of search (22023) and direct inserts and updates
-- (42501); the receptionist read it, saved and removed a payments report (kept, marked removed) and could reuse its
-- name; a doctor in a practice that keeps Finance to administrators was refused saving and removing (42501); another
-- practice's doctor read 0, was refused saving into the practice and changing its report (42501) and was told the
-- report is not in the list (P0002); a patient-app login read 0 and could not save (42501). After applying, the
-- administrator saved, read back and removed a report (rolled back; the table is empty).
-- =============================================================================================
-- PROPOSAL: saved reports for Finance > Reports' report builder (parity R22)
-- File:   proposals/2026-10-13-report-builder.sql                           Drafted: 2026-10-13
-- Code:   src/components/finance/practiceReports/reportBuilder.ts (the fields a report may show, filter or group on,
--         and the definition's shape, checked again whenever one is read; tested),
--         src/components/finance/practiceReports/reportBuilderService.ts (reads; saving through the functions below),
--         src/components/finance/practiceReports/ReportBuilderReport.tsx (the screen)
--
-- Why (parity R22): Eminance has a report generator with saved queries; Finance > Reports had a fixed catalogue. The
-- builder lets a practice pick invoices, payments or visits of the period, the columns, filters and a grouping, and keep
-- that as a report of its own. A saved report is a definition only: which fields, filters and grouping. The app reads
-- the rows with the signed-in person's own rights through a fixed list of fields; a definition holds no SQL and nothing
-- here runs one.
--
-- What it does
--   1. report_queries: per practice, a name and a definition (jsonb with exactly these keys: v, source, columns,
--      filters, search, min_amount, group_by), who saved it and when, and when it was removed (archived_at: a removed
--      report stays in the table). Staff of the practice read them (row level security); nobody writes the table
--      directly (no grant).
--   2. report_query_save(practice, id, name, definition) saves a new report (id null) or changes one of the practice's
--      reports; the definition's shape is checked (report_query_problem): a known source, field keys of lower-case
--      letters and underscores, at most 20 columns and 12 filters, short texts, 4,000 characters in all. Names are
--      unique per practice among reports not removed (23505). report_query_archive(id) removes one. Both are for staff
--      of the practice who may open Finance (claim_assert_staff, as every Finance report function), run as their owner
--      with search_path = public, and cannot be run by the public key.
--   3. The patient app's logins get nothing (the RESTRICTIVE portal_staff_only policy, as on every OneHealth table).
--   4. Checks, including that no policy of the 28 practice-isolation tables changed.
-- Needs: claim-corrections (claim_assert_staff), practice isolation (rls_my_practice_id).
-- How to apply: rehearse in a transaction that rolls back (simulated logins: the practice's administrator and
-- receptionist, a role the practice keeps out of Finance, another practice's staff, a patient-app login, anon), then
-- apply the part between BEGIN; and ROLLBACK; as one migration (report_builder_2026_10_13). Until then the builder works
-- and says that saving reports is not set up yet.
-- Undo:  DROP FUNCTION IF EXISTS public.report_query_archive(uuid);
--        DROP FUNCTION IF EXISTS public.report_query_save(uuid, uuid, text, jsonb);
--        DROP FUNCTION IF EXISTS public.report_query_problem(jsonb);
--        DROP TABLE IF EXISTS public.report_queries;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: what this file relies on, and the policies it must not change
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.claim_assert_staff(uuid)') IS NULL OR to_regprocedure('public.rls_my_practice_id()') IS NULL THEN
    RAISE EXCEPTION 'Check failed: claim_assert_staff(uuid) or rls_my_practice_id() is missing (claim-corrections, practice isolation)';
  END IF;
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(COALESCE(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname), ''))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN (
       'automation_definitions', 'automation_queue', 'invoice_services', 'invoices_enhanced', 'lab_requests', 'lab_results',
       'medical_aid_providers', 'medical_aid_schemes', 'medical_aid_service_prices_retired', 'message_templates', 'messages',
       'oauth_callback_tokens', 'patient_documents', 'patients', 'practice_email_subscriptions', 'practice_features',
       'practice_inventory', 'practice_service_subscriptions', 'practice_sms_subscriptions', 'practice_tariffs', 'practice_types',
       'practices', 'sms_logs', 'sms_plans', 'system_notifications', 'user_practice_assignments', 'user_profiles', 'users')), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The saved reports
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_queries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- A definition only (fields, filters, grouping); checked by report_query_problem when saved
  definition  jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object' AND length(definition::text) <= 4000),
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  updated_at  timestamptz,
  archived_at timestamptz,
  archived_by uuid,
  CONSTRAINT report_queries_archive_complete CHECK ((archived_at IS NULL) = (archived_by IS NULL))
);

-- One name per practice among the reports in its list
CREATE UNIQUE INDEX IF NOT EXISTS report_queries_name_idx ON public.report_queries (practice_id, lower(btrim(name))) WHERE archived_at IS NULL;

COMMENT ON TABLE public.report_queries IS
  'Saved reports of Finance > Reports > Build a report: a name and a definition (source, columns, filters, search, minimum amount, grouping; no SQL). The app reads the rows with the person''s own rights. Written only by report_query_save and report_query_archive.';

ALTER TABLE public.report_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_queries_staff_read ON public.report_queries;
CREATE POLICY report_queries_staff_read ON public.report_queries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = report_queries.practice_id));
REVOKE ALL ON public.report_queries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.report_queries TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Saving and removing
-- ---------------------------------------------------------------------------------------------

-- What is wrong with a definition, in plain words; NULL when it is fine. Only the shape is checked here: which fields a
-- report may use is the app's fixed list (reportBuilder.ts), which drops anything else when it reads a definition.
CREATE OR REPLACE FUNCTION public.report_query_problem(p_definition jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key text := '^[a-z_]{1,40}$';
BEGIN
  IF p_definition IS NULL OR jsonb_typeof(p_definition) <> 'object' THEN
    RETURN 'The report could not be read.';
  END IF;
  IF length(p_definition::text) > 4000 THEN
    RETURN 'The report is too long to save: choose fewer columns or filters.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_definition) k WHERE k NOT IN ('v', 'source', 'columns', 'filters', 'search', 'min_amount', 'group_by')) THEN
    RETURN 'The report holds something other than columns, filters and a grouping.';
  END IF;
  IF COALESCE(p_definition ->> 'source', '') NOT IN ('invoices', 'payments', 'visits') THEN
    RETURN 'A report is about invoices, payments or visits.';
  END IF;
  IF jsonb_typeof(p_definition -> 'columns') IS DISTINCT FROM 'array' OR jsonb_array_length(p_definition -> 'columns') NOT BETWEEN 1 AND 20 THEN
    RETURN 'Choose from 1 to 20 columns.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_definition -> 'columns') c WHERE jsonb_typeof(c) <> 'string' OR (c #>> '{}') !~ v_key) THEN
    RETURN 'A column of the report is not one of the report''s fields.';
  END IF;
  IF COALESCE(jsonb_typeof(p_definition -> 'filters'), 'object') <> 'object' THEN
    RETURN 'The filters of the report could not be read.';
  END IF;
  IF (SELECT count(*) FROM jsonb_each(COALESCE(p_definition -> 'filters', '{}'::jsonb))) > 12 THEN
    RETURN 'Use at most 12 filters.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(COALESCE(p_definition -> 'filters', '{}'::jsonb)) f
              WHERE f.key !~ v_key OR jsonb_typeof(f.value) <> 'string' OR char_length(f.value #>> '{}') NOT BETWEEN 1 AND 200) THEN
    RETURN 'A filter of the report is not one of the report''s fields.';
  END IF;
  IF COALESCE(jsonb_typeof(p_definition -> 'search'), 'null') NOT IN ('null', 'string') OR char_length(COALESCE(p_definition ->> 'search', '')) > 100 THEN
    RETURN 'Search for at most 100 characters.';
  END IF;
  IF COALESCE(jsonb_typeof(p_definition -> 'min_amount'), 'null') NOT IN ('null', 'number')
     OR (jsonb_typeof(p_definition -> 'min_amount') = 'number'
         AND ((p_definition ->> 'min_amount')::numeric <> trunc((p_definition ->> 'min_amount')::numeric)
              OR (p_definition ->> 'min_amount')::numeric NOT BETWEEN 0 AND 100000000000)) THEN
    RETURN 'The smallest amount must be a whole number of cents.';
  END IF;
  IF COALESCE(jsonb_typeof(p_definition -> 'group_by'), 'null') NOT IN ('null', 'string')
     OR (jsonb_typeof(p_definition -> 'group_by') = 'string' AND (p_definition ->> 'group_by') !~ v_key) THEN
    RETURN 'The report''s grouping is not one of its fields.';
  END IF;
  IF COALESCE(jsonb_typeof(p_definition -> 'v'), 'null') NOT IN ('null', 'number') THEN
    RETURN 'The report could not be read.';
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.report_query_problem(jsonb) IS
  'What is wrong with a saved report''s definition in plain words, NULL when its shape is fine. Used by report_query_save.';

CREATE OR REPLACE FUNCTION public.report_query_save(p_practice_id uuid, p_id uuid, p_name text, p_definition jsonb)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    text := regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g');
  v_problem text;
  v_id      uuid;
BEGIN
  PERFORM claim_assert_staff(p_practice_id);
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the report a name of up to 80 characters.' USING ERRCODE = '22023';
  END IF;
  v_problem := report_query_problem(p_definition);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO report_queries (practice_id, name, definition, created_by)
    VALUES (p_practice_id, v_name, p_definition, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE report_queries
       SET name = v_name, definition = p_definition, updated_by = auth.uid(), updated_at = now()
     WHERE id = p_id AND practice_id = p_practice_id AND archived_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'That saved report is not in the practice''s list any more.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.report_query_save(uuid, uuid, text, jsonb) IS
  'Saves a report of Finance > Reports > Build a report (a new one when p_id is null). Staff of the practice who open Finance.';

CREATE OR REPLACE FUNCTION public.report_query_archive(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practice uuid;
BEGIN
  -- Another practice's report is "not in the list" too: nothing is said about it
  SELECT q.practice_id INTO v_practice
    FROM report_queries q
   WHERE q.id = p_id AND q.archived_at IS NULL AND q.practice_id = (SELECT rls_my_practice_id());
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'That saved report is not in the practice''s list any more.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM claim_assert_staff(v_practice);
  UPDATE report_queries SET archived_at = now(), archived_by = auth.uid() WHERE id = p_id;
  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.report_query_archive(uuid) IS
  'Removes a saved report from the practice''s list (kept, marked removed). Staff of the practice who open Finance.';

REVOKE ALL ON FUNCTION public.report_query_problem(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_query_save(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_query_archive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_query_save(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_query_archive(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.report_queries;
    CREATE POLICY portal_staff_only ON public.report_queries AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.report_queries'::regclass)
     OR has_table_privilege('anon', 'public.report_queries', 'SELECT')
     OR has_table_privilege('authenticated', 'public.report_queries', 'INSERT')
     OR has_table_privilege('authenticated', 'public.report_queries', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.report_queries', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.report_queries', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: report_queries must be read by staff and changed only through its functions';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.report_query_save(uuid, uuid, text, jsonb)', 'public.report_query_archive(uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in staff only, running as its owner', v_fn;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.report_query_problem(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.report_query_problem(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: report_query_problem is for report_query_save only';
  END IF;
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_queries' AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'Check failed: report_queries lacks the patient app''s restrictive policy';
  END IF;
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(COALESCE(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname), ''))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN (
       'automation_definitions', 'automation_queue', 'invoice_services', 'invoices_enhanced', 'lab_requests', 'lab_results',
       'medical_aid_providers', 'medical_aid_schemes', 'medical_aid_service_prices_retired', 'message_templates', 'messages',
       'oauth_callback_tokens', 'patient_documents', 'patients', 'practice_email_subscriptions', 'practice_features',
       'practice_inventory', 'practice_service_subscriptions', 'practice_sms_subscriptions', 'practice_tariffs', 'practice_types',
       'practices', 'sms_logs', 'sms_plans', 'system_notifications', 'user_practice_assignments', 'user_profiles', 'users')) THEN
    RAISE EXCEPTION 'Check failed: a policy of the practice-isolation tables changed';
  END IF;
END $$;

ROLLBACK;
