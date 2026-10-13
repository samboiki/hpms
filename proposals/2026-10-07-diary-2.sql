-- Applied 2026-10-07 as migration diary_2_2026_10_07
-- Fix 2026-10-07 applied as migration diary_2_booking_length_default_2026_10_07 (section 1: DROP DEFAULT)
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: diary part 2 (booking lengths, practitioner working hours, SMS reminders
-- that actually run)
-- File:    proposals/2026-10-07-diary-2.sql                                 Drafted: 2026-10-07
-- Apply:   after proposals/2026-10-07-diary.sql. Works with or without
--          proposals/2026-10-07-two-way-sms.sql (patients.sms_opt_out): without it nobody has opted out.
-- Code:    supabase/functions/_shared/appointmentReminders.ts (who is due, the message, the dedupe key)
--          supabase/functions/_shared/reminderRun.ts (claim, send, record), both unit tested
--          supabase/functions/send-appointment-reminders/index.ts (the schedule; service role key only)
--          src/utils/diary/bookingLength.ts, workingHours.ts (the rules, unit tested)
--          src/services/diarySettingsService.ts, reminderRunService.ts, diaryService.ts
--          src/components/appointments/diary/DiarySettingsModal.tsx, RemindPatientsModal.tsx
--
-- Why
--   1. Every booking was drawn and checked as 30 minutes: visits has no length. The booking form
--      already asks for one; it is now stored (null = the practice's default for the visit type).
--   2. Practitioners have their own days and hours (Dr A Monday to Wednesday, Dr B afternoons, a
--      lunch break). The time picker, "Next free slot" and the booking warnings use them. Warn only:
--      reception can still book outside them.
--   3. Automatic SMS reminders never ran: nothing called them and the old function read the old
--      appointments table. Reminders are now worked out from visits, sent through the central SMS
--      gateway (logged, counted, linked to the booking so the diary icon and SMS replies attach to
--      it), never twice for the same booking and slot, and run every 15 minutes by pg_cron.
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review the sections. Run the whole file once as it is (SQL editor, or a branch first): it must
--      finish without an error and section 9 reports "diary part 2 ready". Section 10 does nothing
--      when the whole file runs (it says "not created (on purpose)"): the schedule is step 5.
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Deploy the reminder function:   supabase functions deploy send-appointment-reminders
--      (the deployed version before this change reads the old appointment_reminders table: never
--      schedule it)
--   4. Store two secrets in Vault, once, in the SQL editor (type the values there; never paste the key
--      anywhere else):
--        select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--        select vault.create_secret('<service role key from Settings > API>', 'service_role_key');
--   5. Switch on the pg_cron and pg_net extensions (Database > Extensions). Then, in one SQL editor run:
--        SET diary.reminder_schedule = 'create';
--        <the DO block of section 10, copied as it is>
--      It reports "Reminder schedule created". Check later with:
--        select jobname, schedule, active from cron.job where jobname = 'diary-appointment-reminders';
--   6. Each practice switches reminders on in the app: Diary > More > Diary settings > Reminders
--      (administrators). Until then nothing is sent automatically; "Remind patients" works by hand.
--   If the app still says "not set up yet" a minute after step 2, run:  NOTIFY pgrst, 'reload schema';
--
-- Contents
--   1. visits.duration_minutes
--   2. diary_settings: booking lengths per visit type, reminder settings, last schedule run
--   3. save_diary_settings(): administrators save them
--   4. doctor_branch_schedules: working hours per weekday and branch, with a break
--   5. save_practitioner_hours(): replace one practitioner's week
--   6. diary_reminder_log: one row per reminder, unique per booking, kind and slot
--   7. claim_diary_reminder() / finish_diary_reminder(): reception's "Remind patients"
--   8. Grants
--   9. Checks
--  10. The schedule (pg_cron, every 15 minutes)
--   Undo: at the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. visits.duration_minutes
--    The booked length. Null for every booking made before this change and for bookings made outside
--    the diary: the practice's default for the visit type applies (section 2), else 30 minutes.
--    Adding a column without a default does not rewrite the table.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS duration_minutes smallint;
-- Fix 2026-10-07: the column already existed (migration add_visit_subtype_and_duration, 2025-06-29) as
-- integer DEFAULT 30, so a booking saved without a length stored 30 and never got its type's length.
-- Without the default it stays null and the practice's length for the visit type applies.
ALTER TABLE public.visits ALTER COLUMN duration_minutes DROP DEFAULT;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_duration_minutes_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_duration_minutes_check
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 480);

