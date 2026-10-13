-- URGENT: close public (anonymous) access to OneHealth data (proposal, 2026-10-07). Run in the Supabase SQL editor:
-- first as it is (it ends in ROLLBACK, so nothing changes; read the NOTICE lines), then with ROLLBACK changed to COMMIT.
--
-- Why (checked 2026-10-07 through the Supabase connector, metadata only, no data read):
-- * exec_raw_sql(text) and execute_raw_sql(text) are SECURITY DEFINER (they run with their owner's full rights) and
--   EXECUTABLE BY ANYONE with the public key that ships in the web app: anyone could run any SQL on the whole database.
--   Only server-side edge functions (service role) call them.
-- * The anonymous role has read AND write rights on every table. About 60 tables and views have row-level security off
--   (claim lines with patient names and ID numbers, vitals, next of kin, visit documents...), and views such as
--   encounters_view and patient_details_view run with their owner's rights, so they expose patients and visits even
--   though the patients table itself is protected. Count-only checks with the public key confirmed it (for example
--   3,112 invoices, 14,454 invoice lines, 111 claim lines, 1,551 vitals rows).
-- This script changes nothing for signed-in users. The public websites keep reading practices, users, the price plans,
-- the fund list and suburbs (read-only now; phase 2 replaces practices/users with listing views).
-- It does NOT touch tables that OneHealth's code never uses (they look like other apps sharing this database: bet_*,
-- bets_jukebox_*, and the inpatient/wards and leads tables listed in step 4) - decide those separately.
-- Signed-in users (any login, including patient logins once the patient app is live) can still read the tables that have
-- row-level security off: that is the next fix (row-level security with practice-scoped staff policies).

BEGIN;

