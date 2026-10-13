-- Applied 2026-10-07 as migration rls_onehealth_tables_2026_10_07
-- =============================================================================================
-- Row level security for signed-in users on the OneHealth tables that still had it off, and views
-- that run with the caller's rights
-- File:    proposals/2026-10-07-rls-onehealth.sql                          Drafted: 2026-10-07
--
-- Why
--   These 15 OneHealth tables had row level security off, so any signed-in login (staff of another
--   practice, or a future patient app login) could read and change every row through the API: claim
--   batches, vitals, next of kin, visit documents, the follow-up queue, plans and system settings.
--   And 19 views ran with their owner's rights, so they showed every practice's rows to any signed-in
--   login (the appointments view returned all practices' visits to every staff member).
--
-- How it was applied
--   Tested before applying, inside BEGIN ... ROLLBACK, as an active staff member of each practice,
--   as a super admin, as a random signed-in outsider, as the anon key and as the service role (counts
--   only, no values). Then applied as migration rls_onehealth_tables_2026_10_07: this file without its
--   BEGIN / ROLLBACK lines.
--   Order for a rehearsal: before proposals/2026-10-07-patient-portal.sql, whose staff-only guard then
--   covers these tables too. On a database where the portal file is applied, section 5 re-runs the guard.
--
-- The rule for practice tables (as in the other October proposals, plus "active" and super admins)
--   EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)
--           AND (u.is_super_admin = true OR u.practice_id = <the row's practice>))
--   <the row's practice> is the table's practice_id, or comes from the parent row:
--     batch_details, batch_trailer        batch_header_id -> batch_headers.practice_id
--     next_of_kin, discharge_summaries    patient_id -> patients.practice_id
--     vitals                              visit_id -> visits.practice_id
--     automation_notifications            execution_id -> automation_executions.practice_id
--   One policy per table, FOR ALL (select, insert, update, delete), TO authenticated. auth.uid() is
--   written (SELECT auth.uid()) so it is worked out once per query, not once per row.
--   Rows whose practice cannot be found are seen by super admins only: 5 rows of the June 2025
--   appointments backup without a practice, and 63 vitals of visits without a practice (staff cannot
--   see those visits either).
--
-- Global reference tables
--   service_plans, email_plans, suburbs: everyone may read them, the anon key included (the public site
--   and the admin dashboard read them; anon read-only since the earlier change today); only super
--   admins change them.
--   system_config: signed-in users read the settings marked is_public (1 of 5); super admins read and
--   change all of them (they include the email and SMS provider settings).
--
-- Views (section 4): security_invoker = on, so the caller's row level security applies. Every base
--   table has row level security with policies once sections 1-2 ran. Not changed, for the owner:
--     medications_with_details, sms_analytics: they read auth.users (directly, or through a base
--       table's policy), which signed-in users may not read, so they would fail. They still show every
--       practice's rows to any signed-in login.
--     dashboard_stats_mv, patient_location_density, patient_visit_stats, today_visits_view: materialized
--       views; neither security_invoker nor row level security applies to them.
--
-- Test results (counts, before applying)
--   Practice tables, staff of practice b646 / staff of practice ffed / super admin / outsider / all rows:
--     appointments_backup_20250625 60/0/65/0/65, automation_notifications 42/3/45/0/45,
--     batch_details 59/52/111/0/111, batch_headers 94/5/99/0/99, batch_trailer 4/5/9/0/9,
--     follow_up_automation_queue 3047/21/3068/0/3068, next_of_kin 27/2/29/0/29,
--     visit_documents 11/54/65/0/65, vitals 1486/2/1551/0/1551, discharge_summaries and email_analytics
--     empty. Each staff count equals that practice's rows.
--   Global: service_plans 0 rows, email_plans 1, suburbs 28 for staff, outsider and anon; system_config
--     1 (public) for staff and outsider, 5 for the super admin. The outsider loses even these once the
--     staff-only guard (section 5) covers the tables.
--   Views after security_invoker: staff see only their practice (appointments 3841 / 51 of 4015,
--     batch_management_view 94 / 5 of 99, communications_log_view 97 / 247 of 370, encounters_view
--     3843 / 51 of 4029, patient_details_view 493 / 8 of 501); the outsider sees none.
--     Admin > practice details > "recent appointments" is empty for super admins from now on: the
--     visits policies do not include super admins (they already saw no patient names there).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Practice tables: one policy each (active staff of the row's practice, or super admins), then RLS on
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_backup_20250625_staff ON public.appointments_backup_20250625;
CREATE POLICY appointments_backup_20250625_staff ON public.appointments_backup_20250625 FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = appointments_backup_20250625.practice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = appointments_backup_20250625.practice_id)));
ALTER TABLE public.appointments_backup_20250625 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_notifications_staff ON public.automation_notifications;
CREATE POLICY automation_notifications_staff ON public.automation_notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT e.practice_id FROM public.automation_executions e WHERE e.id = automation_notifications.execution_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT e.practice_id FROM public.automation_executions e WHERE e.id = automation_notifications.execution_id))));
ALTER TABLE public.automation_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_headers_staff ON public.batch_headers;
CREATE POLICY batch_headers_staff ON public.batch_headers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = batch_headers.practice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = batch_headers.practice_id)));
ALTER TABLE public.batch_headers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_details_staff ON public.batch_details;
CREATE POLICY batch_details_staff ON public.batch_details FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT h.practice_id FROM public.batch_headers h WHERE h.id = batch_details.batch_header_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT h.practice_id FROM public.batch_headers h WHERE h.id = batch_details.batch_header_id))));
ALTER TABLE public.batch_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_trailer_staff ON public.batch_trailer;
CREATE POLICY batch_trailer_staff ON public.batch_trailer FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT h.practice_id FROM public.batch_headers h WHERE h.id = batch_trailer.batch_header_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT h.practice_id FROM public.batch_headers h WHERE h.id = batch_trailer.batch_header_id))));
ALTER TABLE public.batch_trailer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discharge_summaries_staff ON public.discharge_summaries;
CREATE POLICY discharge_summaries_staff ON public.discharge_summaries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = discharge_summaries.patient_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = discharge_summaries.patient_id))));
ALTER TABLE public.discharge_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_analytics_staff ON public.email_analytics;
CREATE POLICY email_analytics_staff ON public.email_analytics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = email_analytics.practice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = email_analytics.practice_id)));
ALTER TABLE public.email_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_up_automation_queue_staff ON public.follow_up_automation_queue;
CREATE POLICY follow_up_automation_queue_staff ON public.follow_up_automation_queue FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = follow_up_automation_queue.practice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = follow_up_automation_queue.practice_id)));
ALTER TABLE public.follow_up_automation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS next_of_kin_staff ON public.next_of_kin;
CREATE POLICY next_of_kin_staff ON public.next_of_kin FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = next_of_kin.patient_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = next_of_kin.patient_id))));
ALTER TABLE public.next_of_kin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visit_documents_staff ON public.visit_documents;
CREATE POLICY visit_documents_staff ON public.visit_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = visit_documents.practice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = visit_documents.practice_id)));
ALTER TABLE public.visit_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vitals_staff ON public.vitals;
CREATE POLICY vitals_staff ON public.vitals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT v.practice_id FROM public.visits v WHERE v.id = vitals.visit_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = (SELECT v.practice_id FROM public.visits v WHERE v.id = vitals.visit_id))));
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------
-- 2. Global reference tables: read by everyone (system_config: its public settings), written by
--    super admins only
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS service_plans_read ON public.service_plans;
CREATE POLICY service_plans_read ON public.service_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS service_plans_super_admin ON public.service_plans;
CREATE POLICY service_plans_super_admin ON public.service_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_plans_read ON public.email_plans;
CREATE POLICY email_plans_read ON public.email_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS email_plans_super_admin ON public.email_plans;
CREATE POLICY email_plans_super_admin ON public.email_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));
ALTER TABLE public.email_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suburbs_read ON public.suburbs;
CREATE POLICY suburbs_read ON public.suburbs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS suburbs_super_admin ON public.suburbs;
CREATE POLICY suburbs_super_admin ON public.suburbs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));
ALTER TABLE public.suburbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_config_read_public ON public.system_config;
CREATE POLICY system_config_read_public ON public.system_config FOR SELECT TO authenticated USING (COALESCE(is_public, false));
DROP POLICY IF EXISTS system_config_super_admin ON public.system_config;
CREATE POLICY system_config_super_admin ON public.system_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------
-- 3. The anon key's access that today's fund tariffs file left (default privileges). Its policies
--    already gave anon no rows; the grants go too, as for every other OneHealth table.
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON public.fund_tariffs, public.fund_tariff_contracts, public.fund_tariffs_with_types FROM anon;

