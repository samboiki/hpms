-- Applied 2026-10-08 as migration automations_2026_10_08
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: automations that really send, through one engine, and say when they do not
-- File:   proposals/2026-10-08-automations.sql                           Drafted: 2026-10-08
-- Code:   supabase/functions/process-automation-queue (index.ts, automationRun.ts, automationRules.ts),
--         src/components/messages/SmartAutomations.tsx, src/utils/automations, src/services/automations
--
-- Requires: 2026-10-07-practice-isolation.sql (the automation_queue policies, which this file does not
-- change). Reads patients.sms_opt_out (2026-10-07-two-way-sms.sql) and patients.legacy_account_number
-- (2026-10-07-eminance-import.sql) through to_jsonb(), so it also runs without them.
-- Runs inside a transaction that ends in ROLLBACK.
--
-- Why (found 2026-10-08 on the live database, counts only):
--   - Communications > Automations showed about 20 cards that looked switched on but only saved rows in
--     practice_automation_settings; the card switch wrote columns that table does not have (it always
--     failed) and 8 cards could not even be saved (their ids are not in automation_definitions).
--   - Two triggers on patients each queued a welcome for every new patient: two messages per patient once
--     anything sent them (the 2026-10-06 demo seed made 840 items for 420 patients; the seed closed them).
--   - The queue was "processed" inside the save of a patient or booking (process_queue_on_insert_trigger ->
--     process_automation_queue_serverside): it read a column that does not exist (a.channels: 19 items
--     failed) and left items it could not handle in 'processing' for good.
--   - 5-10% of patient and visit saves ran a random processor (opportunistic_* triggers), and every
--     patient save scanned the birthdays of every practice.
--   - visits still queued appointment reminders (appointment.scheduled) for a practice whose old reminder
--     switch was on, although the diary sends reminders now: a second reminder once anything sent them.
--   - smart_automation_trigger (on automation_executions) calls trigger_automation_engine(), which does
--     not exist: any due insert there fails.
--   - The edge function wrote processed_at and retry_count, which automation_queue does not have, so every
--     item it took stayed 'processing' (and it logged phone numbers).
--   - 25 SECURITY DEFINER automation functions could be called without signing in: some return queued
--     patients' names, numbers and emails, some change any practice's queue, and two
--     (send_happy_joy_welcome, process_sms_queue) mark messages "sent" without sending anything.
--   - pg_cron and pg_net are not installed: nothing in the database can run on a schedule.
--
-- The one engine after this file:
--   patients / visits trigger (only while the practice has the automation switched on)
--     -> automation_queue (status queued; payload holds the automation and ids only, no copies of names)
--     -> process-automation-queue (the scheduler calls it with the service role key):
--        automation_queue_claim() -> centralized-sms-gateway / centralized-email-gateway (log, bundle,
--        STOP) -> automation_queue_finish()
--   Wired: welcome-new-patient and appointment-confirmation (automation_wired_ids(); a unit test compares
--   it with the app). Every other card says where its job is done (the diary's reminders, Lists,
--   Remittances, Batches, Payroll) or that it is not offered yet.
--
-- How to apply
--   1. Review; rehearse (scripts/db/rehearsal.ts runs it in one rolled-back transaction) or run it on a
--      branch with the final ROLLBACK changed to COMMIT.
--   2. Apply to production the same way, then deploy supabase/functions/process-automation-queue.
--   3. Start the scheduler (the owner decides who runs it; section 8 shows pg_cron + pg_net). Until it
--      runs, a practice that switched an automation on reads "Automations are switched on but not running
--      yet: OneHealth support must start the scheduler". Nothing is sent before then.
--   Before step 1 the screen says "Automatic messages are not set up yet" and nothing can be switched on.
--
-- Data: no row is deleted. 2 practices have had the welcome switched on since July 2025: once the
-- scheduler runs, their new patients get it. 1 practice had the old birthday switch on: birthdays are
-- done in Lists now. Items the old triggers queued (with copies of names and numbers) are closed, not sent.
--
-- Contents
--   0. Checks before
--   1. One switch: practice_automation_settings.enabled
--   2. Queueing: one trigger per automation, only while switched on
--   3. No processing inside other people's saves (old triggers dropped)
--   4. The sender's functions (service role only): heartbeat, automation_queue_claim, _finish
--   5. Staff: automation_status (staff of the practice), save_automation_setting (administrators)
--   6. The old processors retired and closed to the public
--   7. Checks after
--   8. (Commented out) the schedule
--   Undo at the end.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.automation_queue') IS NULL OR to_regclass('public.practice_automation_settings') IS NULL THEN
    RAISE EXCEPTION 'automation_queue and practice_automation_settings must exist first';
  END IF;
  IF (SELECT count(*) FROM public.automation_definitions WHERE id IN ('welcome-new-patient', 'appointment-confirmation')) <> 2 THEN
    RAISE EXCEPTION 'automation_definitions must hold welcome-new-patient and appointment-confirmation (practice_automation_settings refers to them)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. One switch. The older screen wrote `enabled` from its wizard and `is_active` from the card
