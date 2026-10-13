-- Applied 2026-10-13 as migration diary_waiting_list_2026_10_13 (version 20261013010245; stored statement md5 62bc247be547da1fa0da730fcbe0270f = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked: no table or function left): reception added a patient
-- (a practitioner, Monday and Wednesday 08:00-12:00, a month, the booking to move earlier; days kept once each in
-- order, the note tidied), and the same patient again was refused (23505); a last day in the past or more than a year
-- ahead, day 7, a window shorter than the visit, 3 minutes, another practice's practitioner, another patient's booking
-- and a 301-character note were refused (22023); a change was kept (1 row); direct inserts and updates were refused
-- (42501). An offer for tomorrow 10:30 was recorded (offered, by reception); one in the past or after the last day was
-- refused (22023). Another practice's staff saw 0 rows and could not change, add, offer or close (42501); a patient-app
-- login saw 0 and could not close (42501); anon could neither read nor run anything (42501). The practitioner closed it
-- as booked with the patient's booking; removed with a booking, booked without one or with another patient's booking,
-- closing twice and changing a closed entry were refused (22023); the patient could then be added again (2 entries).
-- =============================================================================================
-- PROPOSAL: a waiting list in the diary, with offers of a freed time by SMS (parity B21)
-- File:   proposals/2026-10-13-diary-waiting-list.sql                    Drafted: 2026-10-13
-- Code:   src/utils/diary/waitingList.ts (who could take a time, the checks, the offer SMS; tested),
--         src/services/waitingListService.ts (reads and writes; "not set up yet" before this file),
--         src/components/appointments/diary/WaitingList*.tsx (Diary > More > Waiting list, the freed-time prompt
--         after a cancellation and the strip in the booking form for a clicked free time).
--
-- Why (parity B21): when a patient cancels, reception has nobody to call: Eminance practices keep a waiting list
-- of patients who want an earlier time. OneHealth's old waiting list was never shown, wrote to the legacy
-- appointments table and read a date column visits never had (WaitlistManager.tsx and appointmentService.ts, both
-- removed). The SMS reply webhook already reads a YES to an offer as "wants the slot" and leaves it for staff
-- (supabase/functions/_shared/smsReplyPlan.ts, 'waitlist_accept'): nothing books itself.
--
-- What it does
--   1. diary_waiting_list: per practice and patient (one open entry per patient): the practitioner asked for (or
--      any), the appointment type and length needed, the days of the week (0 = Sunday ... 6 = Saturday, none = any
--      day) and the earliest and latest time that suit, the last day the patient waits (at most a year ahead), the
--      booking they would like earlier, a note, and where it stands: waiting, offered (the day, time and practitioner
--      offered, when and by whom), booked (the new booking) or removed.
--   2. Functions (SECURITY DEFINER, search_path public) for active staff of the patient's practice, any role
--      (reception keeps the list): save_waiting_list_entry (add or change), record_waiting_list_offer (after the
--      offer went out by SMS or by phone) and close_waiting_list_entry (booked, with the booking; or removed).
--      diary_waiting_list_practice_for is the internal membership check. Rows are never deleted.
--   3. Row level security: staff of the practice read; nobody writes directly; the patient app's logins get nothing
--      (portal_staff_only, as on every OneHealth table).
--   4. Checks after.
--   The offer itself is an SMS through centralized-sms-gateway (src/services/communicationService.ts), sent by staff
--   from the diary after they confirm the number and the text, as an appointment message marked
--   metadata.source 'waitlist_offer' (smsMessagePolicy.ts WAITLIST_OFFER_MARKERS), so the reply reaches the SMS
--   Replies inbox for staff. Nothing here sends anything.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Needs ar_today() (proposals/2026-10-07-receipts-and-allocations.sql) and diary_appointment_types
-- (proposals/2026-10-12-diary-statuses-and-types.sql). Until then Diary > More > Waiting list says it is not set up yet.
-- Undo:
--   DROP FUNCTION IF EXISTS public.close_waiting_list_entry(uuid, text, uuid), public.record_waiting_list_offer(uuid, date, time, uuid),
--     public.save_waiting_list_entry(uuid, jsonb), public.diary_waiting_list_practice_for(uuid);
--   DROP TABLE IF EXISTS public.diary_waiting_list;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.practices'), ('public.patients'), ('public.visits'), ('public.users'), ('public.diary_appointment_types')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %', v_missing;
  END IF;
  IF to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: ar_today() is missing; apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. diary_waiting_list
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diary_waiting_list (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id             uuid NOT NULL,
  patient_id              uuid NOT NULL,
  -- null: any practitioner
  practitioner_id         uuid,
  appointment_type_id     uuid,
  length_minutes          smallint NOT NULL DEFAULT 15,
  -- Days of the week that suit (0 = Sunday ... 6 = Saturday, as src/utils/diary/diaryTime.ts weekdayOfKey); empty = any
  preferred_days          smallint[] NOT NULL DEFAULT '{}',
  preferred_from          time,
  preferred_to            time,
  -- The last day the patient waits
  wait_until              date NOT NULL,
  -- The booking the patient would like earlier, when they have one
  current_visit_id        uuid,
  note                    text,
  status                  text NOT NULL DEFAULT 'waiting',
  offered_date            date,
  offered_time            time,
  offered_practitioner_id uuid,
  offered_at              timestamptz,
  offered_by              uuid,
  booked_visit_id         uuid,
  closed_at               timestamptz,
  closed_by               uuid,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diary_waiting_list_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT diary_waiting_list_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT diary_waiting_list_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES public.diary_appointment_types(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_current_visit_id_fkey FOREIGN KEY (current_visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_booked_visit_id_fkey FOREIGN KEY (booked_visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_offered_practitioner_id_fkey FOREIGN KEY (offered_practitioner_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_offered_by_fkey FOREIGN KEY (offered_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_waiting_list_status_check CHECK (status IN ('waiting', 'offered', 'booked', 'removed')),
  -- Same limits as visits_duration_minutes_check
  CONSTRAINT diary_waiting_list_length_check CHECK (length_minutes BETWEEN 5 AND 480),
  CONSTRAINT diary_waiting_list_days_check CHECK (
    preferred_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[] AND cardinality(preferred_days) <= 7 AND array_position(preferred_days, NULL) IS NULL),
  CONSTRAINT diary_waiting_list_times_check CHECK (preferred_from IS NULL OR preferred_to IS NULL OR preferred_to > preferred_from),
  CONSTRAINT diary_waiting_list_note_check CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 300),
  CONSTRAINT diary_waiting_list_offer_check CHECK (status <> 'offered' OR (offered_date IS NOT NULL AND offered_time IS NOT NULL)),
  CONSTRAINT diary_waiting_list_closed_check CHECK ((status IN ('booked', 'removed')) = (closed_at IS NOT NULL)),
  CONSTRAINT diary_waiting_list_booked_check CHECK (booked_visit_id IS NULL OR status = 'booked')
);

-- One open entry per patient in a practice (a merge of two files keeps the second one with the archived file)
CREATE UNIQUE INDEX IF NOT EXISTS diary_waiting_list_open_key ON public.diary_waiting_list (practice_id, patient_id)
  WHERE status IN ('waiting', 'offered');
CREATE INDEX IF NOT EXISTS diary_waiting_list_practice_idx ON public.diary_waiting_list (practice_id, status, wait_until);
CREATE INDEX IF NOT EXISTS diary_waiting_list_patient_idx ON public.diary_waiting_list (patient_id);

COMMENT ON TABLE public.diary_waiting_list IS
  'Patients waiting for an earlier time in the diary (practitioner, days, times, until when) and the offers made to them. Changed only through save_waiting_list_entry, record_waiting_list_offer and close_waiting_list_entry. See proposals/2026-10-13-diary-waiting-list.sql.';

-- ---------------------------------------------------------------------------------------------
-- 2. Functions
-- ---------------------------------------------------------------------------------------------

-- 2a. The patient's practice, when the signed-in user is active staff of it; raises otherwise. auth.uid() is NULL in
--     the SQL editor and for the service role, so they cannot use these functions.
CREATE OR REPLACE FUNCTION public.diary_waiting_list_practice_for(p_patient_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = p_patient_id;
  IF auth.uid() IS NULL OR v_practice IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = v_practice
  ) THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can change the waiting list' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- 2b. save_waiting_list_entry(entry id or null, {patient_id, practitioner_id?, appointment_type_id?, length_minutes,
--     preferred_days, preferred_from?, preferred_to?, wait_until, current_visit_id?, note?}): adds a patient to the
--     list or changes their open entry. The same checks as validateWaitingListDraft in src/utils/diary/waitingList.ts.
CREATE OR REPLACE FUNCTION public.save_waiting_list_entry(p_entry_id uuid, p_entry jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.diary_waiting_list%ROWTYPE;
  v_patient uuid;
  v_practice uuid;
  v_practitioner uuid := NULLIF(p_entry ->> 'practitioner_id', '')::uuid;
  v_type uuid := NULLIF(p_entry ->> 'appointment_type_id', '')::uuid;
  v_current uuid := NULLIF(p_entry ->> 'current_visit_id', '')::uuid;
  v_length integer := COALESCE(NULLIF(p_entry ->> 'length_minutes', '')::integer, 15);
  v_from time := NULLIF(p_entry ->> 'preferred_from', '')::time;
  v_to time := NULLIF(p_entry ->> 'preferred_to', '')::time;
  v_until date := NULLIF(p_entry ->> 'wait_until', '')::date;
  v_note text := NULLIF(btrim(COALESCE(p_entry ->> 'note', '')), '');
  v_days smallint[];
  v_today date := public.ar_today();
  v_id uuid;
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'Give the waiting list entry' USING ERRCODE = '22023';
  END IF;
  IF p_entry_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.diary_waiting_list WHERE id = p_entry_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This waiting list entry was not found' USING ERRCODE = 'P0002';
    END IF;
    v_patient := v_existing.patient_id;
  ELSE
    v_patient := NULLIF(p_entry ->> 'patient_id', '')::uuid;
  END IF;
  v_practice := public.diary_waiting_list_practice_for(v_patient);

  IF p_entry_id IS NOT NULL AND v_existing.status NOT IN ('waiting', 'offered') THEN
    RAISE EXCEPTION 'This patient was booked or taken off the waiting list: add them again instead' USING ERRCODE = '22023';
  END IF;
  IF p_entry_id IS NULL AND EXISTS (
    SELECT 1 FROM public.diary_waiting_list w
     WHERE w.practice_id = v_practice AND w.patient_id = v_patient AND w.status IN ('waiting', 'offered')
  ) THEN
    RAISE EXCEPTION 'This patient is already on the waiting list: change their entry instead' USING ERRCODE = '23505';
  END IF;

  IF v_length NOT BETWEEN 5 AND 480 THEN
    RAISE EXCEPTION 'Choose a length of 5 to 480 minutes' USING ERRCODE = '22023';
  END IF;
  IF p_entry ? 'preferred_days' AND jsonb_typeof(p_entry -> 'preferred_days') <> 'array' THEN
    RAISE EXCEPTION 'Give the days of the week as a list' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_entry -> 'preferred_days', '[]'::jsonb)) AS d
              WHERE d.value !~ '^[0-6]$') THEN
    RAISE EXCEPTION 'Days of the week are 0 (Sunday) to 6 (Saturday)' USING ERRCODE = '22023';
  END IF;
  v_days := ARRAY(SELECT DISTINCT d.value::smallint FROM jsonb_array_elements_text(COALESCE(p_entry -> 'preferred_days', '[]'::jsonb)) AS d
                   ORDER BY 1);
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_to - v_from < make_interval(mins => GREATEST(v_length, 5)) THEN
    RAISE EXCEPTION 'The latest time must leave room for the whole appointment after the earliest time' USING ERRCODE = '22023';
  END IF;
  IF v_until IS NULL THEN
    RAISE EXCEPTION 'Choose until when the patient waits' USING ERRCODE = '22023';
  END IF;
  IF v_until < v_today THEN
    RAISE EXCEPTION 'The last day to wait cannot be in the past' USING ERRCODE = '22023';
  END IF;
  IF v_until > v_today + 365 THEN
    RAISE EXCEPTION 'A patient can wait at most a year: choose an earlier last day' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 300 THEN
    RAISE EXCEPTION 'Keep the note to 300 characters' USING ERRCODE = '22023';
  END IF;
  IF v_practitioner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_practitioner AND u.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose a practitioner of your practice' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.diary_appointment_types t WHERE t.id = v_type AND t.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose one of your practice''s appointment types' USING ERRCODE = '22023';
  END IF;
  IF v_current IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.visits v
     WHERE v.id = v_current AND v.patient_id = v_patient AND v.practice_id = v_practice
       AND NOT COALESCE(v.is_cancelled, false) AND COALESCE(v.status, '') NOT IN ('cancelled', 'no-show', 'completed')
  ) THEN
    RAISE EXCEPTION 'The booking to move earlier must be one of this patient''s bookings that is still to come' USING ERRCODE = '22023';
  END IF;

  IF p_entry_id IS NULL THEN
    INSERT INTO public.diary_waiting_list (
      practice_id, patient_id, practitioner_id, appointment_type_id, length_minutes, preferred_days, preferred_from, preferred_to,
      wait_until, current_visit_id, note, created_by, updated_by
    ) VALUES (
      v_practice, v_patient, v_practitioner, v_type, v_length, v_days, v_from, v_to, v_until, v_current, v_note, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.diary_waiting_list
     SET practitioner_id = v_practitioner, appointment_type_id = v_type, length_minutes = v_length, preferred_days = v_days,
         preferred_from = v_from, preferred_to = v_to, wait_until = v_until, current_visit_id = v_current, note = v_note,
         updated_by = auth.uid(), updated_at = now()
   WHERE id = p_entry_id;
  RETURN p_entry_id;
END
$$;

-- 2c. record_waiting_list_offer(entry, day, time, practitioner): the time offered (after the SMS went out or the
--     patient was phoned). The entry stays on the list until it is booked or removed: a patient may say no.
CREATE OR REPLACE FUNCTION public.record_waiting_list_offer(p_entry_id uuid, p_date date, p_time time, p_practitioner_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.diary_waiting_list%ROWTYPE;
  v_practice uuid;
BEGIN
  SELECT * INTO v_entry FROM public.diary_waiting_list WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This waiting list entry was not found' USING ERRCODE = 'P0002';
  END IF;
  v_practice := public.diary_waiting_list_practice_for(v_entry.patient_id);
  IF v_entry.status NOT IN ('waiting', 'offered') THEN
    RAISE EXCEPTION 'This patient was booked or taken off the waiting list' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_time IS NULL THEN
    RAISE EXCEPTION 'Say which day and time was offered' USING ERRCODE = '22023';
  END IF;
  IF p_date < public.ar_today() THEN
    RAISE EXCEPTION 'The time offered has passed' USING ERRCODE = '22023';
  END IF;
  IF p_date > v_entry.wait_until THEN
    RAISE EXCEPTION 'The patient waits only until %', to_char(v_entry.wait_until, 'FMDD Mon YYYY') USING ERRCODE = '22023';
  END IF;
  IF p_practitioner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_practitioner_id AND u.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose a practitioner of your practice' USING ERRCODE = '22023';
  END IF;
  UPDATE public.diary_waiting_list
     SET status = 'offered', offered_date = p_date, offered_time = p_time, offered_practitioner_id = p_practitioner_id,
         offered_at = now(), offered_by = auth.uid(), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_entry_id;
END
$$;

-- 2d. close_waiting_list_entry(entry, 'booked' with the patient's new booking, or 'removed')
CREATE OR REPLACE FUNCTION public.close_waiting_list_entry(p_entry_id uuid, p_outcome text, p_visit_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.diary_waiting_list%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.diary_waiting_list WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This waiting list entry was not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.diary_waiting_list_practice_for(v_entry.patient_id);
  IF p_outcome IS NULL OR p_outcome NOT IN ('booked', 'removed') THEN
    RAISE EXCEPTION 'An entry is closed as booked or removed' USING ERRCODE = '22023';
  END IF;
  IF v_entry.status NOT IN ('waiting', 'offered') THEN
    RAISE EXCEPTION 'This patient was already booked or taken off the waiting list' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'booked' THEN
    IF p_visit_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.visits v
       WHERE v.id = p_visit_id AND v.patient_id = v_entry.patient_id AND v.practice_id = v_entry.practice_id
         AND NOT COALESCE(v.is_cancelled, false) AND COALESCE(v.status, '') <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Choose the patient''s new booking' USING ERRCODE = '22023';
    END IF;
  ELSIF p_visit_id IS NOT NULL THEN
    RAISE EXCEPTION 'An entry taken off the list has no booking' USING ERRCODE = '22023';
  END IF;
  UPDATE public.diary_waiting_list
     SET status = p_outcome, booked_visit_id = CASE WHEN p_outcome = 'booked' THEN p_visit_id END,
         closed_at = now(), closed_by = auth.uid(), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_entry_id;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Row level security and grants: active staff of the practice read; nobody writes except through the functions
--    above (and the service role); the patient app's logins get nothing
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.diary_waiting_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_waiting_list_staff_read ON public.diary_waiting_list;
CREATE POLICY diary_waiting_list_staff_read ON public.diary_waiting_list FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = diary_waiting_list.practice_id));

REVOKE ALL ON public.diary_waiting_list FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diary_waiting_list TO authenticated;
GRANT ALL ON public.diary_waiting_list TO service_role;

-- Internal: the membership check
REVOKE ALL ON FUNCTION public.diary_waiting_list_practice_for(uuid) FROM PUBLIC, anon, authenticated;
-- What the app calls
REVOKE ALL ON FUNCTION public.save_waiting_list_entry(uuid, jsonb), public.record_waiting_list_offer(uuid, date, time, uuid),
  public.close_waiting_list_entry(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_waiting_list_entry(uuid, jsonb), public.record_waiting_list_offer(uuid, date, time, uuid),
  public.close_waiting_list_entry(uuid, text, uuid) TO authenticated, service_role;

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.diary_waiting_list;
    CREATE POLICY portal_staff_only ON public.diary_waiting_list AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after: row level security on, one staff read policy and the portal's guard, none for anon; signed-in
--    users read but do not write; anon runs nothing; the membership check is internal; functions are SECURITY DEFINER
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.diary_waiting_list'::regclass) THEN
    RAISE EXCEPTION 'check failed: row level security is off on diary_waiting_list';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'diary_waiting_list' AND policyname = 'diary_waiting_list_staff_read') <> 1 THEN
    RAISE EXCEPTION 'check failed: the staff read policy is missing';
  END IF;
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'diary_waiting_list'
                      AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'check failed: the patient app''s staff-only guard is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'diary_waiting_list' AND 'anon' = ANY (roles)) THEN
    RAISE EXCEPTION 'check failed: a policy is open to anon';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.diary_waiting_list', 'SELECT')
     OR has_table_privilege('authenticated', 'public.diary_waiting_list', 'INSERT')
     OR has_table_privilege('authenticated', 'public.diary_waiting_list', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.diary_waiting_list', 'DELETE')
     OR has_table_privilege('anon', 'public.diary_waiting_list', 'SELECT') THEN
    RAISE EXCEPTION 'check failed: signed-in users must read only, anon nothing';
  END IF;
  IF has_function_privilege('anon', 'public.save_waiting_list_entry(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.record_waiting_list_offer(uuid, date, time, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.close_waiting_list_entry(uuid, text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.diary_waiting_list_practice_for(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.save_waiting_list_entry(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: function grants';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname IN ('diary_waiting_list_practice_for', 'save_waiting_list_entry', 'record_waiting_list_offer', 'close_waiting_list_entry')
                AND (NOT p.prosecdef OR NOT (p.proconfig @> ARRAY['search_path=public']))) THEN
    RAISE EXCEPTION 'check failed: every waiting list function is SECURITY DEFINER with search_path public';
  END IF;
END $$;

ROLLBACK;
