-- Applied 2026-10-13 as migration security_sweep_2026_10_13 (version 20261013044207; stored statement md5 7bfdbf929afe6f18e1fdcd1303c4dd76 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back; twice, the second right before applying). Before: the public key ran
-- ar_today() and invoice_format_number(); reception read 5 practices' rows in dashboard_stats_mv (2 in
-- patient_visit_stats); app logins could TRUNCATE quotes. After: the public key was refused all 92 functions (42501
-- "permission denied for function", no other outcome), still read practices and staff for the practice websites, and
-- read nothing of the three guarded tables, the views or quotes (42501). The pre-visit link still worked without
-- signing in: reception booked a visit (the visit triggers fired) and changed it, the administrator set a question,
-- reception made the link, and the public key opened it (open), answered it (saved) and opened it again (answered); a
-- made-up code said not_found. Triggers fire without EXECUTE: a probe table's update_updated_at_column trigger fired
-- for the public key and for a signed-in user whose EXECUTE was also taken away (2 of 2); a trigger condition (WHEN)
-- calling ar_is_cancelled refused the public key (42501) and passed reception. Reception, the administrator and a
-- practitioner still ran ar_today, invoice_format_number, get_patient_visit_counts, get_dashboard_stats,
-- get_appointment_stats, get_patient_activity_status and get_medical_aid_providers (the same 5 rows, through its fixed
-- search path); another practice's staff and a patient-app login ran them and saw 0 rows of the practice. With
-- invented rows (2 billing, 2 exports, 1 merge; rolled back) reception read 1 billing row, 0 exports (administrators
-- only) and 1 merge, the administrator 1, 1 and 1, another practice none of them (and its own billing row), a
-- patient-app login 0. App logins lost TRUNCATE on quotes and kept INSERT. The four materialized views refused
-- reception (42501) and served the service key. Advisors afterwards: 424 findings (471 before):
-- function_search_path_mutable 175 -> 130, materialized_view_in_api 4 -> 0, the rest unchanged (the 2 new
-- authenticated_security_definer findings are set_patient_price_rate and skip_visit_recall_offers, signed-in RPCs a
-- parallel change added; both closed to the public key).
-- =============================================================================================
-- PROPOSAL: security sweep: the functions the public key could run, row security on the tables OneHealth added
--           since 7 October, and the Supabase security advisors (wave 7)
-- File:   proposals/2026-10-13-security-sweep.sql                          Drafted: 2026-10-13
--
-- Why (checked 2026-10-13 through the Supabase connector: catalog, grants, policies, API logs; no data values read)
--   1. 104 functions in schema public could be run with the public key (anon): 103 through PUBLIC (every role) and a
--      direct grant to anon, plus previsit_questionnaire. 11 belong to the other apps that share this database (sports
--      betting, the jukebox, inpatient wards: they read bet_*, bets_jukebox_* or the inpatient tables, and OneHealth's
--      code never mentions them); they are left as they are. Of OneHealth's 93, one is used without signing in:
--      previsit_questionnaire, the patient's pre-visit link (#/q/<code>, src/services/previsitService.ts). Nothing else
--      runs a function before sign-in: signing in, setting a password and the patient app's SMS code go to Supabase
--      Auth; the patient app's portal_* functions run signed in; the practice websites (hpms-landing) only read
--      practices and users; every edge function in supabase/functions uses the service key except ai-assist, which
--      forwards the signed-in user's own token and calls no function. No policy or view the public key reaches calls
--      any of these functions, and the API logs of the last 24 hours show no function call without a login. The other
--      92 included the dashboard counts per practice (get_dashboard_stats), visit state changes
--      (transition_visit_state), queue processors, clean-ups that delete rows (cleanup_expired_data) and test helpers
--      that write messages (test_messaging_*). They run with the caller's rights, so row security limited them, but
--      nobody without a login needs any of them.
--   2. The 130 tables added since 7 October all have row security on, no anon or PUBLIC rights and a read policy for
--      staff of the practice (the shared ICD-10 list and fund rules: any staff member; the fund rules' change history:
--      OneHealth support). Two gaps:
--      - patient_merges, practitioner_billing and report_exports were created after the patient app file ran, so they
--        missed its staff-only guard (portal_staff_only; their read policies already need the practice's staff).
--      - 14 tables gave every login TRUNCATE (which empties a table past row security), TRIGGER and REFERENCES. Nothing
--        in the app or the API uses them.
--   3. The security advisors (471 findings): two kinds are OneHealth's and safe to fix here:
--      - materialized_view_in_api (4): dashboard_stats_mv, patient_location_density, patient_visit_stats and
--        today_visits_view cannot have row security, and every login (any practice, and the patient app's logins)
--        could read every practice's rows; today_visits_view holds patient names, phone numbers, e-mail addresses,
--        birth dates and the reason for the visit. Nothing in the app reads them (get_patients_with_full_data reads
--        patient_visit_stats but has no caller and falls back to the tables); the service key keeps them.
--      - function_search_path_mutable on the 45 owner-rights (SECURITY DEFINER) functions without a fixed search path
--        (2025 automation, SMS, e-mail, audit and billing helpers; 39 of them are already closed to app logins): fixed
--        at "public, extensions", the path they see from the app today, so nothing they call resolves differently.
--      The others are listed at the end of this header with the reason they stay.
--
-- What it does
--   0. Checks before; remembers every function's rights and settings, every table's rights and every policy.
--   1. EXECUTE taken from PUBLIC and anon on the 92 OneHealth functions. Signed-in users and the service key keep
--      theirs (each function has its own grant to authenticated and service_role). Triggers fire without EXECUTE on
--      their function, so every trigger keeps working, also on the other apps' tables that reuse
--      update_updated_at_column; the one trigger condition that calls a function (zz_stock_invoice_status on
--      invoices_enhanced: ar_is_cancelled) is only reached by signed-in users and the service key, who keep it.
--   2. The tables: portal_staff_only on the three; TRUNCATE, TRIGGER and REFERENCES taken from signed-in users on the
--      14 (they keep SELECT, INSERT, UPDATE and DELETE under the policies).
--   3. The four materialized views closed to the public key and app logins; the search path fixed on the 45.
--   4. Checks after: the public key runs previsit_questionnaire and the other apps' 11 functions only; signed-in users
--      and the service key run exactly what they ran before; no other function, table right or policy changed
--      (the policies of the 28 practice-isolation tables and of the other apps' tables included); the 130 tables meet
--      the rule.
--
-- Left as they are (advisor findings that are not OneHealth's, or not safe to change here)
--   * anon_security_definer_function_executable (1): previsit_questionnaire, open to the public key on purpose (it
--     returns a booking's questions for a valid link code and keeps the answers once; nothing else).
--   * authenticated_security_definer_function_executable (247): OneHealth's write and read functions for signed-in
--     staff and the patient app (each checks the caller's practice and role) and the row-security helpers the policies
--     call (rls_*, portal_*, patient_note_types_i_see, get_user_practices). Signed-in users need them.
--   * function_search_path_mutable (130 after this file): functions that run with the caller's own rights (about 119
--     OneHealth's, 11 the other apps'). A different path can only reach what the caller could reach anyway, and the
--     public key and app logins cannot create objects in public or extensions. Fixing the path on the small SQL
--     helpers (ar_today, ar_is_cancelled, ...) would stop the planner inlining them into the balance views; add it
--     when each function is next edited.
--   * rls_disabled_in_public (16), rls_enabled_no_policy (19), security_definer_view (6): the other apps' tables and
--     views (bet_*, vw_jukebox_*, and the 25 tables listed in proposals/2026-10-07-close-anonymous-access.sql).
--   * auth_otp_long_expiry, auth_leaked_password_protection: Auth settings in the Supabase dashboard (the owner).
--   * vulnerable_postgres_version: a platform upgrade in a maintenance window (the owner).
--   * Not an advisor finding: Supabase's default privileges give every new function in public to anon (and PUBLIC),
--     so each new OneHealth function must revoke them itself (the wave rules say so). Changing the defaults would also
--     change the other apps' new functions: the owner's decision.
--
-- How to apply: rehearse (scripts/db/rehearsal.ts, or the part between BEGIN; and ROLLBACK; followed by tests that end
-- in RAISE EXCEPTION), then apply that part as one migration. The app needs no change.
-- Undo:
--   GRANT EXECUTE ON FUNCTION <the 92 functions of section 1> TO PUBLIC, anon;
--   DROP POLICY portal_staff_only ON public.patient_merges;  (and on practitioner_billing, report_exports)
--   GRANT TRUNCATE, REFERENCES, TRIGGER ON <the 14 tables of section 2b> TO authenticated;
--   GRANT ALL ON public.dashboard_stats_mv, public.patient_location_density, public.patient_visit_stats,
--     public.today_visits_view TO authenticated;
--   ALTER FUNCTION <each of the 45 functions of section 3b> RESET search_path;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before, and what everything looked like (to prove at the end that nothing else changed)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.previsit_questionnaire(text, jsonb)') IS NULL
     OR NOT has_function_privilege('anon', 'public.previsit_questionnaire(text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Stopped: previsit_questionnaire (the pre-visit link) must exist and be open to the public key; apply proposals/2026-10-13-previsit-questionnaire.sql first';
  END IF;
  IF to_regclass('public.patient_merges') IS NULL OR to_regclass('public.practitioner_billing') IS NULL
     OR to_regclass('public.report_exports') IS NULL OR to_regclass('public.today_visits_view') IS NULL THEN
    RAISE EXCEPTION 'Stopped: a table this file changes is missing';
  END IF;
END $$;

CREATE TEMP TABLE security_sweep_functions ON COMMIT DROP AS
SELECT p.oid, p.oid::regprocedure::text AS signature, p.proacl::text AS acl, p.proconfig::text AS config,
       p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%') AS path_open,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_ran,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_ran,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_ran
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace;

CREATE TEMP TABLE security_sweep_relations ON COMMIT DROP AS
SELECT c.oid, c.relname, c.relacl::text AS acl,
       (SELECT string_agg(a.attname || '=' || a.attacl::text, ';' ORDER BY a.attnum)
          FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL) AS column_acl
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f');

CREATE TEMP TABLE security_sweep_policies ON COMMIT DROP AS
SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public';

-- ---------------------------------------------------------------------------------------------
-- 1. The public key no longer runs OneHealth's functions (92; previsit_questionnaire stays open). Signed-in users
--    and the service key keep their own grants.
-- ---------------------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  -- Functions (47)
  public.add_template_services_to_visit(uuid, uuid, integer),
  public.ar_amount(jsonb),
  public.ar_derive_payment_status(text, date, boolean, numeric, numeric),
  public.ar_format_nad(numeric),
  public.ar_is_cancelled(text),
  public.ar_portion_label(text),
  public.ar_portion_outstanding(uuid, text),
  public.ar_receipt_method_from_text(text),
  public.ar_today(),
  public.calculate_automation_schedule(jsonb, timestamp with time zone),
  public.calculate_intelligent_schedule(jsonb, timestamp with time zone),
  public.calculate_intelligent_schedule(text, timestamp with time zone, jsonb),
  public.calculate_leave_accrual(uuid, uuid, integer),
  public.calculate_leave_days(date, date, boolean),
  public.check_gmail_connection(uuid),
  public.check_recent_sms_duplicate(uuid, text, text, interval),
  public.cleanup_expired_data(),
  public.cleanup_expired_typing_indicators(),
  public.cleanup_old_notifications(),
  public.create_new_batch(uuid, character varying, date),
  public.generate_invoice_number(uuid),
  public.get_appointment_stats(uuid, date),
  public.get_appointments_optimized(uuid, date, uuid, text, integer, integer),
  public.get_dashboard_stats(uuid),
  public.get_next_system_patient_reference_number(),
  public.get_next_system_transaction_number(),
  public.get_patient_activity_status(uuid, uuid),
  public.get_patient_visit_counts(uuid[]),
  public.get_patients_with_full_data(uuid),
  public.get_practice_automation_stats(uuid, integer),
  public.get_visit_state(public.visits),
  public.has_birthday_check_run_today(),
  public.invoice_format_number(text, integer, bigint),
  public.map_address_to_suburb(text, text),
  public.mark_birthday_check_complete(),
  public.mark_notification_processed(uuid, boolean, text),
  public.process_notification_queue(),
  public.refresh_dashboard_stats(),
  public.refresh_patient_location_density(),
  public.refresh_patient_stats(),
  public.refresh_today_visits_view(),
  public.replace_template_variables(text, jsonb),
  public.test_messaging_20_scenarios(),
  public.test_messaging_edge_cases(),
  public.test_messaging_platform(uuid, uuid),
  public.test_notification_triggers(),
  public.transition_visit_state(uuid, text),
  -- Trigger functions (45): triggers fire without EXECUTE on their function
  public.add_default_patient_activity_settings(),
  public.assign_system_patient_reference_number_trigger(),
  public.assign_system_transaction_number_trigger(),
  public.auto_assign_invoice_to_batch(),
  public.automation_settings_change_trigger(),
  public.calculate_timesheet_hours(),
  public.create_message_notification(),
  public.daily_automation_check(),
  public.generate_visit_number(),
  public.log_admin_action(),
  public.notify_automation_ready(),
  public.notify_automation_webhook(),
  public.notify_new_internal_message(),
  public.notify_queue_webhook(),
  public.opportunistic_automation_check(),
  public.opportunistic_automation_processor(),
  public.process_automation_trigger(),
  public.process_immediate_automation(),
  public.process_patient_automation_queue(),
  public.process_patient_automation_trigger(),
  public.process_patient_automation_trigger_v2(),
  public.process_queue_on_insert(),
  public.process_visit_automation_trigger(),
  public.queue_imaging_results_automation(),
  public.queue_patient_created_automation(),
  public.queue_smart_notification(),
  public.smart_automation_trigger(),
  public.trigger_appointment_automation(),
  public.trigger_follow_up_automation(),
  public.trigger_lab_results_automation(),
  public.trigger_patient_automation(),
  public.trigger_patient_created_automation(),
  public.update_batch_header_totals(),
  public.update_batch_submissions_updated_at(),
  public.update_email_subscription_usage(),
  public.update_email_templates_updated_at(),
  public.update_invoice_totals(),
  public.update_invoice_totals_safe(),
  public.update_lab_requests_updated_at(),
  public.update_leave_balance(),
  public.update_practice_social_accounts_updated_at(),
  public.update_sms_subscription_usage(),
  public.update_sms_usage(),
  public.update_thread_stats(),
  public.update_updated_at_column()
FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------------------------
-- 2. The tables OneHealth added since 7 October
-- ---------------------------------------------------------------------------------------------
-- 2a. The patient app's logins get nothing from the three tables created after the patient app file (as on every
--     OneHealth table; the same policy as proposals/2026-10-12-referrals-and-authorisations.sql section 8)
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['patient_merges', 'practitioner_billing', 'report_exports'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- 2b. Emptying a table (TRUNCATE) ignores row security: signed-in users keep SELECT, INSERT, UPDATE and DELETE (under
--     the policies) and lose TRUNCATE, TRIGGER and REFERENCES, which neither the app nor the API uses
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.billing_code_bundle_lines, public.billing_code_bundles, public.diary_blocks, public.fund_tariff_contracts,
  public.fund_tariffs, public.patient_allergies, public.patient_allergy_overrides, public.patient_clinical_profiles,
  public.patient_letters, public.patient_list_members, public.patient_lists, public.patient_problems,
  public.quote_lines, public.quotes
FROM authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The security advisors
-- ---------------------------------------------------------------------------------------------
-- 3a. Materialized views cannot have row security: closed to the public key and app logins (the service key keeps them)
REVOKE ALL ON public.dashboard_stats_mv, public.patient_location_density, public.patient_visit_stats,
  public.today_visits_view FROM PUBLIC, anon, authenticated;

-- 3b. Owner-rights functions get a fixed search path: the one they see from the app today
ALTER FUNCTION public.auto_fix_medical_aid_service_values() SET search_path = public, extensions;
ALTER FUNCTION public.batch_parent_invoice() SET search_path = public, extensions;
ALTER FUNCTION public.check_and_queue_todays_birthdays() SET search_path = public, extensions;
ALTER FUNCTION public.cleanup_expired_oauth_tokens() SET search_path = public, extensions;
ALTER FUNCTION public.cleanup_stuck_automations() SET search_path = public, extensions;
ALTER FUNCTION public.complete_automation(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.create_batch_submission(uuid, text, text, text, text, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.ensure_automations_processed() SET search_path = public, extensions;
ALTER FUNCTION public.exec_raw_sql(text) SET search_path = public, extensions;
ALTER FUNCTION public.execute_dynamic_search(text, text[]) SET search_path = public, extensions;
ALTER FUNCTION public.execute_patient_search(text, text[]) SET search_path = public, extensions;
ALTER FUNCTION public.execute_raw_sql(text) SET search_path = public, extensions;
ALTER FUNCTION public.fail_automation(uuid, text, boolean) SET search_path = public, extensions;
ALTER FUNCTION public.get_all_pending_automations(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_all_pending_automations_simple(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_automation_statistics(uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_dashboard_data_bundle(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_medical_aid_providers() SET search_path = public, extensions;
ALTER FUNCTION public.get_pending_automations_by_type(character varying, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_pending_automations_json() SET search_path = public, extensions;
ALTER FUNCTION public.get_pending_automations_readonly(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_visit_with_details(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.handle_gmail_oauth_callback(uuid, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.handle_invoice_service_change() SET search_path = public, extensions;
ALTER FUNCTION public.increment_email_usage(uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.is_channel_member(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.log_admin_action(character varying, character varying, uuid, uuid, jsonb, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.log_audit_trail() SET search_path = public, extensions;
ALTER FUNCTION public.mark_automation_processing(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.mark_notification_read(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.process_all_pending_automations() SET search_path = public, extensions;
ALTER FUNCTION public.process_automation_immediately() SET search_path = public, extensions;
ALTER FUNCTION public.process_automations_scheduled() SET search_path = public, extensions;
ALTER FUNCTION public.process_due_automations() SET search_path = public, extensions;
ALTER FUNCTION public.process_follow_up_automation(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.process_pending_sms() SET search_path = public, extensions;
ALTER FUNCTION public.queue_automation_intelligently(text, jsonb, timestamp with time zone) SET search_path = public, extensions;
ALTER FUNCTION public.reset_stuck_automations() SET search_path = public, extensions;
ALTER FUNCTION public.run_follow_up_automation() SET search_path = public, extensions;
ALTER FUNCTION public.send_happy_joy_email_now() SET search_path = public, extensions;
ALTER FUNCTION public.send_pending_email_for_happy_joy() SET search_path = public, extensions;
ALTER FUNCTION public.send_pending_sms(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.trigger_automation_processing() SET search_path = public, extensions;
ALTER FUNCTION public.trigger_automations() SET search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  -- What the public key may still run: the pre-visit link, and the other apps' functions (not OneHealth's to change;
  -- one the other app has dropped is simply left out)
  v_open_to_anon constant oid[] := array_remove(ARRAY[
    to_regprocedure('public.previsit_questionnaire(text, jsonb)'),
    to_regprocedure('public.calculate_cashout_value(uuid)'), to_regprocedure('public.calculate_track_price(uuid)'),
    to_regprocedure('public.generate_slip_code()'), to_regprocedure('public.get_next_track_in_queue()'),
    to_regprocedure('public.calculate_team_points()'), to_regprocedure('public.update_team_strength()'),
    to_regprocedure('public.update_track_popularity()'), to_regprocedure('public.update_bets_jukebox_updated_at()'),
    to_regprocedure('public.generate_admission_number()'), to_regprocedure('public.set_admission_number()'),
    to_regprocedure('public.update_ward_occupancy()')]::oid[], NULL);
  -- The tables OneHealth added since 7 October (proposals/2026-10-0*-*.sql and 2026-10-1*-*.sql)
  v_new_tables constant text[] := ARRAY[
    'account_flags', 'account_holder_links', 'ar_audit_events', 'ar_document_counters', 'automation_processor_heartbeat',
    'bank_deposit_items', 'bank_deposits', 'billing_code_bundle_lines', 'billing_code_bundles', 'billing_package_types',
    'billing_promotions', 'cash_ups', 'claim_rejection_events', 'claim_rejections', 'claim_reversals',
    'credit_control_notes', 'credit_note_lines', 'daybook_entries', 'daybook_prints', 'dc_counters', 'debtor_settings',
    'dental_chart_changes', 'dental_chart_entries', 'dental_lab_order_events', 'dental_lab_orders',
    'dental_lab_slip_lines', 'diary_appointment_types', 'diary_blocks', 'diary_reminder_log', 'diary_settings',
    'diary_statuses', 'diary_waiting_list', 'fund_move_patients', 'fund_moves', 'fund_payment_drafts',
    'fund_tariff_contracts', 'fund_tariffs', 'icd10_codes', 'interest_run_lines', 'interest_runs',
    'invoice_adjustments', 'invoice_audit_events', 'invoice_number_series', 'legacy_claim_lines',
    'legacy_import_records', 'legacy_import_rows', 'legacy_import_runs', 'letter_templates',
    'medical_aid_fund_rule_changes', 'medical_aid_fund_rules', 'optometry_cl_supplies', 'optometry_consignment_lines',
    'optometry_exams', 'optometry_frame_counters', 'optometry_frame_unit_events', 'optometry_frame_units',
    'optometry_frames', 'optometry_fund_notes', 'optometry_lab_order_events', 'optometry_lab_orders',
    'optometry_prescriptions', 'patient_accounts', 'patient_allergies', 'patient_allergy_overrides',
    'patient_authorisations', 'patient_clinical_profiles', 'patient_consents', 'patient_injury_cases',
    'patient_letters', 'patient_list_members', 'patient_lists', 'patient_merges', 'patient_note_addenda',
    'patient_notes', 'patient_packages', 'patient_portal_link_attempts', 'patient_portal_otp_sends',
    'patient_portal_requests', 'patient_private_notes', 'patient_problems', 'patient_recalls', 'patient_referrals',
    'payer_account_members', 'payer_account_receipts', 'payer_accounts', 'payment_plan_instalments', 'payment_plans',
    'payment_promises', 'period_closes', 'practice_fund_notes', 'practice_own_tariffs', 'practice_sms_replies',
    'practice_tariff_rules', 'practitioner_billing', 'previsit_answers', 'previsit_links', 'previsit_questionnaires',
    'quote_lines', 'quote_number_counters', 'quotes', 'receipt_allocation_lines', 'receipt_allocations', 'receipts',
    'record_access_log', 'remittance_documents', 'remittance_lines', 'report_exports', 'report_queries',
    'statement_criteria', 'statement_runs', 'stock_count_lines', 'stock_counters', 'stock_counts', 'stock_deliveries',
    'stock_dispensings', 'stock_locations', 'stock_movements', 'stock_orders', 'stock_pricing_rules',
    'stock_reference_prices', 'stock_settings', 'stock_supplier_allocations', 'stock_supplier_payments',
    'stock_suppliers', 'stock_transfers', 'stock_valuations', 'tariff_icd10_defaults', 'visit_claim_details',
    'visit_payer_changes', 'visit_payers'];
  -- The patient app's own tables have their own policies (proposals/2026-10-07-patient-portal.sql section 4)
  v_portal_tables constant text[] := ARRAY['patient_accounts', 'patient_portal_link_attempts', 'patient_portal_otp_sends', 'patient_portal_requests'];
  -- Changed by this file
  v_closed_tables constant text[] := ARRAY['billing_code_bundle_lines', 'billing_code_bundles', 'diary_blocks',
    'fund_tariff_contracts', 'fund_tariffs', 'patient_allergies', 'patient_allergy_overrides', 'patient_clinical_profiles',
    'patient_letters', 'patient_list_members', 'patient_lists', 'patient_problems', 'quote_lines', 'quotes'];
  v_views constant text[] := ARRAY['dashboard_stats_mv', 'patient_location_density', 'patient_visit_stats', 'today_visits_view'];
  v_guarded constant text[] := ARRAY['patient_merges', 'practitioner_billing', 'report_exports'];
  v_list text;
  v_table text;
  v_oid oid;
BEGIN
  -- The public key runs the pre-visit link and the other apps' functions only
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY 1) INTO v_list
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
     AND p.oid <> ALL (v_open_to_anon);
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the public key (or PUBLIC) can still run %', v_list;
  END IF;
  IF NOT has_function_privilege('anon', 'public.previsit_questionnaire(text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the pre-visit link no longer opens without signing in';
  END IF;
  -- Signed-in users and the service key run exactly what they ran before; nothing but the 92 lost a grant
  SELECT string_agg(f.signature, ', ') INTO v_list
    FROM security_sweep_functions f
   WHERE f.signed_in_ran IS DISTINCT FROM has_function_privilege('authenticated', f.oid, 'EXECUTE')
      OR f.service_ran IS DISTINCT FROM has_function_privilege('service_role', f.oid, 'EXECUTE');
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: signed-in users or the service key lost or gained %', v_list;
  END IF;
  SELECT string_agg(f.signature, ', ') INTO v_list
    FROM security_sweep_functions f JOIN pg_proc p ON p.oid = f.oid
   WHERE f.acl IS DISTINCT FROM p.proacl::text AND (NOT f.anon_ran OR f.oid = ANY (v_open_to_anon));
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the rights of a function outside this file changed: %', v_list;
  END IF;
  -- The search path: fixed on the 45, every other function's settings as they were
  SELECT string_agg(f.signature, ', ') INTO v_list
    FROM security_sweep_functions f JOIN pg_proc p ON p.oid = f.oid
   WHERE (f.path_open AND NOT COALESCE(p.proconfig @> ARRAY['search_path=public, extensions'], false))
      OR (NOT f.path_open AND f.config IS DISTINCT FROM p.proconfig::text);
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: a search path is open or a function setting outside this file changed: %', v_list;
  END IF;
  IF (SELECT count(*) FROM security_sweep_functions WHERE path_open) <> 45 THEN
    RAISE EXCEPTION 'Check failed: expected 45 owner-rights functions without a search path, found %',
      (SELECT count(*) FROM security_sweep_functions WHERE path_open);
  END IF;

  -- No policy changed but the staff-only guard on the three tables (the 28 practice-isolation tables and the other
  -- apps' tables included)
  IF EXISTS (
    (SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM security_sweep_policies
      WHERE NOT (tablename = ANY (v_guarded) AND policyname = 'portal_staff_only')
     EXCEPT
     SELECT tablename, policyname, permissive, roles::text, cmd, qual, with_check FROM pg_policies
      WHERE schemaname = 'public')
    UNION ALL
    (SELECT tablename, policyname, permissive, roles::text, cmd, qual, with_check FROM pg_policies
      WHERE schemaname = 'public' AND NOT (tablename = ANY (v_guarded) AND policyname = 'portal_staff_only')
     EXCEPT
     SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM security_sweep_policies)) THEN
    RAISE EXCEPTION 'Check failed: a policy outside the three staff-only guards changed';
  END IF;
  -- No table or view right changed but the 14 tables and the 4 materialized views
  SELECT string_agg(r.relname, ', ') INTO v_list
    FROM security_sweep_relations r JOIN pg_class c ON c.oid = r.oid
   WHERE NOT (r.relname = ANY (v_closed_tables || v_views))
     AND (r.acl IS DISTINCT FROM c.relacl::text
          OR r.column_acl IS DISTINCT FROM (SELECT string_agg(a.attname || '=' || a.attacl::text, ';' ORDER BY a.attnum)
                                              FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL));
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the rights on % changed', v_list;
  END IF;

  -- The materialized views: the service key only
  FOREACH v_table IN ARRAY v_views LOOP
    IF has_table_privilege('anon', 'public.' || v_table, 'SELECT') OR has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || v_table, 'SELECT') THEN
      RAISE EXCEPTION 'Check failed: % must be read by the service key only', v_table;
    END IF;
  END LOOP;

  -- Every table OneHealth added since 7 October: row security on, nothing for the public key or PUBLIC, no TRUNCATE,
  -- TRIGGER or REFERENCES for app logins, a read policy for the practice's staff, and the staff-only guard
  FOREACH v_table IN ARRAY v_new_tables LOOP
    v_oid := to_regclass('public.' || v_table);
    CONTINUE WHEN v_oid IS NULL;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_oid) THEN
      RAISE EXCEPTION 'Check failed: % has row security off', v_table;
    END IF;
    IF has_table_privilege('anon', v_oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('anon', v_oid, 'SELECT,INSERT,UPDATE,REFERENCES')
       OR EXISTS (SELECT 1 FROM pg_class c, aclexplode(c.relacl) a WHERE c.oid = v_oid AND a.grantee = 0) THEN
      RAISE EXCEPTION 'Check failed: the public key or PUBLIC has a right on %', v_table;
    END IF;
    IF has_table_privilege('authenticated', v_oid, 'TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Check failed: app logins can still empty % past row security', v_table;
    END IF;
    IF has_table_privilege('authenticated', v_oid, 'SELECT') AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname = 'public' AND p.tablename = v_table AND p.permissive = 'PERMISSIVE' AND p.cmd IN ('SELECT', 'ALL')
         AND p.roles && ARRAY['authenticated', 'public']::name[]) THEN
      RAISE EXCEPTION 'Check failed: % has no read policy', v_table;
    END IF;
    -- Open to every staff member only where every practice shares the list (ICD-10 codes, the fund rules)
    IF EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname = 'public' AND p.tablename = v_table AND p.permissive = 'PERMISSIVE' AND p.cmd IN ('SELECT', 'ALL')
         AND btrim(COALESCE(p.qual, 'true')) = 'true' AND v_table NOT IN ('icd10_codes', 'medical_aid_fund_rules')) THEN
      RAISE EXCEPTION 'Check failed: % has a read policy open to every login', v_table;
    END IF;
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL AND NOT (v_table = ANY (v_portal_tables)) AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname = 'public' AND p.tablename = v_table AND p.policyname = 'portal_staff_only' AND p.permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION 'Check failed: % has no staff-only guard', v_table;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

ROLLBACK;