-- ---------------------------------------------------------------------------------------------
-- 4. Views run with the caller's rights, so the base tables' row level security applies
--    (not changed: medications_with_details and sms_analytics would fail; the materialized views
--    cannot; see the header)
-- ---------------------------------------------------------------------------------------------
ALTER VIEW public.appointments SET (security_invoker = on);
ALTER VIEW public.automation_batch_process SET (security_invoker = on);
ALTER VIEW public.automation_queue_dashboard SET (security_invoker = on);
ALTER VIEW public.batch_management_view SET (security_invoker = on);
ALTER VIEW public.batch_submission_summary SET (security_invoker = on);
ALTER VIEW public.communications_log_view SET (security_invoker = on);
ALTER VIEW public.daily_financial_kpis SET (security_invoker = on);
ALTER VIEW public.encounters_view SET (security_invoker = on);
ALTER VIEW public.financial_dashboard_fast SET (security_invoker = on);
ALTER VIEW public.follow_up_automation_status SET (security_invoker = on);
ALTER VIEW public.frequent_tariff_codes SET (security_invoker = on);
ALTER VIEW public.monthly_revenue_summary SET (security_invoker = on);
ALTER VIEW public.patient_audit_logs SET (security_invoker = on);
ALTER VIEW public.patient_details_view SET (security_invoker = on);
ALTER VIEW public.payment_status_analytics SET (security_invoker = on);
ALTER VIEW public.practice_tariffs_with_types SET (security_invoker = on);
ALTER VIEW public.service_performance_summary SET (security_invoker = on);
ALTER VIEW public.service_usage_frequency SET (security_invoker = on);
ALTER VIEW public.top_services_aggregate SET (security_invoker = on);