COMMENT ON COLUMN public.visits.duration_minutes IS
  'Booked length in minutes (5-480). Null = the practice default for visit_type (diary_settings.type_lengths), else 30. Rules: src/utils/diary/bookingLength.ts.';

-- ---------------------------------------------------------------------------------------------
-- 2. diary_settings: one row per practice, created the first time an administrator saves.
--    A practice without a row uses the same defaults (the app and the edge function apply them).
--    type_lengths: minutes per visit type. The starting set keeps consultations at the 30 minutes the
--    diary always used and makes follow-ups 15 minutes, so no existing booking grows overnight.
--    reminders_last_run_at: set by the schedule each time it checks the practice, so the settings
--    screen can say whether the schedule really runs.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diary_settings (
  practice_id              uuid PRIMARY KEY,
  type_lengths             jsonb NOT NULL DEFAULT '{"consultation": 30, "follow-up": 15, "procedure": 30, "emergency": 30}'::jsonb,
  reminders_enabled        boolean NOT NULL DEFAULT false,
  reminder_day_before      boolean NOT NULL DEFAULT true,
  reminder_day_before_time time NOT NULL DEFAULT '10:00',
  reminder_same_day        boolean NOT NULL DEFAULT false,
  reminder_same_day_hours  smallint NOT NULL DEFAULT 2,
  reminder_template        text NOT NULL DEFAULT '{{practiceName}}: Hi {{patientFirstName}}, reminder: appointment with {{practitionerName}} on {{appointmentDate}} at {{appointmentTime}}. Reply 1 to confirm, 2 to cancel, 3 for a new time.',
  reminders_last_run_at    timestamptz,
  updated_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diary_settings_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT diary_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_settings_type_lengths_check CHECK (jsonb_typeof(type_lengths) = 'object'),
  -- Never at night: the same window the edge function keeps (07:00-20:00 Windhoek time)
  CONSTRAINT diary_settings_day_before_time_check CHECK (reminder_day_before_time >= '07:00' AND reminder_day_before_time < '20:00'),
  CONSTRAINT diary_settings_same_day_hours_check CHECK (reminder_same_day_hours BETWEEN 1 AND 12),
  CONSTRAINT diary_settings_template_check CHECK (char_length(btrim(reminder_template)) BETWEEN 1 AND 459)
);

COMMENT ON TABLE public.diary_settings IS
  'Per practice: default booking length per visit type and SMS reminder settings. Saved through save_diary_settings(). Rules: src/utils/diary/bookingLength.ts, supabase/functions/_shared/appointmentReminders.ts.';
COMMENT ON COLUMN public.diary_settings.type_lengths IS 'Minutes per visit type: {"consultation": 30, "follow-up": 15, "procedure": 30, "emergency": 30}.';
COMMENT ON COLUMN public.diary_settings.reminders_enabled IS 'The schedule sends reminders for this practice. Reception can always remind by hand.';
COMMENT ON COLUMN public.diary_settings.reminder_day_before_time IS 'Windhoek time the day-before reminders go out (07:00-19:59).';
COMMENT ON COLUMN public.diary_settings.reminder_same_day_hours IS 'Same-day reminder: hours before the appointment (when reminder_same_day).';
COMMENT ON COLUMN public.diary_settings.reminders_last_run_at IS 'When the schedule last checked this practice (set by send-appointment-reminders).';

ALTER TABLE public.diary_settings ENABLE ROW LEVEL SECURITY;

-- Staff of the practice (and super admins) read the settings; writes go through section 3
DROP POLICY IF EXISTS diary_settings_select ON public.diary_settings;
CREATE POLICY diary_settings_select ON public.diary_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_settings.practice_id OR COALESCE(users.is_super_admin, false))
  ));

