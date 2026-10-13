-- Applied 2026-10-12 as migration diary_free_slots_2026_10_12 (version 20261012172058; stored statement md5 79020c619445bde8eb8d4adb8686307c = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 of diary_free_slots afterwards d4fb3a2c3ef48cb241e586aea8eb2a81 (SECURITY DEFINER; anon cannot run it).
-- Rehearsed with simulated logins on an invented practice (rolled back), every result as worked out by hand from the
-- app's rules: a 20-minute practitioner working Tuesdays 08:00-12:00 (break 10:00-10:30) with a 25-minute booking at
-- 08:00, a meeting 11:00-11:30 and the practice's weekly tea 09:45-10:00 got 08:40 and 09:00 for a consultation; a
-- colleague on the opening hours (Tuesday 08:00-10:00, 15-minute starts) with a follow-up at 08:30 (its 15 minutes)
-- and a cancelled 09:00 got 08:00, 08:45, 09:00, 09:15; "New patient" (40 min, at most 1 a day) gave the first
-- practitioner nothing on a day he had one and the colleague 08:00-09:00; a public holiday (10 Dec 2026) 0, the next
-- Thursday 7, a Monday marked closed 0, a day missing from the opening hours 0, nothing in the past; 32 days, another
-- practice's type or practitioner refused (22023); another practice's doctor and the public key refused (42501). The
-- holidays of 2026, 2027 and 2028 are the dates src/utils/hr/namibiaHolidays.ts lists.
-- =============================================================================================
-- PROPOSAL: the free times of a practice's diary, per practitioner and appointment type (parity B15, first step)
-- File:   proposals/2026-10-12-diary-free-slots.sql                    Drafted: 2026-10-12
-- Code:   the same rules in the app: src/utils/diary/nextFreeSlot.ts (findNextFreeSlot), workingHours.ts,
--         blockedTime.ts, bookingLength.ts, slotLength.ts, appointmentTypes.ts and src/utils/hr/namibiaHolidays.ts
--
-- Why (parity B15): the website booking widget (hpms-landing/src/components/EnhancedBookingWidget.tsx) offers every
-- 30-minute slot without reading the diary, so a patient can ask for a time that is taken, a lunch break or a public
-- holiday. diary_free_slots() works the free times out on the server, from the same rules the diary uses, so the
-- widget can show only real ones later.
--
-- What it does (read only; nothing is written, no table or policy changes)
--   1. diary_clock_minutes('08:30') = 510, as the app reads a time ('HH:mm', 'HH:mm:ss'); null when it is not one.
--   2. diary_type_length(type_lengths, visit_type): the practice's length for a visit type (consultation's for an
--      unknown type; 30/15/30/30 when none is saved), as bookingLength.ts defaultLengthFor.
--   3. diary_public_holidays(year): Namibia's public holidays, the list src/utils/hr/namibiaHolidays.ts keeps (Easter
--      by the anonymous Gregorian algorithm, a Sunday holiday moved to the Monday).
--   4. diary_free_slots(practice, from, days, practitioner, appointment type, visit type): every free start time,
--      from today on (from now on today, Windhoek time), for the practitioner asked for or every practitioner with a
--      diary column (active doctors and anyone with working hours). Per practitioner and day: their working hours
--      (else the practice's opening hours; Monday to Friday 08:00-17:00 when none are saved), less breaks, the time
--      between two branches, blocked time (theirs and the practice's), bookings that still hold their slot (each as
--      long as it was booked) and public holidays; start times at the practitioner's diary slot (else every 15
--      minutes); the appointment type's length, and no times on a day the practitioner already has the type's daily
--      limit. At most 31 days per call.
--   Who may call it: signed-in staff of the practice and OneHealth support. The public key may not (42501).
--
-- What the public booking widget would still need (not in this file): a practice switch for online booking and a
-- "book online" flag per appointment type and practitioner; an anon-callable wrapper that takes the practice's public
-- slug, returns only dates, times and practitioner names (never ids of patients or bookings), limits how far ahead
-- (for example 4 weeks) and how often it is called; and submit-booking checking the chosen time again with this
-- function before it creates the request (two patients can pick the same time).
--
-- Needs: proposals/2026-10-12-diary-statuses-and-types.sql (appointment types, practitioner slots), diary-2 (working
-- hours, diary_settings), diary (diary_blocks), practice isolation's rls_my_practice_id() and rls_is_super_admin().
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. The app does not call it yet.
-- Undo:  DROP FUNCTION IF EXISTS public.diary_free_slots(uuid, date, integer, uuid, uuid, text);
--        DROP FUNCTION IF EXISTS public.diary_public_holidays(integer);
--        DROP FUNCTION IF EXISTS public.diary_type_length(jsonb, text);
--        DROP FUNCTION IF EXISTS public.diary_clock_minutes(text);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. A time of day as minutes since midnight (src/utils/diary/diaryTime.ts timeToMinutes)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.diary_clock_minutes(p_time text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN m IS NULL THEN NULL
           WHEN m[2]::integer > 59 OR m[1]::integer > 24 OR (m[1]::integer = 24 AND m[2]::integer > 0) THEN NULL
           ELSE m[1]::integer * 60 + m[2]::integer
         END
  FROM (SELECT regexp_match(btrim(p_time), '^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$') AS m) AS parsed
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. The practice's length for a visit type (src/utils/diary/bookingLength.ts normalizeTypeLengths, defaultLengthFor)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.diary_type_length(p_lengths jsonb, p_visit_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           -- Two steps: a text value cannot be cast, and SQL does not promise to stop at the first false AND
           WHEN jsonb_typeof(p_lengths -> t) = 'number' THEN
             CASE WHEN (p_lengths ->> t)::numeric BETWEEN 5 AND 480 AND (p_lengths ->> t)::numeric = trunc((p_lengths ->> t)::numeric)
                  THEN (p_lengths ->> t)::integer
                  ELSE ('{"consultation": 30, "follow-up": 15, "procedure": 30, "emergency": 30}'::jsonb ->> t)::integer
             END
           ELSE ('{"consultation": 30, "follow-up": 15, "procedure": 30, "emergency": 30}'::jsonb ->> t)::integer
         END
  FROM (SELECT CASE WHEN p_visit_type IN ('consultation', 'follow-up', 'procedure', 'emergency') THEN p_visit_type ELSE 'consultation' END AS t) AS chosen
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Namibia's public holidays (src/utils/hr/namibiaHolidays.ts: Public Holidays Act 26 of 1990, Genocide
--    Remembrance Day from 2025; the Monday after a Sunday holiday, unless it already is one)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.diary_public_holidays(p_year integer)
RETURNS TABLE (holiday date, name text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  -- Easter Sunday by the anonymous Gregorian algorithm (namibiaHolidays.ts easterSunday)
  a integer := p_year % 19;
  b integer := p_year / 100;
  c integer := p_year % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
  v_easter date := make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
BEGIN
  RETURN QUERY
  WITH listed (holiday, name) AS (
    VALUES
      (make_date(p_year, 1, 1), 'New Year''s Day'),
      (make_date(p_year, 3, 21), 'Independence Day'),
      (make_date(p_year, 5, 1), 'Workers'' Day'),
      (make_date(p_year, 5, 4), 'Cassinga Day'),
      (make_date(p_year, 5, 25), 'Africa Day'),
      (make_date(p_year, 8, 26), 'Heroes'' Day'),
      (make_date(p_year, 12, 10), 'Day of the Namibian Women and International Human Rights Day'),
      (make_date(p_year, 12, 25), 'Christmas Day'),
      (make_date(p_year, 12, 26), 'Family Day'),
      (v_easter - 2, 'Good Friday'),
      (v_easter + 1, 'Easter Monday'),
      (v_easter + 39, 'Ascension Day')
  ),
  base AS (
    SELECT listed.holiday, listed.name FROM listed
    UNION ALL
    SELECT make_date(p_year, 5, 28), 'Genocide Remembrance Day' WHERE p_year >= 2025
  )
  SELECT base.holiday, base.name FROM base
  UNION ALL
  SELECT base.holiday + 1, base.name || ' (observed)'
    FROM base
   WHERE extract(dow FROM base.holiday) = 0
     AND NOT EXISTS (SELECT 1 FROM base AS other WHERE other.holiday = base.holiday + 1)
  ORDER BY 1, 2;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The free start times
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.diary_free_slots(
  p_practice_id uuid,
  p_from date,
  p_days integer DEFAULT 7,
  p_practitioner_id uuid DEFAULT NULL,
  p_appointment_type_id uuid DEFAULT NULL,
  p_visit_type text DEFAULT NULL
)
RETURNS TABLE (practitioner_id uuid, slot_date date, slot_time time, length_minutes integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Windhoek')::date;
  v_now integer := extract(hour FROM now() AT TIME ZONE 'Africa/Windhoek')::integer * 60
                   + extract(minute FROM now() AT TIME ZONE 'Africa/Windhoek')::integer;
  v_lengths jsonb;
  v_slots jsonb;
  v_business jsonb;
  v_type public.diary_appointment_types;
  v_visit_type text := COALESCE(p_visit_type, 'consultation');
  v_length integer;
  v_first_day date;
  v_day date;
  v_practitioner uuid;
  v_step integer;
  v_has_hours boolean;
  v_open integer;
  v_close integer;
  v_entry jsonb;
  v_busy int4range[];
  v_start integer;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.rls_is_super_admin() OR public.rls_my_practice_id() IS NOT DISTINCT FROM p_practice_id) THEN
    RAISE EXCEPTION 'Only staff of the practice can see its free times.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR p_from IS NULL OR p_days IS NULL OR p_days NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Ask for 1 to 31 days from a start date.' USING ERRCODE = '22023';
  END IF;
  IF p_practitioner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_practitioner_id AND u.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'That practitioner is not in the practice.' USING ERRCODE = '22023';
  END IF;

  SELECT s.type_lengths, s.practitioner_slots INTO v_lengths, v_slots FROM public.diary_settings s WHERE s.practice_id = p_practice_id;
  v_lengths := COALESCE(v_lengths, '{}'::jsonb);
  v_slots := COALESCE(v_slots, '{}'::jsonb);
  SELECT p.business_hours INTO v_business FROM public.practices p WHERE p.id = p_practice_id;

  -- The booking's length: the appointment type's, else the practice's length for the visit type
  IF p_appointment_type_id IS NOT NULL THEN
    SELECT t.* INTO v_type FROM public.diary_appointment_types t
     WHERE t.id = p_appointment_type_id AND t.practice_id = p_practice_id AND t.is_active;
    IF v_type.id IS NULL THEN
      RAISE EXCEPTION 'That appointment type is not one of this practice''s.' USING ERRCODE = '22023';
    END IF;
    v_length := v_type.length_minutes;
  ELSE
    IF v_visit_type NOT IN ('consultation', 'follow-up', 'procedure', 'emergency') THEN
      RAISE EXCEPTION 'Unknown visit type: %', v_visit_type USING ERRCODE = '22023';
    END IF;
    v_length := public.diary_type_length(v_lengths, v_visit_type);
  END IF;

  -- From today on, never in the past (findNextFreeSlotFor)
  v_first_day := greatest(p_from, v_today);

  -- The practitioner asked for, else every diary column (src/utils/diary/diaryPractitioners.ts): active doctors and
  -- anyone given working hours
  FOR v_practitioner IN
    SELECT u.id
      FROM public.users u
     WHERE u.practice_id = p_practice_id
       AND (p_practitioner_id IS NULL OR u.id = p_practitioner_id)
       AND (p_practitioner_id IS NOT NULL OR (
             COALESCE(u.is_active, true)
             AND (u.role = 'doctor' OR EXISTS (
                   SELECT 1 FROM public.doctor_branch_schedules s
                    WHERE s.doctor_id = u.id AND s.practice_id = p_practice_id AND s.is_active IS DISTINCT FROM false))))
     ORDER BY u.full_name, u.id
  LOOP
    -- Start times at the practitioner's diary slot, else every 15 minutes (slotLength.ts startStepFor)
    v_step := CASE
                WHEN jsonb_typeof(v_slots -> v_practitioner::text) = 'number' THEN
                  CASE WHEN (v_slots ->> v_practitioner::text)::numeric IN (10, 15, 20, 30, 60) THEN (v_slots ->> v_practitioner::text)::integer ELSE 15 END
                ELSE 15
              END;
    -- Saved working hours replace the opening hours, and a day without them is a day off (workingHours.ts)
    v_has_hours := EXISTS (
      SELECT 1 FROM public.doctor_branch_schedules s
       WHERE s.doctor_id = v_practitioner AND s.practice_id = p_practice_id AND s.is_active IS DISTINCT FROM false
         AND s.day_of_week BETWEEN 0 AND 6 AND s.end_time > s.start_time
    );

    FOR v_day IN SELECT generated::date FROM generate_series(v_first_day, v_first_day + (p_days - 1), interval '1 day') AS generated LOOP
      -- No times on a public holiday (the practice can still book one by hand)
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.diary_public_holidays(extract(year FROM v_day)::integer) hol WHERE hol.holiday = v_day);

      v_busy := ARRAY[]::int4range[];
      IF v_has_hours THEN
        SELECT min(extract(hour FROM s.start_time)::integer * 60 + extract(minute FROM s.start_time)::integer),
               max(extract(hour FROM s.end_time)::integer * 60 + extract(minute FROM s.end_time)::integer)
          INTO v_open, v_close
          FROM public.doctor_branch_schedules s
         WHERE s.doctor_id = v_practitioner AND s.practice_id = p_practice_id AND s.is_active IS DISTINCT FROM false
           AND s.day_of_week = extract(dow FROM v_day) AND s.end_time > s.start_time;
        CONTINUE WHEN v_open IS NULL;
        -- The break inside each stretch, and the time between two stretches (another branch)
        v_busy := v_busy || ARRAY(
          SELECT int4range(minutes.from_m, minutes.to_m)
            FROM (
              SELECT extract(hour FROM s.break_start)::integer * 60 + extract(minute FROM s.break_start)::integer AS from_m,
                     extract(hour FROM s.break_end)::integer * 60 + extract(minute FROM s.break_end)::integer AS to_m
                FROM public.doctor_branch_schedules s
               WHERE s.doctor_id = v_practitioner AND s.practice_id = p_practice_id AND s.is_active IS DISTINCT FROM false
                 AND s.day_of_week = extract(dow FROM v_day) AND s.end_time > s.start_time
                 AND s.break_start IS NOT NULL AND s.break_end IS NOT NULL
                 AND s.break_start > s.start_time AND s.break_end < s.end_time AND s.break_end > s.break_start
              UNION ALL
              SELECT stretch.to_m, stretch.next_from
                FROM (
                  SELECT extract(hour FROM s.end_time)::integer * 60 + extract(minute FROM s.end_time)::integer AS to_m,
                         lead(extract(hour FROM s.start_time)::integer * 60 + extract(minute FROM s.start_time)::integer)
                           OVER (ORDER BY s.start_time) AS next_from
                    FROM public.doctor_branch_schedules s
                   WHERE s.doctor_id = v_practitioner AND s.practice_id = p_practice_id AND s.is_active IS DISTINCT FROM false
                     AND s.day_of_week = extract(dow FROM v_day) AND s.end_time > s.start_time
                ) AS stretch
               WHERE stretch.next_from > stretch.to_m
            ) AS minutes
        );
      ELSIF v_business IS NULL OR jsonb_typeof(v_business) <> 'object' THEN
        -- What Settings shows a practice that has not saved its hours (nextFreeSlot.ts DEFAULT_WEEKDAY_HOURS)
        CONTINUE WHEN extract(dow FROM v_day) NOT BETWEEN 1 AND 5;
        v_open := 8 * 60;
        v_close := 17 * 60;
      ELSE
        v_entry := v_business -> (ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])[extract(dow FROM v_day)::integer + 1];
        CONTINUE WHEN v_entry IS NULL OR jsonb_typeof(v_entry) <> 'object';
        -- "closed" as the app reads it: any value that is not false, null, 0 or empty
        CONTINUE WHEN COALESCE(v_entry -> 'closed', 'false'::jsonb) NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb);
        v_open := public.diary_clock_minutes(v_entry ->> 'open');
        v_close := public.diary_clock_minutes(v_entry ->> 'close');
        CONTINUE WHEN v_open IS NULL OR v_close IS NULL OR v_close <= v_open;
      END IF;

      -- The type's daily limit: no times on a day the practitioner already has it (appointmentTypes.ts)
      IF v_type.daily_limit IS NOT NULL THEN
        SELECT count(*) INTO v_count
          FROM public.visits v
         WHERE v.practice_id = p_practice_id AND v.doctor_id = v_practitioner AND v.appointment_type_id = v_type.id
           AND COALESCE(v.scheduled_date, v.visit_date) = v_day
           AND NOT COALESCE(v.is_cancelled, false) AND COALESCE(v.status, '') NOT IN ('cancelled', 'no-show');
        CONTINUE WHEN v_count >= v_type.daily_limit;
      END IF;

      -- Blocked time that day: the practitioner's own and the practice's or a branch's (blockedTime.ts)
      v_busy := v_busy || ARRAY(
        SELECT CASE
                 WHEN b.start_time IS NOT NULL AND b.end_time IS NOT NULL AND b.end_time > b.start_time THEN
                   int4range(extract(hour FROM b.start_time)::integer * 60 + extract(minute FROM b.start_time)::integer,
                             extract(hour FROM b.end_time)::integer * 60 + extract(minute FROM b.end_time)::integer)
                 ELSE int4range(0, 24 * 60)
               END
          FROM public.diary_blocks b
         WHERE b.practice_id = p_practice_id
           AND (b.doctor_id IS NULL OR b.doctor_id = v_practitioner)
           AND (b.end_date IS NULL OR b.end_date >= b.start_date)
           AND v_day >= b.start_date
           AND (b.end_date IS NULL OR v_day <= b.end_date)
           AND CASE b.recurrence
                 WHEN 'weekdays' THEN extract(isodow FROM v_day) BETWEEN 1 AND 5
                 WHEN 'weekly' THEN extract(dow FROM v_day) = extract(dow FROM b.start_date)
                 WHEN 'daily' THEN true
                 -- One-off: its days, or its first day only when it has no last day
                 ELSE b.end_date IS NOT NULL OR v_day = b.start_date
               END
      );

      -- The practitioner's bookings that still hold their slot, each as long as it was booked (visitOverlap.ts)
      v_busy := v_busy || ARRAY(
        SELECT int4range(booked.from_m, booked.from_m + booked.length_m)
          FROM (
            SELECT extract(hour FROM COALESCE(v.scheduled_time, v.visit_time))::integer * 60
                     + extract(minute FROM COALESCE(v.scheduled_time, v.visit_time))::integer AS from_m,
                   CASE WHEN v.duration_minutes BETWEEN 5 AND 480 THEN v.duration_minutes
                        ELSE public.diary_type_length(v_lengths, v.visit_type) END AS length_m
              FROM public.visits v
             WHERE v.practice_id = p_practice_id AND v.doctor_id = v_practitioner
               AND COALESCE(v.scheduled_date, v.visit_date) = v_day
               AND COALESCE(v.scheduled_time, v.visit_time) IS NOT NULL
               AND NOT COALESCE(v.is_cancelled, false)
               AND COALESCE(v.status, '') NOT IN ('cancelled', 'no-show')
          ) AS booked
      );

      -- Every start on the slot that fits before the end of the day without touching any of it (nextFreeSlot.ts)
      v_start := (ceil(greatest(v_open, CASE WHEN v_day = v_today THEN v_now ELSE 0 END)::numeric / v_step) * v_step)::integer;
      WHILE v_start + v_length <= v_close LOOP
        IF NOT EXISTS (SELECT 1 FROM unnest(v_busy) AS busy WHERE busy && int4range(v_start, v_start + v_length)) THEN
          practitioner_id := v_practitioner;
          slot_date := v_day;
          slot_time := make_time(v_start / 60, v_start % 60, 0);
          length_minutes := v_length;
          RETURN NEXT;
        END IF;
        v_start := v_start + v_step;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.diary_free_slots(uuid, date, integer, uuid, uuid, text) IS
  'Free start times per practitioner (working hours, breaks, blocked time, bookings, public holidays, diary slot, the appointment type''s length and daily limit). Read only; staff of the practice and support. Rules mirror src/utils/diary/nextFreeSlot.ts.';

REVOKE ALL ON FUNCTION public.diary_clock_minutes(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.diary_type_length(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.diary_public_holidays(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.diary_free_slots(uuid, date, integer, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diary_clock_minutes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diary_type_length(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diary_public_holidays(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diary_free_slots(uuid, date, integer, uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only): who may call it, and the holidays of this year as the app lists them
-- ---------------------------------------------------------------------------------------------

SELECT has_function_privilege('anon', 'public.diary_free_slots(uuid, date, integer, uuid, uuid, text)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.diary_free_slots(uuid, date, integer, uuid, uuid, text)', 'EXECUTE') AS staff_run,
       (SELECT string_agg(DISTINCT hol.holiday::text, ',') FROM public.diary_public_holidays(2026) hol) AS holidays_2026;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