-- ---------------------------------------------------------------------------------------------
-- 5. With the patient portal applied: its staff-only guard now covers these tables too
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_bad
  FROM (VALUES ('appointments_backup_20250625'), ('automation_notifications'), ('batch_details'), ('batch_headers'), ('batch_trailer'),
               ('discharge_summaries'), ('email_analytics'), ('email_plans'), ('follow_up_automation_queue'), ('next_of_kin'),
               ('service_plans'), ('suburbs'), ('system_config'), ('visit_documents'), ('vitals')) AS t(name)
  WHERE NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = format('public.%I', t.name)::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.name AND p.policyname <> 'portal_staff_only');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: row level security off, or no policy, on %', v_bad;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'v'
    AND c.relname IN ('appointments', 'automation_batch_process', 'automation_queue_dashboard', 'batch_management_view',
                      'batch_submission_summary', 'communications_log_view', 'daily_financial_kpis', 'encounters_view',
                      'financial_dashboard_fast', 'follow_up_automation_status', 'frequent_tariff_codes', 'monthly_revenue_summary',
                      'patient_audit_logs', 'patient_details_view', 'payment_status_analytics', 'practice_tariffs_with_types',
                      'service_performance_summary', 'service_usage_frequency', 'top_services_aggregate')
    AND NOT COALESCE((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), false);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: views still run with their owner''s rights: %', v_bad;
  END IF;

  IF has_table_privilege('anon', 'public.fund_tariffs', 'SELECT') OR has_table_privilege('anon', 'public.fund_tariff_contracts', 'SELECT')
     OR has_table_privilege('anon', 'public.fund_tariffs_with_types', 'SELECT')
     OR has_table_privilege('anon', 'public.vitals', 'SELECT') OR has_table_privilege('anon', 'public.next_of_kin', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: the anon key can still read practice data';
  END IF;

  RAISE NOTICE 'Row level security on for the 15 tables; 19 views run with the caller''s rights';
END
$$;

-- PostgREST: pick up the changed views
NOTIFY pgrst, 'reload schema';

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction:
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY; and DROP POLICY IF EXISTS <table>_staff ON public.<table>;
--   for the 11 practice tables; for service_plans, email_plans and suburbs drop <table>_read and
--   <table>_super_admin; for system_config drop system_config_read_public and system_config_super_admin.
--   ALTER VIEW public.<view> SET (security_invoker = off); for the 19 views of section 4.
--   (The anon grants of section 3 are not restored: nothing used them.)
-- =============================================================================================
