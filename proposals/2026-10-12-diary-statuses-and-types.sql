-- Applied 2026-10-12 as migration diary_statuses_and_types_2026_10_12 (version 20261012163431; stored statement md5 ee1ede1a476f217bc7ab2da13e2b1266 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 of save_diary_settings afterwards db5752b86038cb9dd514b64c500daa9a.
-- Rehearsed with simulated logins on invented practices and staff (rolled back): the administrator saved
-- "  Waiting for X-ray " as "Waiting for X-ray", a second "waiting FOR x-ray" was refused (23505), an unknown colour or
-- stage and a 41-character name were refused (22023); a type "New patient", consultation, 45 min, at most 4 a day was
-- kept, a 3-minute length, a limit of 0, an unknown visit type and a duplicate name refused; a 15-minute slot was set,
-- kept when the lengths were saved, cleared with null, and 25 minutes, another practice's doctor and a non-id refused.
-- A receptionist read 2 statuses and 1 type, gave a booking a status and a type (1 row), and could not save, remove,
-- insert directly or set a slot (42501). Another practice's doctor read 0 and 0, could not save, could not put this
-- practice's status or type on their own booking (23503) or touch this practice's booking (0 rows). The public key
-- could neither read nor run anything (42501). A removed status stayed on its booking, its name could be used again,
-- and editing the removed one said so (P0002). 4 policies (2 reads, 2 portal guards). After applying: 0 bookings have
-- a status or type, anon reads nothing and runs nothing, staff cannot insert directly.
-- =============================================================================================
-- PROPOSAL: a practice's own booking statuses, appointment types with a length and a daily limit, and a diary slot
--           length per practitioner (parity B3 and B6)
-- File:   proposals/2026-10-12-diary-statuses-and-types.sql           Drafted: 2026-10-12
-- Code:   src/utils/diary/diaryStatuses.ts, appointmentTypes.ts, slotLength.ts (the rules, unit tested)
--         src/services/diaryStatusService.ts, appointmentTypeService.ts, diarySettingsService.ts, diaryService.ts
--         src/components/appointments/diary/DiaryStatusesTab.tsx, AppointmentTypesSection.tsx, DiarySettingsModal.tsx
--
-- Why (parity B3, B6): Eminance practices name their own coloured statuses ("Waiting for X-ray", "Called, no
-- answer") and give each practitioner a slot length and each appointment type a number of slots. OneHealth's stages
-- are fixed in code (src/utils/visitStage.ts), every grid row was 30 minutes and every booking type had one length.
--
-- What it does (additive: visits keeps its status values, visits_status_check and its policies are not touched)
--   1. diary_statuses: a practice's statuses, each with a name, one of 9 colours and the fixed stage it belongs to.
--      Billing, reminders and reports keep using the fixed stage; the status only adds words reception chooses.
--   2. diary_appointment_types: a practice's appointment types ("New patient"), each one of the four visit types
--      (visits_visit_type_check), with its own length and an optional limit per practitioner per day (the booking
--      form warns with "Book anyway"; nothing refuses a booking).
--   3. visits.diary_status_id and visits.appointment_type_id (null = none). Staff set them with their existing
--      right to update the practice's visits; a trigger refuses a status or type of another practice.
--   4. diary_settings.practitioner_slots: {"<users.id>": 15} (10, 15, 20, 30 or 60 minutes): the diary grids' rows,
--      the booking form's start times and "Next free slot" use it. save_diary_settings() accepts the key
--      (administrators); a practitioner without a slot keeps 30-minute rows and 15-minute start times.
--   5. RLS: staff of the practice (and OneHealth support) read the two tables; nobody writes them directly:
--      save_/remove_diary_status() and save_/remove_diary_appointment_type(), practice administrators only.
--      Removing switches a status or type off (bookings keep it, the report still counts it).
--   6. The patient app's staff-only guard, as on every OneHealth table.
--   Needs practice isolation's rls_is_super_admin() and rls_my_practice_id() (proposals/2026-10-07-practice-isolation.sql)
--   and diary_settings (proposals/2026-10-07-diary-2.sql).
--
-- How to apply: rehearse in a transaction that rolls back (section 7 reports the result), then apply the part between
-- BEGIN; and ROLLBACK; as one migration. Until then Diary settings says statuses and appointment types are not set
-- up yet, and the diary works as before.
-- Undo (bookings lose their status and type; the fixed stages and visit types are untouched):
--   DROP TRIGGER IF EXISTS visits_diary_refs_check ON public.visits;
--   DROP FUNCTION IF EXISTS public.visits_diary_refs_check();
--   ALTER TABLE public.visits DROP COLUMN IF EXISTS diary_status_id, DROP COLUMN IF EXISTS appointment_type_id;
--   DROP FUNCTION IF EXISTS public.save_diary_status(uuid, uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.remove_diary_status(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.save_diary_appointment_type(uuid, uuid, text, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.remove_diary_appointment_type(uuid, uuid);
--   DROP TABLE IF EXISTS public.diary_statuses, public.diary_appointment_types;
--   ALTER TABLE public.diary_settings DROP COLUMN IF EXISTS practitioner_slots;
--   and save_diary_settings() as proposals/2026-10-07-diary-2.sql section 3 has it.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. diary_statuses
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.diary_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40 AND name = btrim(name)),
  -- src/utils/diary/diaryStatuses.ts DIARY_STATUS_COLOURS
  colour text NOT NULL CHECK (colour IN ('blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple', 'gray')),
  -- src/utils/visitStage.ts VISIT_STAGES
  stage text NOT NULL CHECK (stage IN ('scheduled', 'checked-in', 'in-progress', 'handed-off', 'completed', 'no-show', 'cancelled')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Two statuses in use may not share a name (a removed one may)
CREATE UNIQUE INDEX IF NOT EXISTS diary_statuses_name_key ON public.diary_statuses (practice_id, lower(name)) WHERE is_active;

COMMENT ON TABLE public.diary_statuses IS
  'A practice''s own booking statuses (name, colour) on top of the fixed visit stages (src/utils/visitStage.ts). Changed only through save_diary_status / remove_diary_status (practice administrators).';
COMMENT ON COLUMN public.diary_statuses.stage IS
  'The fixed stage the status belongs to: the diary shows it while the booking is at that stage; billing, reminders and reports use the stage.';

-- ---------------------------------------------------------------------------------------------
-- 2. diary_appointment_types
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.diary_appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40 AND name = btrim(name)),
  -- The visit type the booking is saved with (visits_visit_type_check; src/utils/diary/bookingLength.ts VISIT_TYPES)
  visit_type text NOT NULL CHECK (visit_type IN ('consultation', 'follow-up', 'procedure', 'emergency')),
  -- Same limits as visits_duration_minutes_check
  length_minutes smallint NOT NULL CHECK (length_minutes BETWEEN 5 AND 480),
  -- At most this many bookings of the type per practitioner per day; null = no limit
  daily_limit smallint CHECK (daily_limit IS NULL OR daily_limit BETWEEN 1 AND 50),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS diary_appointment_types_name_key ON public.diary_appointment_types (practice_id, lower(name)) WHERE is_active;

COMMENT ON TABLE public.diary_appointment_types IS
  'A practice''s own appointment types: one of the four visit types with its own length and an optional daily limit per practitioner (warned, never refused). Changed only through save_diary_appointment_type / remove_diary_appointment_type (practice administrators).';

-- ---------------------------------------------------------------------------------------------
-- 3. A booking's status and appointment type (null = none). Adding nullable columns does not rewrite visits.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS diary_status_id uuid
  CONSTRAINT visits_diary_status_id_fkey REFERENCES public.diary_statuses(id) ON DELETE SET NULL;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS appointment_type_id uuid
  CONSTRAINT visits_appointment_type_id_fkey REFERENCES public.diary_appointment_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.visits.diary_status_id IS
  'The practice''s own status of the booking (diary_statuses); shown while the booking is at that status''s stage. visits.status stays the fixed stage.';
COMMENT ON COLUMN public.visits.appointment_type_id IS
  'The practice''s appointment type the booking was made as (diary_appointment_types); visit_type and duration_minutes hold what it set.';

-- The daily limit counts a practitioner's bookings of a type on a day
CREATE INDEX IF NOT EXISTS visits_appointment_type_day_idx ON public.visits (appointment_type_id, doctor_id, scheduled_date)
  WHERE appointment_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visits_diary_status_idx ON public.visits (diary_status_id) WHERE diary_status_id IS NOT NULL;

-- A status or type of another practice is refused (the foreign keys alone would accept any practice's)
CREATE OR REPLACE FUNCTION public.visits_diary_refs_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.diary_status_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.diary_statuses s WHERE s.id = NEW.diary_status_id AND s.practice_id = NEW.practice_id
  ) THEN
    RAISE EXCEPTION 'That booking status is not one of this practice''s.' USING ERRCODE = '23503';
  END IF;
  IF NEW.appointment_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.diary_appointment_types t WHERE t.id = NEW.appointment_type_id AND t.practice_id = NEW.practice_id
  ) THEN
    RAISE EXCEPTION 'That appointment type is not one of this practice''s.' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visits_diary_refs_check ON public.visits;
CREATE TRIGGER visits_diary_refs_check
  BEFORE INSERT OR UPDATE OF diary_status_id, appointment_type_id, practice_id ON public.visits
  FOR EACH ROW
  WHEN (NEW.diary_status_id IS NOT NULL OR NEW.appointment_type_id IS NOT NULL)
  EXECUTE FUNCTION public.visits_diary_refs_check();

REVOKE ALL ON FUNCTION public.visits_diary_refs_check() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Each practitioner's diary slot: diary_settings.practitioner_slots, saved by save_diary_settings()
--    (the function as proposals/2026-10-07-diary-2.sql has it, plus the 'practitioner_slots' key)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.diary_settings ADD COLUMN IF NOT EXISTS practitioner_slots jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.diary_settings DROP CONSTRAINT IF EXISTS diary_settings_practitioner_slots_check;
ALTER TABLE public.diary_settings ADD CONSTRAINT diary_settings_practitioner_slots_check CHECK (jsonb_typeof(practitioner_slots) = 'object');

COMMENT ON COLUMN public.diary_settings.practitioner_slots IS
  'Diary slot per practitioner in minutes, {"<users.id>": 15} (10, 15, 20, 30 or 60): grid rows, start times and "Next free slot". Missing = 30-minute rows and 15-minute start times. Rules: src/utils/diary/slotLength.ts.';

CREATE OR REPLACE FUNCTION public.save_diary_settings(p_practice_id uuid, p_settings jsonb)
RETURNS public.diary_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lengths jsonb := p_settings -> 'type_lengths';
  v_slots jsonb := p_settings -> 'practitioner_slots';
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

  -- Slot per practitioner: one of the lengths the app offers (slotLength.ts SLOT_LENGTH_OPTIONS); null clears it
  IF v_slots IS NOT NULL THEN
    IF jsonb_typeof(v_slots) <> 'object' THEN
      RAISE EXCEPTION 'Slot lengths must be given per practitioner.' USING ERRCODE = '22023';
    END IF;
    FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_slots) LOOP
      IF v_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Unknown practitioner: %', v_key USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_value) <> 'null' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_key::uuid AND u.practice_id = p_practice_id) THEN
          RAISE EXCEPTION 'This practitioner is not in the practice.' USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_value) <> 'number' THEN
          RAISE EXCEPTION 'A slot must be a number of minutes.' USING ERRCODE = '22023';
        END IF;
        IF (v_value #>> '{}')::numeric NOT IN (10, 15, 20, 30, 60) THEN
          RAISE EXCEPTION 'A slot must be 10, 15, 20, 30 or 60 minutes.' USING ERRCODE = '22023';
        END IF;
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
    -- Keys given replace the saved ones; a null value removes the practitioner's slot
    practitioner_slots       = COALESCE(jsonb_strip_nulls(s.practitioner_slots || v_slots), s.practitioner_slots),
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
  'Practice administrators save booking lengths, practitioner slots and reminder settings. Keys left out keep their value.';

-- ---------------------------------------------------------------------------------------------
-- 5. Who reads and who changes them
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.diary_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_appointment_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diary_statuses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.diary_appointment_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diary_statuses TO authenticated;
GRANT SELECT ON public.diary_appointment_types TO authenticated;
GRANT ALL ON public.diary_statuses TO service_role;
GRANT ALL ON public.diary_appointment_types TO service_role;

DROP POLICY IF EXISTS diary_statuses_read ON public.diary_statuses;
CREATE POLICY diary_statuses_read ON public.diary_statuses FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));
DROP POLICY IF EXISTS diary_appointment_types_read ON public.diary_appointment_types;
CREATE POLICY diary_appointment_types_read ON public.diary_appointment_types FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- Adds a status (p_status_id null) or changes one; practice administrators of that practice, or support
CREATE OR REPLACE FUNCTION public.save_diary_status(p_practice_id uuid, p_status_id uuid, p_name text, p_colour text, p_stage text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the booking statuses.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Name the status in 1 to 40 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_colour IS NULL OR p_colour NOT IN ('blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple', 'gray') THEN
    RAISE EXCEPTION 'Choose one of the colours.' USING ERRCODE = '22023';
  END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('scheduled', 'checked-in', 'in-progress', 'handed-off', 'completed', 'no-show', 'cancelled') THEN
    RAISE EXCEPTION 'Choose the step of the visit the status belongs to.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.diary_statuses s
     WHERE s.practice_id = p_practice_id AND s.is_active AND lower(s.name) = lower(v_name) AND s.id IS DISTINCT FROM p_status_id
  ) THEN
    RAISE EXCEPTION 'There is already a status called "%".', v_name USING ERRCODE = '23505';
  END IF;

  IF p_status_id IS NULL THEN
    IF (SELECT count(*) FROM public.diary_statuses s WHERE s.practice_id = p_practice_id AND s.is_active) >= 30 THEN
      RAISE EXCEPTION 'A practice can have 30 statuses: remove one first.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.diary_statuses (practice_id, name, colour, stage, created_by, updated_by)
    VALUES (p_practice_id, v_name, p_colour, p_stage, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.diary_statuses s
       SET name = v_name, colour = p_colour, stage = p_stage, updated_by = auth.uid(), updated_at = now()
     WHERE s.id = p_status_id AND s.practice_id = p_practice_id AND s.is_active
    RETURNING s.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'That status was removed or is not one of this practice''s.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Switches a status off: no longer offered; bookings keep it and the diary report still counts it
CREATE OR REPLACE FUNCTION public.remove_diary_status(p_practice_id uuid, p_status_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the booking statuses.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.diary_statuses
     SET is_active = false, updated_by = auth.uid(), updated_at = now()
   WHERE id = p_status_id AND practice_id = p_practice_id AND is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Adds an appointment type (p_type_id null) or changes one; practice administrators of that practice, or support
CREATE OR REPLACE FUNCTION public.save_diary_appointment_type(
  p_practice_id uuid,
  p_type_id uuid,
  p_name text,
  p_visit_type text,
  p_length integer,
  p_daily_limit integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the appointment types.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Name the appointment type in 1 to 40 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_visit_type IS NULL OR p_visit_type NOT IN ('consultation', 'follow-up', 'procedure', 'emergency') THEN
    RAISE EXCEPTION 'Choose what the appointment is billed and reported as.' USING ERRCODE = '22023';
  END IF;
  IF p_length IS NULL OR p_length NOT BETWEEN 5 AND 480 THEN
    RAISE EXCEPTION 'The length must be 5 to 480 minutes.' USING ERRCODE = '22023';
  END IF;
  IF p_daily_limit IS NOT NULL AND p_daily_limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'The daily limit must be 1 to 50 bookings, or none.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.diary_appointment_types t
     WHERE t.practice_id = p_practice_id AND t.is_active AND lower(t.name) = lower(v_name) AND t.id IS DISTINCT FROM p_type_id
  ) THEN
    RAISE EXCEPTION 'There is already an appointment type called "%".', v_name USING ERRCODE = '23505';
  END IF;

  IF p_type_id IS NULL THEN
    IF (SELECT count(*) FROM public.diary_appointment_types t WHERE t.practice_id = p_practice_id AND t.is_active) >= 30 THEN
      RAISE EXCEPTION 'A practice can have 30 appointment types: remove one first.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.diary_appointment_types (practice_id, name, visit_type, length_minutes, daily_limit, created_by, updated_by)
    VALUES (p_practice_id, v_name, p_visit_type, p_length, p_daily_limit, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.diary_appointment_types t
       SET name = v_name, visit_type = p_visit_type, length_minutes = p_length, daily_limit = p_daily_limit,
           updated_by = auth.uid(), updated_at = now()
     WHERE t.id = p_type_id AND t.practice_id = p_practice_id AND t.is_active
    RETURNING t.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'That appointment type was removed or is not one of this practice''s.' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Switches a type off: no longer offered; bookings made as it keep it
CREATE OR REPLACE FUNCTION public.remove_diary_appointment_type(p_practice_id uuid, p_type_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the appointment types.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.diary_appointment_types
     SET is_active = false, updated_by = auth.uid(), updated_at = now()
   WHERE id = p_type_id AND practice_id = p_practice_id AND is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_diary_status(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_diary_status(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_diary_appointment_type(uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_diary_appointment_type(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_diary_settings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_diary_status(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_diary_status(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_diary_appointment_type(uuid, uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_diary_appointment_type(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_diary_settings(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.diary_statuses';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.diary_statuses AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.diary_appointment_types';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.diary_appointment_types AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Result (read only): the policies, who may do what, and no booking given a status or type
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('diary_statuses', 'diary_appointment_types') ORDER BY tablename, policyname;

SELECT has_table_privilege('anon', 'public.diary_statuses', 'SELECT') AS anon_reads_statuses,
       has_table_privilege('authenticated', 'public.diary_statuses', 'INSERT') AS staff_insert_statuses_directly,
       has_table_privilege('authenticated', 'public.diary_appointment_types', 'UPDATE') AS staff_update_types_directly,
       has_function_privilege('anon', 'public.save_diary_status(uuid, uuid, text, text, text)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.save_diary_appointment_type(uuid, uuid, text, text, integer, integer)', 'EXECUTE') AS staff_run,
       (SELECT count(*) FROM public.visits WHERE diary_status_id IS NOT NULL OR appointment_type_id IS NOT NULL) AS bookings_with_status_or_type;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