-- ---------------------------------------------------------------------------------------------
-- 3. save_diary_settings(practice, settings): practice administrators (and super admins) only, since
--    reminders cost SMS credits and lengths change every practitioner's diary. Keys left out of
--    p_settings keep their saved value, so the lengths and the reminders are saved separately.
--    Keys: type_lengths, reminders_enabled, reminder_day_before, reminder_day_before_time,
--    reminder_same_day, reminder_same_day_hours, reminder_template.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_diary_settings(p_practice_id uuid, p_settings jsonb)
RETURNS public.diary_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lengths jsonb := p_settings -> 'type_lengths';
  v_template text := NULLIF(btrim(p_settings ->> 'reminder_template'), '');
  v_key text;
  v_value jsonb;
  v_row public.diary_settings;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND COALESCE(u.is_active, true)
      AND ((u.practice_id = p_practice_id AND u.role = 'admin') OR COALESCE(u.is_super_admin, false))
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the diary settings.' USING ERRCODE = '42501';
  END IF;

  IF v_lengths IS NOT NULL THEN
    IF jsonb_typeof(v_lengths) <> 'object' THEN
      RAISE EXCEPTION 'Booking lengths must be given per visit type.' USING ERRCODE = '22023';
    END IF;
    FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_lengths) LOOP
      IF v_key NOT IN ('consultation', 'follow-up', 'procedure', 'emergency') THEN
        RAISE EXCEPTION 'Unknown visit type: %', v_key USING ERRCODE = '22023';
      END IF;
      -- Two steps: SQL does not promise to stop at the first true OR, and a text value cannot be cast
      IF jsonb_typeof(v_value) <> 'number' THEN
        RAISE EXCEPTION 'A booking length must be a number of minutes (%).', v_key USING ERRCODE = '22023';
      END IF;
      IF (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric)
         OR (v_value #>> '{}')::numeric NOT BETWEEN 5 AND 480 THEN
        RAISE EXCEPTION 'A booking length must be 5 to 480 whole minutes (%).', v_key USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- A reminder must say when (appointmentReminders.ts REQUIRED_REMINDER_PLACEHOLDERS)
  IF v_template IS NOT NULL
     AND (v_template !~ '\{\{\s*appointmentDate\s*\}\}' OR v_template !~ '\{\{\s*appointmentTime\s*\}\}') THEN
    RAISE EXCEPTION 'The reminder must include {{appointmentDate}} and {{appointmentTime}}.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.diary_settings (practice_id) VALUES (p_practice_id) ON CONFLICT (practice_id) DO NOTHING;

  UPDATE public.diary_settings s SET
    type_lengths             = COALESCE(s.type_lengths || v_lengths, s.type_lengths),
    reminders_enabled        = COALESCE((p_settings ->> 'reminders_enabled')::boolean, s.reminders_enabled),
    reminder_day_before      = COALESCE((p_settings ->> 'reminder_day_before')::boolean, s.reminder_day_before),
    reminder_day_before_time = COALESCE((p_settings ->> 'reminder_day_before_time')::time, s.reminder_day_before_time),
    reminder_same_day        = COALESCE((p_settings ->> 'reminder_same_day')::boolean, s.reminder_same_day),
    reminder_same_day_hours  = COALESCE((p_settings ->> 'reminder_same_day_hours')::smallint, s.reminder_same_day_hours),
    reminder_template        = COALESCE(v_template, s.reminder_template),
    updated_by               = auth.uid(),
    updated_at               = now()
  WHERE s.practice_id = p_practice_id
  RETURNING s.* INTO v_row;

  IF v_row.reminders_enabled AND NOT v_row.reminder_day_before AND NOT v_row.reminder_same_day THEN
    RAISE EXCEPTION 'Choose when to remind: the day before, on the day, or both.' USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.save_diary_settings(uuid, jsonb) IS
  'Practice administrators save booking lengths and reminder settings. Keys left out keep their value.';

-- ---------------------------------------------------------------------------------------------
-- 4. Working hours: doctor_branch_schedules (created by supabase/migrations/20250626_add_branch_support.sql
--    and unused until now). One row per practitioner, branch and weekday (0 = Sunday); branch_id null
--    for a practice without branches. A break (lunch) is break_start-break_end inside the hours; a
--    practitioner at two branches on one day has two rows. A practitioner without rows works the
--    practice's opening hours (practices.business_hours), as before.
--    New: practice_id (the old policies went through branch_id, so practices without branches could
--    not use the table), the break, and staff-read RLS. Changes go through section 5.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.doctor_branch_schedules ADD COLUMN IF NOT EXISTS practice_id uuid;
ALTER TABLE public.doctor_branch_schedules ADD COLUMN IF NOT EXISTS break_start time;
ALTER TABLE public.doctor_branch_schedules ADD COLUMN IF NOT EXISTS break_end time;

-- Rows saved before this change belong to their branch's practice, else the practitioner's
UPDATE public.doctor_branch_schedules s
SET practice_id = COALESCE(
  (SELECT b.practice_id FROM public.branches b WHERE b.id = s.branch_id),
  (SELECT u.practice_id FROM public.users u WHERE u.id = s.doctor_id)
)
WHERE s.practice_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_branch_schedules_practice_id_fkey') THEN
    ALTER TABLE public.doctor_branch_schedules
      ADD CONSTRAINT doctor_branch_schedules_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- NOT VALID: rows saved before this change are not re-checked; every new row is
ALTER TABLE public.doctor_branch_schedules DROP CONSTRAINT IF EXISTS doctor_branch_schedules_hours_check;
ALTER TABLE public.doctor_branch_schedules ADD CONSTRAINT doctor_branch_schedules_hours_check
  CHECK (end_time > start_time) NOT VALID;
ALTER TABLE public.doctor_branch_schedules DROP CONSTRAINT IF EXISTS doctor_branch_schedules_break_check;
ALTER TABLE public.doctor_branch_schedules ADD CONSTRAINT doctor_branch_schedules_break_check CHECK (
  (break_start IS NULL AND break_end IS NULL)
  OR (break_start IS NOT NULL AND break_end IS NOT NULL
      AND break_start > start_time AND break_end < end_time AND break_end > break_start)
) NOT VALID;

CREATE INDEX IF NOT EXISTS doctor_branch_schedules_practice_idx ON public.doctor_branch_schedules (practice_id, doctor_id);

COMMENT ON TABLE public.doctor_branch_schedules IS
  'Practitioner working hours per weekday (0 = Sunday) and branch (null = no branches), with an optional break. Saved through save_practitioner_hours(). Rules: src/utils/diary/workingHours.ts.';
COMMENT ON COLUMN public.doctor_branch_schedules.break_start IS 'Start of the break (lunch) inside start_time-end_time; null = no break.';

-- RLS: staff of the practice read every practitioner's hours. Whatever policies the table had
-- (they went through branch_id) are replaced; writes go through section 5.
ALTER TABLE public.doctor_branch_schedules ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_branch_schedules' LOOP
    EXECUTE format('DROP POLICY %I ON public.doctor_branch_schedules', p.policyname);
  END LOOP;
END $$;

CREATE POLICY doctor_branch_schedules_select ON public.doctor_branch_schedules
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = doctor_branch_schedules.practice_id OR COALESCE(users.is_super_admin, false))
  ));

