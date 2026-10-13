-- Applied 2026-10-09 as migration patient_notes_2026_10_08 (version 20261009003323; stored statement md5
-- e6f208a11c225dd56f399686b2cf0574 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins: a doctor wrote clinical, account and general notes and saw 3; a receptionist of the
-- same practice saw 2 (no clinical), was refused a clinical note (42501), a change to a locked note's text (55000)
-- and direct table writes (42501), and could move its follow-up, mark it done and add an addendum; an admin saw 2; a
-- doctor of another practice saw 0 and was refused every write (42501/P0002); the public key read nothing (42501);
-- a lock could not be taken off; a clinical follow-up could not go to a receptionist (22023).
-- Changed by 2026-10-08-patient-notes-practitioners.sql (applied 2026-10-09): clinical notes are also for staff with a
-- practitioner registration number, whatever their role (patient_note_types_for_role became patient_note_types_for_staff).
-- =============================================================================================
-- PROPOSAL: typed notes on the patient file, with a follow-up and an optional lock
-- File:   proposals/2026-10-08-patient-notes.sql                        Drafted: 2026-10-09
-- Code:   src/components/patients/notes/patientNotes.ts (the rules, unit tested; noteTypesFor is this file's
--         patient_note_types_for_role and a test compares them), src/services/patientNotesService.ts,
--         src/components/patients/notes/* (the Notes section on the patient file's Overview),
--         src/components/dashboard/FollowUpsDueDialog.tsx (the dashboard's "To Dos": follow-ups due)
--
-- Why (parity rows C1 and B22): Eminance practices write typed notes on the patient file (clinical, account, calls
-- and SMS, general) with a header, a follow-up and an optional password. OneHealth had visit notes, the short
-- clinical alert and credit-control contact notes only, and the dashboard's "To Dos" did nothing. This file adds:
--   * patient_notes: type, a short header, the text, an optional follow-up (date, and who follows up: one staff
--     member, or anyone who sees the note) and an optional lock;
--   * patient_note_addenda: dated additions under a note. A locked note's type, header and text never change (a
--     trigger refuses it, whoever asks); later changes are written as addenda, which never change either.
-- Notes that already exist elsewhere are not copied: credit-control notes stay in credit_control_notes (the app
-- lists them read-only beside these), visit notes on the visit, the clinical alert in patient_clinical_profiles.
--
-- Who may do what
--   * Staff of the patient's practice only (public.rls_my_practice_id(), from 2026-10-07-practice-isolation.sql).
--     Super admins are not included: clinical notes are clinical data.
--   * Clinical notes: practitioners and nurses (users.role doctor, nurse; the app's CLINICAL_ROLES). Account notes:
--     staff with billing rights (admin, doctor, nurse, receptionist; the app's BILLING_ROLES). Calls or SMS and
--     general notes: all staff. The same rule decides who reads a note, who writes one, who may be asked to follow
--     it up, and who sees its addenda.
--   * Writing goes through three functions that check the practice and the role and answer in plain words:
--     patient_note_save (write or change a note, its follow-up and its lock), patient_note_follow_up_done
--     (mark the follow-up done, or open it again) and patient_note_add_addendum. Signed-in users may only read
--     the tables; the public key reaches nothing. Nothing is deleted.
--   * The database stamps who wrote a note and when, who changed its text and when, who locked it, who marked the
--     follow-up done, and who added each addendum: never taken from the screen. The lock is never taken off.
--   * A follow-up can still be moved or marked done on a locked note (it is the to-do, not the record).
--   * The patient app's logins read none of it (portal_staff_only, when the patient-portal file is applied).
--
-- How to apply: rehearse (scripts/db/rehearsal.ts runs it in one rolled-back transaction), then apply the part
-- between BEGIN; and ROLLBACK; as a migration. Until then the Notes section and the dashboard's follow-ups say they
-- are not set up yet, and nothing else changes. Requires 2026-10-07-practice-isolation.sql (rls_my_practice_id).
-- Undo: at the end of the file.
-- =============================================================================================

BEGIN;
-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_my_practice_id()') IS NULL THEN
    RAISE EXCEPTION 'rls_my_practice_id() must exist first (2026-10-07-practice-isolation.sql)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. patient_notes
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL,
  patient_id         uuid NOT NULL,
  note_type          text NOT NULL,
  header             text NOT NULL,
  body               text NOT NULL,
  follow_up_on       date,
  follow_up_user_id  uuid,
  follow_up_done_at  timestamptz,
  follow_up_done_by  uuid,
  locked_at          timestamptz,
  locked_by          uuid,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  edited_by          uuid,
  edited_at          timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_notes_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_notes_follow_up_user_id_fkey FOREIGN KEY (follow_up_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_notes_follow_up_done_by_fkey FOREIGN KEY (follow_up_done_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_notes_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_notes_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_notes_note_type_check CHECK (note_type IN ('clinical', 'account', 'contact', 'general')),
  CONSTRAINT patient_notes_header_check CHECK (char_length(btrim(header)) BETWEEN 1 AND 80),
  CONSTRAINT patient_notes_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  -- Someone follows up on a day; a follow-up is done only when there is one
  CONSTRAINT patient_notes_follow_up_user_check CHECK (follow_up_user_id IS NULL OR follow_up_on IS NOT NULL),
  CONSTRAINT patient_notes_follow_up_done_check CHECK (follow_up_done_at IS NULL OR follow_up_on IS NOT NULL),
  -- A stamp's user may be deleted later: then only the time stays
  CONSTRAINT patient_notes_follow_up_done_by_check CHECK (follow_up_done_by IS NULL OR follow_up_done_at IS NOT NULL),
  CONSTRAINT patient_notes_locked_by_check CHECK (locked_by IS NULL OR locked_at IS NOT NULL),
  CONSTRAINT patient_notes_edited_by_check CHECK (edited_by IS NULL OR edited_at IS NOT NULL)
);
COMMENT ON TABLE public.patient_notes IS
  'Typed notes on the patient file (clinical, account, contact = call or SMS, general) with a follow-up and an optional lock. Written through patient_note_save; see proposals/2026-10-08-patient-notes.sql.';
COMMENT ON COLUMN public.patient_notes.note_type IS 'clinical (practitioners and nurses) | account (staff with billing rights) | contact (a call or SMS) | general.';
COMMENT ON COLUMN public.patient_notes.follow_up_user_id IS 'Who follows up; null = anyone who sees the note.';
COMMENT ON COLUMN public.patient_notes.locked_at IS 'Set once and never taken off: the type, header and text no longer change; later changes are addenda.';
COMMENT ON COLUMN public.patient_notes.edited_at IS 'When the type, header or text last changed (before the lock); null = as first written.';

CREATE INDEX IF NOT EXISTS patient_notes_patient_idx ON public.patient_notes (patient_id, created_at DESC);
-- The dashboard's follow-ups due: open follow-ups of a practice by day
CREATE INDEX IF NOT EXISTS patient_notes_open_follow_ups_idx ON public.patient_notes (practice_id, follow_up_on)
  WHERE follow_up_on IS NOT NULL AND follow_up_done_at IS NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. patient_note_addenda: dated additions under a note, never changed
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_note_addenda (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL,
  body        text NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_note_addenda_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.patient_notes(id) ON DELETE CASCADE,
  CONSTRAINT patient_note_addenda_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_note_addenda_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000)
);
COMMENT ON TABLE public.patient_note_addenda IS
  'Dated additions under a patient note (how a locked note is changed). Written through patient_note_add_addendum; never changed.';

CREATE INDEX IF NOT EXISTS patient_note_addenda_note_idx ON public.patient_note_addenda (note_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- 3. Who sees (and writes) which kind of note
-- ---------------------------------------------------------------------------------------------
-- By role: the app's noteTypesFor (src/components/patients/notes/patientNotes.ts; a unit test compares the two)
CREATE OR REPLACE FUNCTION public.patient_note_types_for_role(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE p_role
           WHEN 'doctor' THEN ARRAY['clinical', 'account', 'contact', 'general']
           WHEN 'nurse' THEN ARRAY['clinical', 'account', 'contact', 'general']
           WHEN 'admin' THEN ARRAY['account', 'contact', 'general']
           WHEN 'receptionist' THEN ARRAY['account', 'contact', 'general']
           ELSE ARRAY[]::text[]
         END
$$;

-- The caller's kinds of note (null when the caller is not active staff of a practice). Owner rights, like the
-- rls_* helpers: it reads the caller's own users row only.
CREATE OR REPLACE FUNCTION public.patient_note_types_i_see()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.patient_note_types_for_role(u.role)
    FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Triggers: the practice from the patient, who and when, the lock
-- ---------------------------------------------------------------------------------------------
-- 4a. Notes. auth.uid() is null in the SQL editor and for the service role: the stamps are then empty.
CREATE OR REPLACE FUNCTION public.patient_notes_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
  v_content_changed boolean;
BEGIN
  NEW.header := btrim(regexp_replace(COALESCE(NEW.header, ''), '\s+', ' ', 'g'));
  NEW.body := btrim(COALESCE(NEW.body, ''));
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    -- A note belongs to its patient's practice, whatever is sent
    SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = NEW.patient_id;
    IF v_practice IS NULL THEN
      RAISE EXCEPTION 'The patient was not found or has no practice' USING ERRCODE = '23514';
    END IF;
    NEW.practice_id := v_practice;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.edited_by := NULL;
    NEW.edited_at := NULL;
    NEW.locked_by := CASE WHEN NEW.locked_at IS NOT NULL THEN auth.uid() END;
    NEW.locked_at := CASE WHEN NEW.locked_at IS NOT NULL THEN now() END;
    NEW.follow_up_done_at := NULL;
    NEW.follow_up_done_by := NULL;
  ELSE
    -- A note never moves to another patient or practice, and keeps its author
    NEW.patient_id := OLD.patient_id;
    NEW.practice_id := OLD.practice_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    v_content_changed := NEW.note_type IS DISTINCT FROM OLD.note_type
      OR NEW.header IS DISTINCT FROM OLD.header
      OR NEW.body IS DISTINCT FROM OLD.body;

    -- The lock: a locked note's type, header and text never change, and the lock stays
    IF OLD.locked_at IS NOT NULL THEN
      IF v_content_changed THEN
        RAISE EXCEPTION 'This note is locked, so it cannot be changed. Add an addendum instead.' USING ERRCODE = '55000';
      END IF;
      NEW.locked_at := OLD.locked_at;
      NEW.locked_by := OLD.locked_by;
    ELSIF NEW.locked_at IS NOT NULL THEN
      NEW.locked_at := now();
      NEW.locked_by := auth.uid();
    ELSE
      NEW.locked_by := NULL;
    END IF;

    IF v_content_changed THEN
      NEW.edited_at := now();
      NEW.edited_by := auth.uid();
    ELSE
      NEW.edited_at := OLD.edited_at;
      NEW.edited_by := OLD.edited_by;
    END IF;

    -- Follow-up: a new day opens it again; marking it done stamps who and when
    IF NEW.follow_up_on IS DISTINCT FROM OLD.follow_up_on THEN
      NEW.follow_up_done_at := NULL;
      NEW.follow_up_done_by := NULL;
    ELSIF NEW.follow_up_done_at IS NOT NULL AND OLD.follow_up_done_at IS NULL THEN
      NEW.follow_up_done_at := now();
      NEW.follow_up_done_by := auth.uid();
    ELSIF NEW.follow_up_done_at IS NOT NULL THEN
      NEW.follow_up_done_at := OLD.follow_up_done_at;
      NEW.follow_up_done_by := OLD.follow_up_done_by;
    ELSE
      NEW.follow_up_done_by := NULL;
    END IF;
  END IF;

  -- No follow-up day: nobody follows up and nothing is done
  IF NEW.follow_up_on IS NULL THEN
    NEW.follow_up_user_id := NULL;
    NEW.follow_up_done_at := NULL;
    NEW.follow_up_done_by := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_notes_stamp ON public.patient_notes;
CREATE TRIGGER patient_notes_stamp BEFORE INSERT OR UPDATE ON public.patient_notes
  FOR EACH ROW EXECUTE FUNCTION public.patient_notes_stamp();

-- 4b. Addenda: who and when; an addendum never changes
CREATE OR REPLACE FUNCTION public.patient_note_addenda_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'An addendum cannot be changed. Add another addendum instead.' USING ERRCODE = '55000';
  END IF;
  NEW.body := btrim(COALESCE(NEW.body, ''));
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_note_addenda_stamp ON public.patient_note_addenda;
CREATE TRIGGER patient_note_addenda_stamp BEFORE INSERT OR UPDATE ON public.patient_note_addenda
  FOR EACH ROW EXECUTE FUNCTION public.patient_note_addenda_stamp();

-- ---------------------------------------------------------------------------------------------
-- 5. Writing: three functions that check the practice and the role
-- ---------------------------------------------------------------------------------------------
-- 5a. Write a note (p_note_id null) or change one: kind, header, text, follow-up and lock. On a locked note only the
--     follow-up changes (the trigger refuses the rest); a lock is never taken off.
CREATE OR REPLACE FUNCTION public.patient_note_save(
  p_note_id uuid,
  p_patient_id uuid,
  p_note_type text,
  p_header text,
  p_body text,
  p_follow_up_on date,
  p_follow_up_user_id uuid,
  p_lock boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_practice uuid := public.rls_my_practice_id();
  v_types text[] := COALESCE(public.patient_note_types_i_see(), ARRAY[]::text[]);
  v_header text := btrim(regexp_replace(COALESCE(p_header, ''), '\s+', ' ', 'g'));
  v_body text := btrim(COALESCE(p_body, ''));
  v_old public.patient_notes%ROWTYPE;
  v_role text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_practice IS NULL OR cardinality(v_types) = 0 THEN
    RAISE EXCEPTION 'Only staff of a practice can write patient notes.' USING ERRCODE = '42501';
  END IF;
  IF p_note_type IS NULL OR NOT (p_note_type = ANY (ARRAY['clinical', 'account', 'contact', 'general'])) THEN
    RAISE EXCEPTION 'Choose what kind of note this is.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_note_type = ANY (v_types)) THEN
    RAISE EXCEPTION '%', CASE p_note_type
                           WHEN 'clinical' THEN 'Only practitioners and nurses can write clinical notes.'
                           ELSE 'Only staff with billing rights can write account notes.'
                         END
      USING ERRCODE = '42501';
  END IF;
  IF v_header = '' THEN
    RAISE EXCEPTION 'Give the note a short header.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_header) > 80 THEN
    RAISE EXCEPTION 'Keep the header to 80 characters.' USING ERRCODE = '22023';
  END IF;
  IF v_body = '' THEN
    RAISE EXCEPTION 'Write the note first.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Keep the note to 4,000 characters.' USING ERRCODE = '22023';
  END IF;

  -- Who follows up: active staff of this practice who can see this kind of note
  IF p_follow_up_user_id IS NOT NULL THEN
    IF p_follow_up_on IS NULL THEN
      RAISE EXCEPTION 'Choose the follow-up date.' USING ERRCODE = '22023';
    END IF;
    SELECT u.role INTO v_role FROM public.users u
     WHERE u.id = p_follow_up_user_id AND u.practice_id = v_practice AND COALESCE(u.is_active, true);
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Choose someone who works at this practice to follow up.' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_note_type = ANY (public.patient_note_types_for_role(v_role))) THEN
      RAISE EXCEPTION '%', CASE p_note_type
                             WHEN 'clinical' THEN 'Only practitioners and nurses see clinical notes: choose one of them to follow up, or anyone.'
                             ELSE 'Only staff with billing rights see account notes: choose one of them to follow up, or anyone.'
                           END
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_note_id IS NULL THEN
    IF p_patient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = v_practice) THEN
      RAISE EXCEPTION 'This patient is not on your practice''s list.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.patient_notes (practice_id, patient_id, note_type, header, body, follow_up_on, follow_up_user_id, locked_at)
    VALUES (v_practice, p_patient_id, p_note_type, v_header, v_body, p_follow_up_on, p_follow_up_user_id,
            CASE WHEN COALESCE(p_lock, false) THEN now() END)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT * INTO v_old FROM public.patient_notes n WHERE n.id = p_note_id FOR UPDATE;
  IF NOT FOUND OR v_old.practice_id IS DISTINCT FROM v_practice OR NOT (v_old.note_type = ANY (v_types)) THEN
    RAISE EXCEPTION 'This note was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_patient_id IS NOT NULL AND p_patient_id <> v_old.patient_id THEN
    RAISE EXCEPTION 'A note stays on the patient file it was written on.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.patient_notes
     SET note_type = p_note_type,
         header = v_header,
         body = v_body,
         follow_up_on = p_follow_up_on,
         follow_up_user_id = p_follow_up_user_id,
         locked_at = CASE WHEN v_old.locked_at IS NOT NULL THEN v_old.locked_at
                          WHEN COALESCE(p_lock, false) THEN now() END
   WHERE id = p_note_id;
  RETURN p_note_id;
END;
$$;
COMMENT ON FUNCTION public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean) IS
  'Writes a patient note (p_note_id null) or changes one: kind, header, text, follow-up, lock. Staff of the patient''s practice whose role sees that kind of note.';

-- 5b. Mark a follow-up done (p_done true) or open it again (false). Also on a locked note.
CREATE OR REPLACE FUNCTION public.patient_note_follow_up_done(p_note_id uuid, p_done boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_practice uuid := public.rls_my_practice_id();
  v_types text[] := COALESCE(public.patient_note_types_i_see(), ARRAY[]::text[]);
  v_note public.patient_notes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_practice IS NULL OR cardinality(v_types) = 0 THEN
    RAISE EXCEPTION 'Only staff of a practice can change follow-ups.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_note FROM public.patient_notes n WHERE n.id = p_note_id FOR UPDATE;
  IF NOT FOUND OR v_note.practice_id IS DISTINCT FROM v_practice OR NOT (v_note.note_type = ANY (v_types)) THEN
    RAISE EXCEPTION 'This note was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_note.follow_up_on IS NULL THEN
    RAISE EXCEPTION 'This note has no follow-up.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.patient_notes
     SET follow_up_done_at = CASE WHEN COALESCE(p_done, true) THEN COALESCE(v_note.follow_up_done_at, now()) END
   WHERE id = p_note_id;
END;
$$;
COMMENT ON FUNCTION public.patient_note_follow_up_done(uuid, boolean) IS
  'Marks a patient note''s follow-up done (true) or open again (false); the database stamps who and when.';

-- 5c. Add a dated addendum under a note (the way a locked note is changed)
CREATE OR REPLACE FUNCTION public.patient_note_add_addendum(p_note_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_practice uuid := public.rls_my_practice_id();
  v_types text[] := COALESCE(public.patient_note_types_i_see(), ARRAY[]::text[]);
  v_body text := btrim(COALESCE(p_body, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_practice IS NULL OR cardinality(v_types) = 0 THEN
    RAISE EXCEPTION 'Only staff of a practice can add to patient notes.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.patient_notes n
     WHERE n.id = p_note_id AND n.practice_id = v_practice AND n.note_type = ANY (v_types)
  ) THEN
    RAISE EXCEPTION 'This note was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_body = '' THEN
    RAISE EXCEPTION 'Write the addendum first.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Keep the addendum to 4,000 characters.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.patient_note_addenda (note_id, body) VALUES (p_note_id, v_body) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.patient_note_add_addendum(uuid, text) IS
  'Adds a dated addendum under a patient note; the database stamps who and when. Addenda never change.';

-- ---------------------------------------------------------------------------------------------
-- 6. Row level security and grants: signed-in staff read what their role sees; writes go through section 5
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_note_addenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_notes_select ON public.patient_notes;
CREATE POLICY patient_notes_select ON public.patient_notes FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id())
         AND note_type = ANY ((SELECT public.patient_note_types_i_see())::text[]));

-- An addendum is seen with its note (the notes policy applies inside)
DROP POLICY IF EXISTS patient_note_addenda_select ON public.patient_note_addenda;
CREATE POLICY patient_note_addenda_select ON public.patient_note_addenda FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patient_notes n WHERE n.id = patient_note_addenda.note_id));

-- The patient app's logins read nothing here (the same guard 2026-10-07-patient-portal.sql puts on staff tables)
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.patient_notes;
    CREATE POLICY portal_staff_only ON public.patient_notes AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
    DROP POLICY IF EXISTS portal_staff_only ON public.patient_note_addenda;
    CREATE POLICY portal_staff_only ON public.patient_note_addenda AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

REVOKE ALL ON public.patient_notes, public.patient_note_addenda FROM anon, authenticated;
GRANT SELECT ON public.patient_notes, public.patient_note_addenda TO authenticated;
GRANT ALL ON public.patient_notes, public.patient_note_addenda TO service_role;

REVOKE ALL ON FUNCTION public.patient_note_types_for_role(text), public.patient_note_types_i_see() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_note_types_for_role(text), public.patient_note_types_i_see() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.patient_notes_stamp(), public.patient_note_addenda_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean),
  public.patient_note_follow_up_done(uuid, boolean), public.patient_note_add_addendum(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean),
  public.patient_note_follow_up_done(uuid, boolean), public.patient_note_add_addendum(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Checks after
-- ---------------------------------------------------------------------------------------------
-- 7a. Row level security on, one staff read policy per table, nothing for the public key, read-only tables
DO $$
DECLARE
  t text;
  f text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_notes', 'patient_note_addenda'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION 'Check failed: % has row level security off', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select' AND cmd = 'SELECT') <> 1
       OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname NOT IN (t || '_select', 'portal_staff_only'))
       OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND ('anon' = ANY (roles) OR 'public' = ANY (roles))) THEN
      RAISE EXCEPTION 'Check failed: % should have its staff read policy only, none for the public key', t;
    END IF;
    IF has_table_privilege('anon', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       OR NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION 'Check failed: signed-in users should only read %, the public key nothing', t;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean)',
                           'public.patient_note_follow_up_done(uuid, boolean)',
                           'public.patient_note_add_addendum(uuid, text)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: only signed-in users may call %', f;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = f::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Check failed: % must run as its owner with an empty search_path', f;
    END IF;
  END LOOP;
END $$;

-- 7b. The lock and the stamps, on one existing patient, inside a block that undoes itself (nothing is left behind,
--     also when this runs as a migration)
DO $$
DECLARE
  v_patient uuid;
  v_note uuid;
  v_addendum uuid;
  v_row public.patient_notes%ROWTYPE;
BEGIN
  SELECT p.id INTO v_patient FROM public.patients p WHERE p.practice_id IS NOT NULL LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE NOTICE 'No patient: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.patient_notes (patient_id, practice_id, note_type, header, body, follow_up_on, locked_at)
    VALUES (v_patient, gen_random_uuid(), 'general', '  Check   note ', ' Text ', current_date, now())
    RETURNING id INTO v_note;
    SELECT * INTO v_row FROM public.patient_notes WHERE id = v_note;
    IF v_row.practice_id IS DISTINCT FROM (SELECT p.practice_id FROM public.patients p WHERE p.id = v_patient) THEN
      RAISE EXCEPTION 'check failed: the note did not take its patient''s practice';
    END IF;
    IF v_row.header <> 'Check note' OR v_row.body <> 'Text' THEN
      RAISE EXCEPTION 'check failed: the header and text were not tidied';
    END IF;

    -- A locked note's text, header and kind cannot change
    BEGIN
      UPDATE public.patient_notes SET body = 'Changed' WHERE id = v_note;
      RAISE EXCEPTION 'check failed: a locked note''s text was changed';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
    END;
    BEGIN
      UPDATE public.patient_notes SET header = 'Changed' WHERE id = v_note;
      RAISE EXCEPTION 'check failed: a locked note''s header was changed';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
    END;
    BEGIN
      UPDATE public.patient_notes SET note_type = 'clinical' WHERE id = v_note;
      RAISE EXCEPTION 'check failed: a locked note''s kind was changed';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
    END;

    -- The lock stays on; the follow-up can still be marked done
    UPDATE public.patient_notes SET locked_at = NULL, follow_up_done_at = now() WHERE id = v_note;
    SELECT * INTO v_row FROM public.patient_notes WHERE id = v_note;
    IF v_row.locked_at IS NULL THEN
      RAISE EXCEPTION 'check failed: the lock was taken off';
    END IF;
    IF v_row.follow_up_done_at IS NULL THEN
      RAISE EXCEPTION 'check failed: the follow-up of a locked note could not be marked done';
    END IF;

    -- A new follow-up day opens the follow-up again
    UPDATE public.patient_notes SET follow_up_on = current_date + 7 WHERE id = v_note;
    IF (SELECT follow_up_done_at FROM public.patient_notes WHERE id = v_note) IS NOT NULL THEN
      RAISE EXCEPTION 'check failed: a moved follow-up stayed done';
    END IF;

    -- Changes become addenda, which never change
    INSERT INTO public.patient_note_addenda (note_id, body) VALUES (v_note, ' Added later ') RETURNING id INTO v_addendum;
    IF (SELECT body FROM public.patient_note_addenda WHERE id = v_addendum) <> 'Added later' THEN
      RAISE EXCEPTION 'check failed: the addendum was not tidied';
    END IF;
    BEGIN
      UPDATE public.patient_note_addenda SET body = 'Changed' WHERE id = v_addendum;
      RAISE EXCEPTION 'check failed: an addendum was changed';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
    END;

    RAISE EXCEPTION USING MESSAGE = 'patient_notes_checks_passed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'patient_notes_checks_passed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'patient notes ready: staff read by role, writes through the functions, the lock holds (test rows undone)';
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed; removes every patient note and addendum):
--   DROP TABLE IF EXISTS public.patient_note_addenda, public.patient_notes;
--   DROP FUNCTION IF EXISTS public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean),
--     public.patient_note_follow_up_done(uuid, boolean), public.patient_note_add_addendum(uuid, text),
--     public.patient_notes_stamp(), public.patient_note_addenda_stamp(), public.patient_note_types_i_see(),
--     public.patient_note_types_for_role(text);
--   NOTIFY pgrst, 'reload schema';
-- The Notes section and the dashboard's follow-ups then say they are not set up yet, and keep working.
-- =============================================================================================