-- 1. The raw-SQL functions: service role only
REVOKE ALL ON FUNCTION public.exec_raw_sql(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_raw_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_raw_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_raw_sql(text) TO service_role;

-- 2. OneHealth tables and views: no anonymous rights at all (135 objects)
DO $$
DECLARE
  name text;
  closed integer := 0;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'admin_audit_logs', 'admin_roles', 'admin_sessions', 'admin_users', 'ai_insights', 'appointments',
    'appointments_backup_20250625', 'audit_logs', 'automation_batch_process', 'automation_definitions',
    'automation_executions', 'automation_notifications', 'automation_queue', 'automation_queue_dashboard',
    'automation_templates', 'automation_triggers', 'batch_details', 'batch_headers', 'batch_management_view',
    'batch_submission_summary', 'batch_submissions', 'batch_trailer', 'benefits', 'bonus_configurations',
    'branches', 'communications_log', 'communications_log_view', 'daily_financial_kpis', 'dashboard_stats_mv',
    'deductions', 'departments', 'discharge_summaries', 'doctor_branch_schedules', 'email_analytics',
    'email_templates', 'employee_salaries', 'employee_salary_components', 'employee_salary_configurations',
    'encounters_view', 'financial_dashboard_fast', 'follow_up_automation_queue', 'follow_up_automation_status',
    'follow_up_templates', 'frequent_tariff_codes', 'hr_audit_logs', 'imaging_requests',
    'internal_channel_members', 'internal_channel_read_status', 'internal_message_attachments',
    'internal_message_channels', 'internal_message_reactions', 'internal_message_read_receipts',
    'internal_message_threads', 'internal_messages', 'internal_notification_templates', 'invoice_services',
    'invoices_enhanced', 'lab_requests', 'lab_results', 'leave_balances', 'leave_forms', 'leave_request_history',
    'leave_requests', 'leave_types', 'medical_aid_details', 'medical_aid_schemes', 'medical_aid_service_prices',
    'medications', 'medications_with_details', 'message_templates', 'messages', 'monthly_revenue_summary',
    'next_of_kin', 'notification_deliveries', 'notification_queue', 'notification_triggers',
    'oauth_callback_tokens', 'patient_audit_logs', 'patient_details_view', 'patient_documents', 'patient_imaging',
    'patient_laboratory', 'patient_location_density', 'patient_media', 'patient_visit_stats', 'patients',
    'payment_status_analytics', 'payslip_adjustments', 'payslip_items', 'payslips', 'practice_analytics',
    'practice_automation_settings', 'practice_documents', 'practice_email_logs', 'practice_email_subscriptions',
    'practice_expense_templates', 'practice_expenses', 'practice_features', 'practice_inventory',
    'practice_invitations', 'practice_notification_templates', 'practice_oauth_apps', 'practice_oauth_credentials',
    'practice_service_subscriptions', 'practice_settings', 'practice_sms_logs', 'practice_sms_subscriptions',
    'practice_social_accounts', 'practice_tariffs', 'practice_tariffs_with_types', 'practice_types',
    'review_requests', 'rooms', 'salary_components', 'service_performance_summary', 'service_usage_frequency',
    'smart_notification_deliveries', 'sms_analytics', 'sms_logs', 'sms_portal_config', 'sms_templates',
    'sms_usage_logs', 'system_config', 'system_notifications', 'timesheet_entries', 'timesheets',
    'today_visits_view', 'top_services_aggregate', 'typing_indicators', 'user_notification_preferences',
    'user_practice_assignments', 'user_profiles', 'visit_documents', 'visits', 'vitals'
  ] LOOP
    IF to_regclass('public.' || quote_ident(name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', name);
      closed := closed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Anonymous rights removed on % OneHealth tables/views', closed;
END
$$;

-- 3. Read by the public websites before sign-in: keep reading, never writing
DO $$
DECLARE
  name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['practices', 'users', 'service_plans', 'sms_plans', 'email_plans', 'medical_aid_providers', 'suburbs'] LOOP
    IF to_regclass('public.' || quote_ident(name)) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', name);
    END IF;
  END LOOP;
END
$$;

-- 4. Not used by OneHealth's code (another app?), left as they are. Several hold patient data with row-level security
--    off and are open to the public key too; close them once you know which app uses them:
--   'ai_search_logs', 'automation_processing_log', 'bed_allocations', 'bed_transfer_history', 'beds',
--   'client_leads', 'expense_items', 'follow_up_automation_log_summary', 'follow_up_automation_logs',
--   'hospital_wards', 'inpatient_medications', 'message_engagement_metrics', 'notification_follow_up_sequences',
--   'nursing_care_records', 'patient_admissions', 'patient_locations', 'practice_automation_queue_stats',
--   'practice_signup_requests', 'social_media_accounts', 'staff_titles', 'system_logs', 'visitor_logs',
--   'ward_beds', 'ward_rounds', 'wards'

-- 5. Check: what the anonymous role can still reach (expect only the 7 public-site tables, other apps, and step 4's list)
SELECT c.relname, has_table_privilege('anon', c.oid, 'SELECT') AS anon_select, has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT'))
  AND c.relname NOT LIKE 'bet_%' AND c.relname NOT LIKE 'bets_%' AND c.relname NOT LIKE 'vw_jukebox_%'
ORDER BY 1;
SELECT p.oid::regprocedure, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('exec_raw_sql', 'execute_raw_sql');

ROLLBACK; -- change to COMMIT and run again

-- Phase 2 (separate change): listing views for the public websites, then close practices and users:
-- CREATE VIEW public.public_practitioners AS SELECT id, practice_id, full_name, role, job_title, staff_title, hpcsa_number, avatar
--   FROM public.users WHERE COALESCE(is_active, true);
-- CREATE VIEW public.public_practice_profiles AS SELECT <listing columns only> FROM public.practices;
-- GRANT SELECT ON public.public_practitioners, public.public_practice_profiles TO anon;
-- REVOKE ALL ON public.users, public.practices FROM anon;
-- and switch hpms-landing (src/lib/tenants.ts, src/components/newcharm/NewCharmAbout.tsx, src/components/PracticeDirectory.tsx).