-- ---------------------------------------------------------------------------------------------
-- 5. save_practitioner_hours(practice, practitioner, days): replaces the practitioner's whole week.
--    Practice administrators, super admins and the practitioner themselves. p_days is a list of
--    {"day_of_week": 1, "branch_id": null, "start_time": "08:00", "end_time": "17:00",
--     "break_start": "13:00", "break_end": "14:00"}; an empty list clears the hours (the practice's
--    opening hours apply again). src/utils/diary/workingHours.ts validates the same way first.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_practitioner_hours(p_practice_id uuid, p_doctor_id uuid, p_days jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days jsonb := COALESCE(p_days, '[]'::jsonb);
  v_day jsonb;
  v_branch uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND COALESCE(u.is_active, true)
      AND ((u.practice_id = p_practice_id AND (u.role = 'admin' OR u.id = p_doctor_id)) OR COALESCE(u.is_super_admin, false))
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator, or the practitioner, can change working hours.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_doctor_id AND practice_id = p_practice_id) THEN
    RAISE EXCEPTION 'This practitioner is not in the practice.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_days) <> 'array' OR jsonb_array_length(v_days) > 21 THEN
    RAISE EXCEPTION 'Working hours must be a list of at most 21 days.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.doctor_branch_schedules
  WHERE doctor_id = p_doctor_id AND (practice_id = p_practice_id OR practice_id IS NULL);

  FOR v_day IN SELECT value FROM jsonb_array_elements(v_days) LOOP
    v_branch := NULLIF(v_day ->> 'branch_id', '')::uuid;
    IF v_branch IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch AND practice_id = p_practice_id) THEN
      RAISE EXCEPTION 'That branch is not in the practice.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.doctor_branch_schedules
      (practice_id, doctor_id, branch_id, day_of_week, start_time, end_time, break_start, break_end, is_active)
    VALUES (
      p_practice_id,
      p_doctor_id,
      v_branch,
      (v_day ->> 'day_of_week')::integer,
      (v_day ->> 'start_time')::time,
      (v_day ->> 'end_time')::time,
      NULLIF(v_day ->> 'break_start', '')::time,
      NULLIF(v_day ->> 'break_end', '')::time,
      true
    );
    v_count := v_count + 1;
  END LOOP;

  -- One place at a time: two rows of the same day may not overlap
  IF EXISTS (
    SELECT 1
    FROM public.doctor_branch_schedules a
    JOIN public.doctor_branch_schedules b
      ON b.doctor_id = a.doctor_id AND b.day_of_week = a.day_of_week AND b.practice_id = a.practice_id AND a.id < b.id
    WHERE a.doctor_id = p_doctor_id AND a.practice_id = p_practice_id
      AND a.start_time < b.end_time AND b.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'Two working times on the same day overlap.' USING ERRCODE = '22023';
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.save_practitioner_hours(uuid, uuid, jsonb) IS
  'Replaces a practitioner''s working week (administrators, super admins, the practitioner). Empty list = practice opening hours apply.';

-- ---------------------------------------------------------------------------------------------
-- 6. diary_reminder_log: one row per reminder, claimed BEFORE the SMS is sent. The unique
--    (visit_id, kind, slot_key) is what makes a second reminder for the same booking and slot
--    impossible, whoever sends it (the schedule, reception, two receptionists at once).
--    slot_key is the booking's date and time when reminded ('2026-10-08T09:30'): a booking moved to
--    another time can be reminded of its new time. A failed reminder is not retried automatically
--    (the gateway may have passed it on before failing); the diary shows it so reception can call.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diary_reminder_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  visit_id    uuid NOT NULL,
  patient_id  uuid,
  kind        text NOT NULL,
  slot_key    text NOT NULL,
  status      text NOT NULL DEFAULT 'sending',
  source      text NOT NULL DEFAULT 'schedule',
  sms_log_id  uuid,
  error       text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT diary_reminder_log_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT diary_reminder_log_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE,
  CONSTRAINT diary_reminder_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  CONSTRAINT diary_reminder_log_sms_log_id_fkey FOREIGN KEY (sms_log_id) REFERENCES public.practice_sms_logs(id) ON DELETE SET NULL,
  CONSTRAINT diary_reminder_log_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_reminder_log_kind_check CHECK (kind IN ('day_before', 'same_day')),
  CONSTRAINT diary_reminder_log_status_check CHECK (status IN ('sending', 'sent', 'failed')),
  CONSTRAINT diary_reminder_log_source_check CHECK (source IN ('schedule', 'reception')),
  CONSTRAINT diary_reminder_log_slot_key_check CHECK (slot_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'),
  CONSTRAINT diary_reminder_log_error_check CHECK (error IS NULL OR char_length(error) <= 300),
  CONSTRAINT diary_reminder_log_once UNIQUE (visit_id, kind, slot_key)
);

COMMENT ON TABLE public.diary_reminder_log IS
  'Appointment reminders, claimed before sending: unique per booking, kind and slot, so none is sent twice. Written by send-appointment-reminders (service role) and claim_/finish_diary_reminder().';
COMMENT ON COLUMN public.diary_reminder_log.kind IS 'day_before | same_day (appointmentReminders.ts ReminderKind).';
COMMENT ON COLUMN public.diary_reminder_log.slot_key IS 'The booking''s date and time when reminded, e.g. 2026-10-08T09:30.';
COMMENT ON COLUMN public.diary_reminder_log.status IS 'sending (claimed) | sent | failed (error says why; not retried automatically).';
COMMENT ON COLUMN public.diary_reminder_log.sms_log_id IS 'The gateway''s practice_sms_logs row (delivery status, replies).';

CREATE INDEX IF NOT EXISTS diary_reminder_log_practice_idx ON public.diary_reminder_log (practice_id, created_at DESC);

ALTER TABLE public.diary_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_reminder_log_select ON public.diary_reminder_log;
CREATE POLICY diary_reminder_log_select ON public.diary_reminder_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_reminder_log.practice_id OR COALESCE(users.is_super_admin, false))
  ));

