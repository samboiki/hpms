-- Applied 2026-10-13 as migration scheduler_2026_10_13 (version 20261013200937; stored statement md5 9b331d74dd28ce14b73be6297d0f51fc = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: the scheduler (pg_cron + pg_net) for appointment reminders, automations and patient lists
-- File:   proposals/2026-10-13-scheduler.sql                         Drafted: 2026-10-13 (agent dbops)
--
-- Why (owner decision, 13 Oct 2026): "Scheduler: YES - pg_cron + pg_net every 15 min, deploy
-- send-appointment-reminders + process-automation-queue; practice sends start switched off; remove dead 'Process
-- Queue' button". Nothing in the database runs on a schedule today (pg_cron and pg_net are not installed), so
-- reminders, the welcome / booking-confirmation automations and the patient lists' "Send automatically" never ran.
--
-- What it does
--   1. Switches on the pg_cron and pg_net extensions.
--   2. Stores the project's address in Vault as 'project_url' (not a secret; the job reads it at run time).
--   3. Practices' automatic sends start switched OFF: the welcome / booking-confirmation switches that were on
--      (practice_automation_settings.enabled) are switched off, so nothing goes out the moment the scheduler starts;
--      each practice's administrator switches them on again in Communications > Automations when ready. Appointment
--      reminders (diary_settings.reminders_enabled) and lists' "Send automatically" (patient_lists.automation_enabled)
--      were all off already and are not touched.
--   4. public.scheduler_start(): schedules, every 15 minutes, the calls to
--        process-automation-queue    (job 'process-automation-queue')
--        send-appointment-reminders  (job 'diary-appointment-reminders', the name proposals/2026-10-07-diary-2.sql uses)
--        patient-list-automations    (job 'patient-list-automations', only once its own secret is in Vault)
--      Each job reads the service role key from Vault when it runs (secret 'service_role_key'), so no key is ever
--      written into a job's SQL text. Without that secret it schedules nothing and says what is missing.
--      public.scheduler_stop() removes the three jobs. Both are for the owner in the SQL editor only (no grant to
--      anon or signed-in users).
--
-- OWNER STEPS (the service role key is not available to Claude; type it in the SQL editor, never in chat):
--   a. select vault.create_secret('<service role key: Settings > API keys>', 'service_role_key');
--      The functions accept exactly the key Supabase gives them as SUPABASE_SERVICE_ROLE_KEY (the legacy
--      service_role JWT while legacy keys are enabled).
--   b. For patient lists: supabase secrets set PATIENT_LISTS_CRON_SECRET=<long random value>, then
--      select vault.create_secret('<the same value>', 'patient_lists_cron_secret');
--      (patient-list-automations stays in dry run until PATIENT_LISTS_DRY_RUN=false is set.)
--   c. select public.scheduler_start();   -- says which jobs it scheduled
--      Check: select jobname, schedule, active from cron.job;
--      Stop everything: select public.scheduler_stop();
--
-- How to apply: rehearse (extensions on, switches off, scheduler_start without the key schedules nothing, with an
--   invented key in Vault inside the rolled-back transaction it schedules the jobs; anon and staff cannot call
--   either function), then apply the part between BEGIN; and ROLLBACK; (scheduler_2026_10_13).
-- Undo: select public.scheduler_stop(); DROP FUNCTION public.scheduler_start(), public.scheduler_stop();
--   (the switched-off automations are switched on again by each practice; the extensions can stay.)
-- =============================================================================================

BEGIN;

-- 1. The extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Where the functions live (read by the jobs at run time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('https://jjxlfunlbyayxwvlpgwt.supabase.co', 'project_url',
                                'OneHealth: the project address the scheduler calls (not a secret)');
  END IF;
END $$;

-- 3. Practices' automatic sends start switched off (owner, 13 Oct 2026)
UPDATE public.practice_automation_settings SET enabled = false WHERE enabled IS TRUE;

-- 4. Starting and stopping the schedule
CREATE OR REPLACE FUNCTION public.scheduler_start()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $fn$
DECLARE
  v_done text[] := '{}';
  v_job record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    RETURN 'Nothing scheduled: store the service role key in Vault first: select vault.create_secret(''<key>'', ''service_role_key'');';
  END IF;

  FOR v_job IN
    SELECT * FROM (VALUES
      ('process-automation-queue', 'process-automation-queue', false),
      ('diary-appointment-reminders', 'send-appointment-reminders', false),
      ('patient-list-automations', 'patient-list-automations', true)
    ) AS j(job_name, slug, needs_list_secret)
  LOOP
    IF v_job.needs_list_secret AND NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'patient_lists_cron_secret') THEN
      CONTINUE;
    END IF;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = v_job.job_name;
    PERFORM cron.schedule(v_job.job_name, '*/15 * * * *', format($cmd$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/%s',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
          'x-cron-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'patient_lists_cron_secret'), '')
        ),
        body := jsonb_build_object('source', 'pg_cron'),
        timeout_milliseconds := 60000
      );
    $cmd$, v_job.slug));
    v_done := v_done || v_job.job_name;
  END LOOP;
  RETURN 'Scheduled every 15 minutes: ' || array_to_string(v_done, ', ')
    || CASE WHEN NOT ('patient-list-automations' = ANY (v_done))
            THEN '. Not patient-list-automations: store patient_lists_cron_secret in Vault (and PATIENT_LISTS_CRON_SECRET on the function) first.'
            ELSE '' END;
END $fn$;
COMMENT ON FUNCTION public.scheduler_start() IS
  'Owner only (SQL editor): schedules the reminder, automation and patient-list runs every 15 minutes. Keys are read from Vault when each job runs.';

CREATE OR REPLACE FUNCTION public.scheduler_stop()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $fn$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM cron.job
   WHERE jobname IN ('process-automation-queue', 'diary-appointment-reminders', 'patient-list-automations');
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('process-automation-queue', 'diary-appointment-reminders', 'patient-list-automations');
  RETURN v_count;
END $fn$;
COMMENT ON FUNCTION public.scheduler_stop() IS 'Owner only (SQL editor): removes the three scheduled runs.';

REVOKE ALL ON FUNCTION public.scheduler_start(), public.scheduler_stop() FROM PUBLIC, anon, authenticated;

-- 5. Checks after
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Check failed: pg_cron or pg_net is not on';
  END IF;
  IF has_function_privilege('anon', 'public.scheduler_start()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.scheduler_start()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.scheduler_stop()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the app could start or stop the scheduler';
  END IF;
  IF EXISTS (SELECT 1 FROM public.practice_automation_settings WHERE enabled IS TRUE)
     OR EXISTS (SELECT 1 FROM public.diary_settings WHERE reminders_enabled IS TRUE)
     OR EXISTS (SELECT 1 FROM public.patient_lists WHERE automation_enabled IS TRUE) THEN
    RAISE EXCEPTION 'Check failed: a practice''s automatic sends are still switched on';
  END IF;
END $$;

ROLLBACK;