--    (which failed), and the old triggers read enabled, is_active or is_enabled: now only `enabled`.
-- ---------------------------------------------------------------------------------------------
COMMENT ON COLUMN public.practice_automation_settings.enabled IS
  'The switch: while true, the trigger queues this automation for the practice. Saved by save_automation_setting().';
COMMENT ON COLUMN public.practice_automation_settings.is_active IS 'Not read since 2026-10-08: enabled is the switch.';
COMMENT ON COLUMN public.practice_automation_settings.is_enabled IS 'Not read since 2026-10-08: enabled is the switch.';

-- Writes go through save_automation_setting() (practice administrators), like the diary settings.
-- Staff still read their practice's rows ("Practice users can view their automation settings").
DROP POLICY IF EXISTS "Practice users can insert their automation settings" ON public.practice_automation_settings;
DROP POLICY IF EXISTS "Practice users can update their automation settings" ON public.practice_automation_settings;

-- ---------------------------------------------------------------------------------------------
-- 2. Queueing
-- ---------------------------------------------------------------------------------------------

-- The automations the sender handles (the app's WIRED_AUTOMATION_IDS)
CREATE OR REPLACE FUNCTION public.automation_wired_ids()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['welcome-new-patient', 'appointment-confirmation']::text[]
$$;
COMMENT ON FUNCTION public.automation_wired_ids() IS
  'Automations process-automation-queue sends. Same list as WIRED_AUTOMATION_IDS in supabase/functions/process-automation-queue/automationRules.ts.';

-- An id from a queue payload, or null when it is not one (so a damaged item can never stop the sender)
CREATE OR REPLACE FUNCTION public.automation_payload_uuid(p_value text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_value::uuid END
$$;

REVOKE ALL ON FUNCTION public.automation_wired_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_payload_uuid(text) FROM PUBLIC, anon, authenticated;

-- 2a. The welcome: one item per new patient file, only while the practice has it switched on
CREATE OR REPLACE FUNCTION public.queue_welcome_patient_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Patients moved over from Eminance are not new to the practice
  IF NULLIF(btrim(COALESCE(to_jsonb(NEW) ->> 'legacy_account_number', '')), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Nothing to send to
  IF NULLIF(btrim(COALESCE(NEW.cell_number, '')), '') IS NULL AND NULLIF(btrim(COALESCE(NEW.email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM practice_automation_settings s
     WHERE s.practice_id = NEW.practice_id AND s.automation_id = 'welcome-new-patient' AND s.enabled IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO automation_queue (practice_id, trigger_type, payload, scheduled_for, status, test_mode)
  VALUES (NEW.practice_id, 'patient.created',
          jsonb_build_object('automation_id', 'welcome-new-patient', 'patient_id', NEW.id),
          now(), 'queued', false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- The patient file is the work; the welcome is a courtesy
  RAISE WARNING 'queue_welcome_patient_automation: no welcome queued for patient % (%)', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
-- (trigger_queue_welcome_patient, AFTER INSERT ON patients, keeps calling it)

-- 2b. The booking confirmation: a booking made confirmed and still ahead. Reminders are the diary's job
--     (diary_settings, send-appointment-reminders), so nothing is queued for them here any more.
CREATE OR REPLACE FUNCTION public.queue_appointment_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_starts timestamptz;
BEGIN
  -- Not for website requests reception has not confirmed, cancelled bookings or walk-ins already in
  IF TG_OP <> 'INSERT' OR NEW.patient_id IS NULL OR NEW.practice_id IS NULL
     OR COALESCE(NEW.status, '') <> 'scheduled' OR NEW.is_confirmed IS NOT TRUE
     OR COALESCE(NEW.is_cancelled, false) OR COALESCE(NEW.is_checked_in, false) THEN
    RETURN NEW;
  END IF;
  -- Not for a booking in the past (history typed in later); visit dates and times are Windhoek time
  v_starts := (COALESCE(NEW.scheduled_date, NEW.visit_date)
               + COALESCE(NEW.scheduled_time, NEW.visit_time, time '23:59')) AT TIME ZONE 'Africa/Windhoek';
  IF v_starts IS NULL OR v_starts <= now() THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM practice_automation_settings s
     WHERE s.practice_id = NEW.practice_id AND s.automation_id = 'appointment-confirmation' AND s.enabled IS TRUE
  ) THEN
    RETURN NEW;
  END IF;
  -- Nothing to send to
  IF NOT EXISTS (
    SELECT 1 FROM patients p
     WHERE p.id = NEW.patient_id
       AND (NULLIF(btrim(COALESCE(p.cell_number, '')), '') IS NOT NULL OR NULLIF(btrim(COALESCE(p.email, '')), '') IS NOT NULL)
  ) THEN
    RETURN NEW;
  END IF;
  -- A repeat booking (several dates saved at once) gets one confirmation: one still waiting for the same
  -- patient, for a booking that is not cancelled, covers it
  IF EXISTS (
    SELECT 1 FROM automation_queue q
      JOIN visits v ON v.id = automation_payload_uuid(q.payload ->> 'visit_id')
     WHERE q.practice_id = NEW.practice_id AND q.status = 'queued'
       AND q.payload ->> 'automation_id' = 'appointment-confirmation'
       AND q.payload ->> 'patient_id' = NEW.patient_id::text
       AND q.created_at > now() - interval '10 minutes'
       AND NOT COALESCE(v.is_cancelled, false) AND COALESCE(v.status, '') <> 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO automation_queue (practice_id, trigger_type, payload, scheduled_for, status, test_mode)
  VALUES (NEW.practice_id, 'appointment.created',
          jsonb_build_object('automation_id', 'appointment-confirmation', 'patient_id', NEW.patient_id, 'visit_id', NEW.id),
          now(), 'queued', false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- The booking is the work; the confirmation is a courtesy
  RAISE WARNING 'queue_appointment_automation: no confirmation queued for visit % (%)', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
-- (appointment_created_automation_trigger, AFTER INSERT ON visits, keeps calling it)

REVOKE ALL ON FUNCTION public.queue_welcome_patient_automation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_appointment_automation() FROM PUBLIC, anon, authenticated;

-- Items the old triggers queued hold copies of names, numbers and emails, and some are the second
-- welcome for the same patient: they are closed, not sent (none were waiting on 2026-10-08)
UPDATE public.automation_queue
   SET status = 'failed', completed_at = now(), updated_at = now(),
       error_message = 'Not sent: queued by the old automation triggers (replaced 2026-10-08)'
 WHERE status IN ('queued', 'retrying', 'processing')
   AND worker_id IS NULL
   AND payload ->> 'automation_id' = ANY (public.automation_wired_ids())
   AND (payload ? 'patientName' OR payload ? 'patient_name' OR payload ? 'patientPhone');

-- ---------------------------------------------------------------------------------------------
-- 3. No processing inside other people's saves. Each trigger below either queued a second copy, ran a
--    processor in the transaction of whoever saved a patient, booking, invoice or lab request, or did
--    nothing at all.
-- ---------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS patient_created_automation_trigger ON public.patients;       -- the second welcome
DROP TRIGGER IF EXISTS daily_check_on_patient_activity ON public.patients;          -- every practice's birthdays on each save
DROP TRIGGER IF EXISTS process_automations_on_patient_activity ON public.patients;  -- a random processor
DROP TRIGGER IF EXISTS appointment_updated_automation_trigger ON public.visits;     -- reminders: the diary's job
DROP TRIGGER IF EXISTS appointment_automation_trigger ON public.visits;             -- did nothing
DROP TRIGGER IF EXISTS opportunistic_check_on_visits ON public.visits;              -- a random count
DROP TRIGGER IF EXISTS process_automations_on_visit_activity ON public.visits;      -- a random processor
DROP TRIGGER IF EXISTS automation_trigger_visits_insert ON public.visits;           -- the old executions engine
DROP TRIGGER IF EXISTS automation_trigger_visits_update ON public.visits;           --   (dormant, and would fail
DROP TRIGGER IF EXISTS automation_trigger_invoices_insert ON public.invoices_enhanced; -- the save once a rule
DROP TRIGGER IF EXISTS automation_trigger_invoices_update ON public.invoices_enhanced; -- matched: its timings
DROP TRIGGER IF EXISTS automation_trigger_lab_requests_update ON public.lab_requests;  -- are not an array)
DROP TRIGGER IF EXISTS process_queue_on_insert_trigger ON public.automation_queue;  -- processed in the saver's transaction
DROP TRIGGER IF EXISTS trigger_automation_engine_on_insert ON public.automation_executions; -- trigger_automation_engine() does not exist

-- ---------------------------------------------------------------------------------------------
-- 4. The sender's functions. Only the service role (process-automation-queue) may call them.
-- ---------------------------------------------------------------------------------------------

-- When the sender last ran (one row): the Automations screen's proof that the scheduler is on
CREATE TABLE IF NOT EXISTS public.automation_processor_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_claimed integer NOT NULL DEFAULT 0,
  last_released integer NOT NULL DEFAULT 0,
  last_closed integer NOT NULL DEFAULT 0
);
ALTER TABLE public.automation_processor_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_processor_heartbeat FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.automation_processor_heartbeat IS
  'When process-automation-queue last ran (one row, written by automation_queue_claim). Staff see it through automation_status().';

-- 4a. Claim the due items. Also, every run:
--     - an item left in 'processing' for 15 minutes (the run stopped) never stays there: a message the
--       gateway logged for it counts as sent (never twice); otherwise it is queued again while tries
--       remain (max_attempts, 3), else it fails;
--     - waiting items whose automation the practice switched off are closed, not sent;
--     - the run is recorded (the heartbeat), also at night when nothing is claimed (p_limit 0).
CREATE OR REPLACE FUNCTION public.automation_queue_claim(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_worker constant text := 'process-automation-queue';
  v_released integer := 0;
  v_closed integer := 0;
  v_claimed uuid[] := '{}';
BEGIN
  WITH stuck AS (
    SELECT q.id,
           COALESCE(q.attempt_count, 0) AS attempts,
           COALESCE(q.max_attempts, 3) AS max_attempts,
           (EXISTS (SELECT 1 FROM practice_sms_logs l
                     WHERE l.practice_id = q.practice_id AND l.metadata ->> 'queue_id' = q.id::text AND l.status IS DISTINCT FROM 'failed')
            OR EXISTS (SELECT 1 FROM practice_email_logs l
                        WHERE l.practice_id = q.practice_id AND l.metadata ->> 'queue_id' = q.id::text AND l.status IS DISTINCT FROM 'failed')) AS went,
           (EXISTS (SELECT 1 FROM practice_sms_logs l WHERE l.practice_id = q.practice_id AND l.metadata ->> 'queue_id' = q.id::text)
            OR EXISTS (SELECT 1 FROM practice_email_logs l WHERE l.practice_id = q.practice_id AND l.metadata ->> 'queue_id' = q.id::text)) AS logged
      FROM automation_queue q
     WHERE q.status = 'processing'
       AND COALESCE(q.picked_at, q.updated_at, q.created_at) < now() - interval '15 minutes'
     FOR UPDATE OF q SKIP LOCKED
  )
  UPDATE automation_queue q
     SET status = CASE WHEN s.went THEN 'completed'
                       WHEN s.logged OR s.attempts >= s.max_attempts THEN 'failed'
                       ELSE 'queued' END,
         completed_at = CASE WHEN s.went OR s.logged OR s.attempts >= s.max_attempts THEN now() END,
         error_message = CASE
           WHEN s.went THEN 'Sent (the sender stopped before recording it)'
           WHEN s.logged THEN 'Not sent: the message service failed'
           WHEN s.attempts >= s.max_attempts THEN 'Not sent: the sender stopped before finishing, ' || s.attempts || ' times'
           ELSE 'The sender stopped before finishing: it is tried again'
         END,
         updated_at = now()
    FROM stuck s
   WHERE q.id = s.id;
  GET DIAGNOSTICS v_released = ROW_COUNT;

  UPDATE automation_queue q
     SET status = 'failed', completed_at = now(), updated_at = now(),
         error_message = 'Not sent: the automation was switched off before it was due'
   WHERE q.status = 'queued'
     AND q.payload ->> 'automation_id' = ANY (automation_wired_ids())
     AND NOT EXISTS (
       SELECT 1 FROM practice_automation_settings s
        WHERE s.practice_id = q.practice_id AND s.automation_id = q.payload ->> 'automation_id' AND s.enabled IS TRUE
     );
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  IF COALESCE(p_limit, 0) > 0 THEN
    WITH due AS (
      SELECT q.id
        FROM automation_queue q
       WHERE q.status = 'queued'
         AND q.scheduled_for <= now()
         AND q.payload ->> 'automation_id' = ANY (automation_wired_ids())
       ORDER BY q.priority DESC NULLS LAST, q.scheduled_for, q.created_at
       LIMIT LEAST(p_limit, 100)
       FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE automation_queue q
         SET status = 'processing', picked_at = now(), worker_id = v_worker,
             attempt_count = COALESCE(q.attempt_count, 0) + 1, error_message = NULL, updated_at = now()
        FROM due
       WHERE q.id = due.id
      RETURNING q.id
    )
    SELECT COALESCE(array_agg(claimed.id), '{}') INTO v_claimed FROM claimed;
  END IF;

  INSERT INTO automation_processor_heartbeat AS h (id, last_run_at, last_claimed, last_released, last_closed)
  VALUES (1, now(), cardinality(v_claimed), v_released, v_closed)
  ON CONFLICT (id) DO UPDATE
     SET last_run_at = EXCLUDED.last_run_at, last_claimed = EXCLUDED.last_claimed,
         last_released = EXCLUDED.last_released, last_closed = EXCLUDED.last_closed;

  -- What the sender needs, read now: a booking may have moved or been cancelled since it was queued.
  -- Every claimed item comes back (left joins), so the sender can finish each one.
  RETURN QUERY
  SELECT jsonb_build_object(
           'queue_id', q.id,
           'practice_id', q.practice_id,
           'automation_id', q.payload ->> 'automation_id',
           'attempt', q.attempt_count,
           'queued_at', q.created_at,
           'settings', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
             'enabled', s.enabled, 'sms_enabled', s.sms_enabled, 'email_enabled', s.email_enabled,
             'sms_template', s.sms_template, 'email_subject', s.email_subject, 'email_body', s.email_body) END,
           'practice', jsonb_build_object('name', pr.name, 'contact_phone', pr.contact_phone),
           'patient', CASE WHEN pa.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', pa.id, 'first_name', pa.first_name, 'last_name', pa.last_name,
             'cell_number', pa.cell_number, 'email', pa.email,
             'sms_opt_out', COALESCE((to_jsonb(pa) ->> 'sms_opt_out')::boolean, false)) END,
           'visit', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', v.id, 'patient_id', v.patient_id, 'status', v.status,
             'is_confirmed', v.is_confirmed, 'is_cancelled', v.is_cancelled, 'is_checked_in', v.is_checked_in,
             'is_ready', v.is_ready, 'is_handoff', v.is_handoff,
             'scheduled_date', v.scheduled_date, 'scheduled_time', v.scheduled_time,
             'visit_date', v.visit_date, 'visit_time', v.visit_time,
             'practitioner_name', u.full_name) END)
    FROM automation_queue q
    LEFT JOIN practices pr ON pr.id = q.practice_id
    LEFT JOIN practice_automation_settings s
           ON s.practice_id = q.practice_id AND s.automation_id = q.payload ->> 'automation_id'
    LEFT JOIN patients pa ON pa.id = automation_payload_uuid(q.payload ->> 'patient_id') AND pa.practice_id = q.practice_id
    LEFT JOIN visits v ON v.id = automation_payload_uuid(q.payload ->> 'visit_id') AND v.practice_id = q.practice_id
    LEFT JOIN users u ON u.id = v.doctor_id
   WHERE q.id = ANY (v_claimed)
   ORDER BY q.priority DESC NULLS LAST, q.scheduled_for, q.created_at;
END;
$$;
COMMENT ON FUNCTION public.automation_queue_claim(integer) IS
  'process-automation-queue only: releases stuck items, closes switched-off ones, records the run and claims up to p_limit due items (0 = housekeeping only).';

-- 4b. Record what happened to a claimed item: completed (sent) or failed, with the reason in plain
--     words (no names, numbers or message text; the sender writes them, see automationRun.ts)
CREATE OR REPLACE FUNCTION public.automation_queue_finish(p_queue_id uuid, p_sent boolean, p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE automation_queue
     SET status = CASE WHEN p_sent THEN 'completed' ELSE 'failed' END,
         completed_at = now(),
         error_message = left(NULLIF(btrim(COALESCE(p_note, '')), ''), 300),
         processing_time_ms = CASE WHEN picked_at IS NULL THEN NULL
                                   ELSE GREATEST(0, (EXTRACT(EPOCH FROM (now() - picked_at)) * 1000)::integer) END,
         updated_at = now()
   WHERE id = p_queue_id AND status = 'processing' AND worker_id = 'process-automation-queue';
  RETURN FOUND;
END;
$$;
COMMENT ON FUNCTION public.automation_queue_finish(uuid, boolean, text) IS
  'process-automation-queue only: completed when sent, failed otherwise; error_message holds the note (also for sent items).';

REVOKE ALL ON FUNCTION public.automation_queue_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_queue_finish(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_queue_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.automation_queue_finish(uuid, boolean, text) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Staff
-- ---------------------------------------------------------------------------------------------

-- 5a. What the sender did for the practice. Only items the sender finished count (worker_id): the demo
--     seed and the old in-database processors closed items without sending anything.
CREATE OR REPLACE FUNCTION public.automation_status(p_practice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_worker constant text := 'process-automation-queue';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)
       AND (u.practice_id = p_practice_id OR COALESCE(u.is_super_admin, false))
  ) THEN
    RAISE EXCEPTION 'Only staff of this practice can see its automations.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'processor_last_run_at', (SELECT h.last_run_at FROM automation_processor_heartbeat h WHERE h.id = 1),
    'last_processed_at', (
      SELECT max(q.completed_at) FROM automation_queue q
       WHERE q.practice_id = p_practice_id AND q.worker_id = v_worker AND q.status IN ('completed', 'failed')),
    'waiting_due', (
      SELECT count(*) FROM automation_queue q
       WHERE q.practice_id = p_practice_id AND q.status = 'queued' AND q.scheduled_for <= now()
         AND q.payload ->> 'automation_id' = ANY (automation_wired_ids())),
    'oldest_waiting_since', (
      SELECT min(q.scheduled_for) FROM automation_queue q
       WHERE q.practice_id = p_practice_id AND q.status = 'queued' AND q.scheduled_for <= now()
         AND q.payload ->> 'automation_id' = ANY (automation_wired_ids())),
    'automations', (
      SELECT COALESCE(jsonb_object_agg(a.id, jsonb_build_object(
               'sent_30d', (SELECT count(*) FROM automation_queue q
                             WHERE q.practice_id = p_practice_id AND q.payload ->> 'automation_id' = a.id AND q.worker_id = v_worker
                               AND q.status = 'completed' AND q.completed_at > now() - interval '30 days'),
               'not_sent_30d', (SELECT count(*) FROM automation_queue q
                                 WHERE q.practice_id = p_practice_id AND q.payload ->> 'automation_id' = a.id AND q.worker_id = v_worker
                                   AND q.status = 'failed' AND q.completed_at > now() - interval '30 days'),
               'last_sent_at', (SELECT max(q.completed_at) FROM automation_queue q
                                 WHERE q.practice_id = p_practice_id AND q.payload ->> 'automation_id' = a.id AND q.worker_id = v_worker
                                   AND q.status = 'completed'),
               'not_sent_reasons', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', r.reason, 'count', r.n) ORDER BY r.n DESC, r.reason), '[]'::jsonb)
                   FROM (SELECT q.error_message AS reason, count(*) AS n FROM automation_queue q
                          WHERE q.practice_id = p_practice_id AND q.payload ->> 'automation_id' = a.id AND q.worker_id = v_worker
                            AND q.status = 'failed' AND q.completed_at > now() - interval '30 days' AND q.error_message IS NOT NULL
                          GROUP BY q.error_message ORDER BY count(*) DESC, q.error_message LIMIT 3) r)
             )), '{}'::jsonb)
        FROM unnest(automation_wired_ids()) AS a(id))
  );
END;
$$;
COMMENT ON FUNCTION public.automation_status(uuid) IS
  'Communications > Automations: when the sender last ran, when it last finished one of the practice''s messages, what waits, and 30-day counts per automation.';

-- 5b. Switch an automation on or off and save its messages: practice administrators (and OneHealth
--     support). Switching off always works; switching on needs a channel and messages that fit.
CREATE OR REPLACE FUNCTION public.save_automation_setting(
  p_practice_id uuid, p_automation_id text, p_enabled boolean,
  p_sms_enabled boolean, p_email_enabled boolean,
  p_sms_template text, p_email_subject text, p_email_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)
       AND ((u.practice_id = p_practice_id AND u.role = 'admin') OR COALESCE(u.is_super_admin, false))
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change automations.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR NOT (COALESCE(p_automation_id, '') = ANY (automation_wired_ids())) THEN
    RAISE EXCEPTION 'OneHealth does not send this automation, so it cannot be switched on.' USING ERRCODE = '22023';
  END IF;
  IF p_enabled THEN
    IF NOT (COALESCE(p_sms_enabled, false) OR COALESCE(p_email_enabled, false)) THEN
      RAISE EXCEPTION 'Choose SMS, email or both.' USING ERRCODE = '22023';
    END IF;
    IF p_sms_enabled AND NULLIF(btrim(COALESCE(p_sms_template, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Write the SMS.' USING ERRCODE = '22023';
    END IF;
    IF p_email_enabled AND (NULLIF(btrim(COALESCE(p_email_subject, '')), '') IS NULL OR NULLIF(btrim(COALESCE(p_email_body, '')), '') IS NULL) THEN
      RAISE EXCEPTION 'Write the email and its subject.' USING ERRCODE = '22023';
    END IF;
    IF char_length(COALESCE(p_sms_template, '')) > 459 THEN
      RAISE EXCEPTION 'Keep the SMS under 459 characters (3 SMS).' USING ERRCODE = '22023';
    END IF;
    IF char_length(COALESCE(p_email_subject, '')) > 150 OR char_length(COALESCE(p_email_body, '')) > 5000 THEN
      RAISE EXCEPTION 'Keep the subject under 150 and the email under 5000 characters.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO practice_automation_settings
    (practice_id, automation_id, enabled, sms_enabled, email_enabled, sms_template, email_subject, email_body, updated_at)
  VALUES
    (p_practice_id, p_automation_id, COALESCE(p_enabled, false), COALESCE(p_sms_enabled, false), COALESCE(p_email_enabled, false),
     NULLIF(btrim(COALESCE(p_sms_template, '')), ''), NULLIF(btrim(COALESCE(p_email_subject, '')), ''),
     NULLIF(btrim(COALESCE(p_email_body, '')), ''), now())
  ON CONFLICT (practice_id, automation_id) DO UPDATE
     SET enabled = EXCLUDED.enabled, sms_enabled = EXCLUDED.sms_enabled, email_enabled = EXCLUDED.email_enabled,
         sms_template = EXCLUDED.sms_template, email_subject = EXCLUDED.email_subject,
         email_body = EXCLUDED.email_body, updated_at = now();
END;
$$;
COMMENT ON FUNCTION public.save_automation_setting(uuid, text, boolean, boolean, boolean, text, text, text) IS
  'Practice administrators switch welcome-new-patient / appointment-confirmation on or off and save their messages.';

REVOKE ALL ON FUNCTION public.automation_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_automation_setting(uuid, text, boolean, boolean, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_automation_setting(uuid, text, boolean, boolean, boolean, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. The old processors: retired (no role may call them, so nothing competes with the sender, the
--    scheduled n8n workflows included) and closed to the public. Trigger functions are left alone.
--    Two test functions that mark messages "sent" without sending (one holds a person's contact details
--    in its code) are dropped.
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.send_happy_joy_welcome();
DROP FUNCTION IF EXISTS public.process_sms_queue();

DO $$
DECLARE
  v_retired constant text[] := ARRAY[
    'get_pending_welcome_automations', 'get_all_pending_automations', 'get_all_pending_automations_simple',
    'get_pending_automations_readonly', 'get_pending_automations_json', 'get_pending_automations_by_type',
    'get_automation_statistics', 'process_automation_queue', 'process_automation_queue_serverside',
    'process_automation_queue_permanent', 'automation_queue_cron_processor', 'automation_scheduler',
    'trigger_automation_processing', 'process_automations_scheduled', 'process_all_pending_automations',
    'process_all_pending_automations_v2', 'process_automation_directly', 'process_automation_standalone',
    'process_automation_simple', 'process_automation_workflow', 'process_pending_automations',
    'process_pending_automations_simple', 'process_automation_immediately', 'bg_process_automation',
    'dequeue_automation', 'enqueue_automation', 'complete_queue_item', 'complete_automation',
    'fail_automation', 'mark_automation_processing', 'cleanup_stuck_automations', 'reset_stuck_automations',
    'check_and_queue_todays_birthdays', 'check_daily_birthdays', 'check_daily_birthdays_v2',
    'smart_birthday_automation_check', 'queue_birthday_automations', 'queue_birthday_automations_v2',
    'process_daily_birthday_automations', 'process_daily_automations', 'ensure_automations_processed',
    'process_due_automations', 'trigger_automations', 'run_automation_engine',
    'queue_automation_intelligently', 'schedule_automation_intelligently'
  ];
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY (v_retired) AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', r.signature);
    v_count := v_count + 1;
  END LOOP;

  -- A trigger still attached that calls one of them would now fail the save it runs in
  IF EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal
       AND EXISTS (SELECT 1 FROM unnest(v_retired) AS x(name) WHERE p.prosrc ~* ('\m' || x.name || '\s*\('))
  ) THEN
    RAISE EXCEPTION 'Check failed: a trigger still calls a retired automation function';
  END IF;
  RAISE NOTICE 'Old automation functions closed: %', v_count;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal
       AND t.tgname IN ('patient_created_automation_trigger', 'daily_check_on_patient_activity', 'process_automations_on_patient_activity',
                        'appointment_updated_automation_trigger', 'appointment_automation_trigger', 'opportunistic_check_on_visits',
                        'process_automations_on_visit_activity', 'automation_trigger_visits_insert', 'automation_trigger_visits_update',
                        'automation_trigger_invoices_insert', 'automation_trigger_invoices_update', 'automation_trigger_lab_requests_update',
                        'process_queue_on_insert_trigger', 'trigger_automation_engine_on_insert')
  ) THEN
    RAISE EXCEPTION 'Check failed: an old automation trigger is still attached';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trigger_queue_welcome_patient', 'appointment_created_automation_trigger') AND NOT tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'Check failed: the welcome and confirmation triggers must stay attached';
  END IF;
  IF has_function_privilege('anon', 'public.automation_queue_claim(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.automation_queue_claim(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.automation_queue_finish(uuid, boolean, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.automation_queue_claim(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: only the service role may claim and finish queue items';
  END IF;
  IF has_function_privilege('anon', 'public.automation_status(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.save_automation_setting(uuid, text, boolean, boolean, boolean, text, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.automation_status(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: staff functions must be for signed-in staff only';
  END IF;
  IF has_function_privilege('anon', 'public.get_all_pending_automations_simple(integer, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the old queue readers are still open to the public';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.automation_processor_heartbeat'::regclass) THEN
    RAISE EXCEPTION 'Check failed: automation_processor_heartbeat must have RLS on';
  END IF;
  RAISE NOTICE 'automations ready: one engine (automation_queue_claim / automation_queue_finish), staff status and save';
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

-- ---------------------------------------------------------------------------------------------
-- 8. The schedule (NOT part of the transaction above; the owner decides who runs the sender).
--    With pg_cron + pg_net (Database > Extensions) and the same Vault secrets as the diary reminders
--    (project_url, service_role_key), every 5 minutes. Deploy process-automation-queue first.
--
--    SELECT cron.schedule(
--      'process-automation-queue',
--      '*/5 * * * *',
--      $job$
--      SELECT net.http_post(
--        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/process-automation-queue',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--        ),
--        body := jsonb_build_object('batchSize', 20),
--        timeout_milliseconds := 120000
--      );
--      $job$
--    );
--    Or any other scheduler (n8n, GitHub Actions) that POSTs to the function with the service role key.
--    To stop: SELECT cron.unschedule('process-automation-queue');
-- ---------------------------------------------------------------------------------------------

-- =============================================================================================
-- Undo (only if needed; the old triggers and functions never sent anything that reached a patient):
--   DROP FUNCTION IF EXISTS public.automation_queue_claim(integer);
--   DROP FUNCTION IF EXISTS public.automation_queue_finish(uuid, boolean, text);
--   DROP FUNCTION IF EXISTS public.automation_status(uuid);
--   DROP FUNCTION IF EXISTS public.save_automation_setting(uuid, text, boolean, boolean, boolean, text, text, text);
--   DROP TABLE IF EXISTS public.automation_processor_heartbeat;
--   DROP FUNCTION IF EXISTS public.automation_wired_ids(); DROP FUNCTION IF EXISTS public.automation_payload_uuid(text);
--   CREATE POLICY "Practice users can insert their automation settings" ON public.practice_automation_settings
--     FOR INSERT WITH CHECK (practice_id IN (SELECT users.practice_id FROM users WHERE users.id = auth.uid()));
--   CREATE POLICY "Practice users can update their automation settings" ON public.practice_automation_settings
--     FOR UPDATE USING (practice_id IN (SELECT users.practice_id FROM users WHERE users.id = auth.uid()));
--   CREATE TRIGGER patient_created_automation_trigger AFTER INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION trigger_patient_created_automation();
--   CREATE TRIGGER daily_check_on_patient_activity AFTER INSERT OR UPDATE ON public.patients FOR EACH STATEMENT EXECUTE FUNCTION daily_automation_check();
--   CREATE TRIGGER process_automations_on_patient_activity AFTER UPDATE ON public.patients FOR EACH STATEMENT EXECUTE FUNCTION opportunistic_automation_processor();
--   CREATE TRIGGER appointment_updated_automation_trigger AFTER UPDATE ON public.visits FOR EACH ROW WHEN ((new.status IS DISTINCT FROM old.status)) EXECUTE FUNCTION queue_appointment_automation();
--   CREATE TRIGGER appointment_automation_trigger AFTER INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION trigger_appointment_automation();
--   CREATE TRIGGER opportunistic_check_on_visits AFTER INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION opportunistic_automation_check();
--   CREATE TRIGGER process_automations_on_visit_activity AFTER INSERT OR UPDATE ON public.visits FOR EACH STATEMENT EXECUTE FUNCTION opportunistic_automation_processor();
--   CREATE TRIGGER automation_trigger_visits_insert AFTER INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION process_automation_trigger();
--   CREATE TRIGGER automation_trigger_visits_update AFTER UPDATE ON public.visits FOR EACH ROW WHEN (((old.is_confirmed IS DISTINCT FROM new.is_confirmed) OR (old.status IS DISTINCT FROM new.status) OR (old.scheduled_date IS DISTINCT FROM new.scheduled_date) OR (old.scheduled_time IS DISTINCT FROM new.scheduled_time) OR (old.is_cancelled IS DISTINCT FROM new.is_cancelled))) EXECUTE FUNCTION process_automation_trigger();
--   CREATE TRIGGER automation_trigger_invoices_insert AFTER INSERT ON public.invoices_enhanced FOR EACH ROW EXECUTE FUNCTION process_automation_trigger();
--   CREATE TRIGGER automation_trigger_invoices_update AFTER UPDATE ON public.invoices_enhanced FOR EACH ROW WHEN ((old.payment_status IS DISTINCT FROM new.payment_status)) EXECUTE FUNCTION process_automation_trigger();
--   CREATE TRIGGER automation_trigger_lab_requests_update AFTER UPDATE ON public.lab_requests FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) AND (new.status = 'completed'::text))) EXECUTE FUNCTION process_automation_trigger();
--   CREATE TRIGGER process_queue_on_insert_trigger AFTER INSERT ON public.automation_queue FOR EACH ROW EXECUTE FUNCTION process_queue_on_insert();
--   CREATE TRIGGER trigger_automation_engine_on_insert AFTER INSERT ON public.automation_executions FOR EACH ROW EXECUTE FUNCTION smart_automation_trigger();
--   GRANT EXECUTE ON FUNCTION <each function in section 6> TO anon, authenticated, service_role;   (they were open to all)
--   The previous bodies of queue_welcome_patient_automation and queue_appointment_automation queued a
--   second welcome and the diary's reminders: save them with pg_get_functiondef before applying if a copy
--   is wanted. send_happy_joy_welcome and process_sms_queue are not restored (they faked sending).
-- =============================================================================================