-- ---------------------------------------------------------------------------------------------
-- 7. Reception's "Remind patients": the app claims each reminder, sends it through the SMS gateway
--    with the staff member's own sign-in, then records the outcome. Any active staff member of the
--    practice may remind its patients (it is reception's daily job). Only the staff member who made
--    a claim can record its outcome.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_diary_reminder(p_visit_id uuid, p_kind text, p_slot_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_practice uuid;
  v_patient uuid;
  v_id uuid;
BEGIN
  SELECT practice_id, patient_id INTO v_practice, v_patient FROM public.visits WHERE id = p_visit_id;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND COALESCE(u.is_active, true)
      AND (u.practice_id = v_practice OR COALESCE(u.is_super_admin, false))
  ) THEN
    RAISE EXCEPTION 'Only staff of the practice can send its reminders.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.diary_reminder_log (practice_id, visit_id, patient_id, kind, slot_key, status, source, created_by)
  VALUES (v_practice, p_visit_id, v_patient, p_kind, p_slot_key, 'sending', 'reception', auth.uid())
  ON CONFLICT (visit_id, kind, slot_key) DO NOTHING
  RETURNING id INTO v_id;

  -- Null: this reminder was already claimed (sent, being sent or failed), so nothing is sent
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.claim_diary_reminder(uuid, text, text) IS
  'Claims one reminder for reception before it is sent; returns null when it was claimed before (never send then).';

CREATE OR REPLACE FUNCTION public.finish_diary_reminder(p_log_id uuid, p_sent boolean, p_sms_log_id uuid, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.diary_reminder_log l SET
    status      = CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
    sms_log_id  = CASE WHEN p_sms_log_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.practice_sms_logs WHERE id = p_sms_log_id)
                       THEN p_sms_log_id END,
    error       = CASE WHEN p_sent THEN NULL ELSE left(COALESCE(NULLIF(btrim(p_error), ''), 'Not sent'), 300) END,
    finished_at = now()
  WHERE l.id = p_log_id AND l.created_by = auth.uid() AND l.status = 'sending';
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.finish_diary_reminder(uuid, boolean, uuid, text) IS
  'Records whether a reminder claimed with claim_diary_reminder() was sent. Only its claimer can.';

-- ---------------------------------------------------------------------------------------------
-- 8. Grants. Nothing for anon. Staff read; every write goes through the functions above or the
--    service role (the schedule).
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON public.diary_settings FROM anon, authenticated;
GRANT SELECT ON public.diary_settings TO authenticated;
GRANT ALL ON public.diary_settings TO service_role;

REVOKE ALL ON public.diary_reminder_log FROM anon, authenticated;
GRANT SELECT ON public.diary_reminder_log TO authenticated;
GRANT ALL ON public.diary_reminder_log TO service_role;

REVOKE ALL ON public.doctor_branch_schedules FROM anon, authenticated;
GRANT SELECT ON public.doctor_branch_schedules TO authenticated;
GRANT ALL ON public.doctor_branch_schedules TO service_role;

REVOKE ALL ON FUNCTION public.save_diary_settings(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_practitioner_hours(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_diary_reminder(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_diary_reminder(uuid, boolean, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_diary_settings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_practitioner_hours(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diary_reminder(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_diary_reminder(uuid, boolean, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. Checks: RLS is on with one read policy per table, the functions are SECURITY DEFINER, the
--    length limit is on visits (checked in the catalogue: no booking is touched) and the reminder
--    log refuses the same reminder twice (the test rows are undone by their exception block).
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  rls_on boolean;
  policy_count integer;
  f text;
  any_visit uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visits_duration_minutes_check' AND conrelid = 'public.visits'::regclass AND convalidated
  ) THEN
    RAISE EXCEPTION 'visits: the 5-480 minute check on duration_minutes is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.visits'::regclass AND a.attname = 'duration_minutes'
  ) THEN
    RAISE EXCEPTION 'visits: duration_minutes still has a default, so the visit type lengths never apply';
  END IF;

  FOREACH t IN ARRAY ARRAY['diary_settings', 'diary_reminder_log', 'doctor_branch_schedules'] LOOP
    SELECT relrowsecurity INTO rls_on FROM pg_class WHERE oid = format('public.%I', t)::regclass;
    IF NOT rls_on THEN
      RAISE EXCEPTION '%: row level security is off', t;
    END IF;
    SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF policy_count <> 1 THEN
      RAISE EXCEPTION '%: expected 1 policy (read for staff), found %', t, policy_count;
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY['save_diary_settings', 'save_practitioner_hours', 'claim_diary_reminder', 'finish_diary_reminder'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f AND pronamespace = 'public'::regnamespace AND prosecdef) THEN
      RAISE EXCEPTION '% is missing or not SECURITY DEFINER', f;
    END IF;
  END LOOP;

  SELECT id INTO any_visit FROM public.visits WHERE practice_id IS NOT NULL LIMIT 1;
  IF any_visit IS NOT NULL THEN
    BEGIN
      INSERT INTO public.diary_reminder_log (practice_id, visit_id, kind, slot_key)
      SELECT practice_id, id, 'day_before', '2026-10-08T09:30' FROM public.visits WHERE id = any_visit;
      INSERT INTO public.diary_reminder_log (practice_id, visit_id, kind, slot_key)
      SELECT practice_id, id, 'day_before', '2026-10-08T09:30' FROM public.visits WHERE id = any_visit;
      RAISE EXCEPTION 'diary_reminder_log: the same reminder was accepted twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  RAISE NOTICE 'diary part 2 ready: booking lengths, working hours and the reminder log are in place';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 10. The schedule: pg_cron calls send-appointment-reminders every 15 minutes with the service role
--     key (the function accepts nothing else). Each run sends what is due: the day-before reminders
--     from the practice's chosen time, same-day reminders N hours ahead, nothing at night.
--     It runs ONLY when asked (step 5 at the top: SET diary.reminder_schedule = 'create'), so applying
--     this file never starts it: until the new function is deployed, the schedule would call the old
--     send-appointment-reminders, which reads the old appointment_reminders table.
--     Needs pg_cron, pg_net and the two Vault secrets (steps 4 and 5); without them it only says what
--     is missing. Safe to run again: it replaces the job.
-- ---------------------------------------------------------------------------------------------
DO $schedule$
DECLARE
  v_ready boolean;
BEGIN
  IF current_setting('diary.reminder_schedule', true) IS DISTINCT FROM 'create' THEN
    RAISE NOTICE 'Reminder schedule not created (on purpose): deploy send-appointment-reminders first, then run SET diary.reminder_schedule = ''create''; and section 10 on its own.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE NOTICE 'Reminder schedule not created yet: switch on pg_cron and pg_net (Database > Extensions), then run section 10 again.';
    RETURN;
  END IF;

  EXECUTE $q$SELECT count(*) = 2 FROM vault.decrypted_secrets WHERE name IN ('project_url', 'service_role_key')$q$ INTO v_ready;
  IF NOT v_ready THEN
    RAISE NOTICE 'Reminder schedule not created yet: store the project_url and service_role_key secrets in Vault (step 4 at the top), then run section 10 again.';
    RETURN;
  END IF;

  EXECUTE $q$SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'diary-appointment-reminders'$q$;
  EXECUTE format(
    'SELECT cron.schedule(%L, %L, %L)',
    'diary-appointment-reminders',
    '*/15 * * * *',
    $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-appointment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 120000
    );
    $job$
  );
  RAISE NOTICE 'Reminder schedule created: send-appointment-reminders runs every 15 minutes.';
END $schedule$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed):
--   SELECT cron.unschedule('diary-appointment-reminders');            -- stops the schedule
--   DROP FUNCTION IF EXISTS public.claim_diary_reminder(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.finish_diary_reminder(uuid, boolean, uuid, text);
--   DROP FUNCTION IF EXISTS public.save_diary_settings(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.save_practitioner_hours(uuid, uuid, jsonb);
--   DROP TABLE IF EXISTS public.diary_reminder_log;                    -- the reminder history
--   DROP TABLE IF EXISTS public.diary_settings;                        -- lengths and reminder settings
--   ALTER TABLE public.doctor_branch_schedules DROP COLUMN IF EXISTS break_start, DROP COLUMN IF EXISTS break_end;
--   ALTER TABLE public.visits DROP COLUMN IF EXISTS duration_minutes;   -- every booking is 30 minutes again
-- The app then shows "not set up yet" for these settings, treats every booking as its type's default
-- length again and keeps working. The doctor_branch_schedules policies replaced in section 4 are not
-- restored (the app never used the table before this change).
-- =============================================================================================
