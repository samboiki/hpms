-- Applied 2026-10-09 as migration patient_notes_practitioners_2026_10_08 (version 20261009020138; stored statement
-- md5 6abed1de8688de2c88fcb959a1a3af01 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins: an admin without a registration number saw 0 clinical notes and was refused a
-- clinical note (42501), an addendum to one (P0002) and a clinical follow-up (22023); the same admin with a number saw,
-- wrote, added to and marked done clinical notes; a receptionist saw none; another practice saw 0; the public key
-- read nothing and could not call the rule (42501).
-- =============================================================================================
-- PROPOSAL: clinical patient notes for every practitioner, also one whose role is administrator
-- File:   proposals/2026-10-08-patient-notes-practitioners.sql           Drafted: 2026-10-09
-- Code:   src/components/patients/notes/patientNotes.ts (noteTypesFor is this file's patient_note_types_for_staff;
--         a unit test compares the two)
--
-- Why: 2026-10-08-patient-notes.sql gave clinical notes to the doctor and nurse roles only. In small Namibian
-- practices the owner-practitioner is usually the administrator (two of the three practices here have an
-- administrator and no doctor), so they could not read their own clinical notes. The rule is now:
--   * clinical notes: active staff of the patient's practice whose role is doctor or nurse, or who have a
--     practitioner registration number (users.hpcsa_number not blank; Settings > Users, "Professional
--     Registration No."). Receptionists and administrators without a number still see none;
--   * account notes (staff with billing rights) and calls or SMS and general notes (all staff): unchanged.
-- The same rule decides who reads, writes and adds to a clinical note, and who may be asked to follow one up.
--
-- What changes: patient_note_types_for_staff(role, registration number) replaces patient_note_types_for_role(role);
-- patient_note_types_i_see() (used by the read policy and the write functions) and patient_note_save (the person
-- who follows up) use it. No table, policy or grant on a table changes.
-- Requires: 2026-10-08-patient-notes.sql.
-- How to apply: rehearse (scripts/db/rehearsal.ts runs it right after the patient-notes file in one rolled-back
-- transaction), then apply the part between BEGIN; and ROLLBACK; as a migration.
-- Undo: run sections 3 and 5a of 2026-10-08-patient-notes.sql again (the role-only rule), then
--   DROP FUNCTION public.patient_note_types_for_staff(text, text);
-- =============================================================================================

BEGIN;
-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.patient_notes') IS NULL OR to_regprocedure('public.patient_note_types_i_see()') IS NULL THEN
    RAISE EXCEPTION 'Apply 2026-10-08-patient-notes.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The rule: the app's noteTypesFor (src/components/patients/notes/patientNotes.ts; a unit test compares them)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_note_types_for_staff(p_role text, p_registration_number text)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
           WHEN p_role IN ('admin', 'doctor', 'nurse', 'receptionist') THEN
             CASE
               WHEN p_role IN ('doctor', 'nurse') OR btrim(COALESCE(p_registration_number, '')) <> ''
                 THEN ARRAY['clinical', 'account', 'contact', 'general']
               ELSE ARRAY['account', 'contact', 'general']
             END
           ELSE ARRAY[]::text[]
         END
$$;
COMMENT ON FUNCTION public.patient_note_types_for_staff(text, text) IS
  'Kinds of patient note a staff member reads and writes: clinical for doctors, nurses and anyone with a practitioner registration number; account, contact and general for all staff.';

-- ---------------------------------------------------------------------------------------------
-- 2. The caller's kinds (null when the caller is not active staff of a practice)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_note_types_i_see()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.patient_note_types_for_staff(u.role, u.hpcsa_number)
    FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. patient_note_save: as before, except that the person who follows up is checked by the same rule
-- ---------------------------------------------------------------------------------------------
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
  v_registration text;
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
    SELECT u.role, u.hpcsa_number INTO v_role, v_registration FROM public.users u
     WHERE u.id = p_follow_up_user_id AND u.practice_id = v_practice AND COALESCE(u.is_active, true);
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Choose someone who works at this practice to follow up.' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_note_type = ANY (public.patient_note_types_for_staff(v_role, v_registration))) THEN
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

-- ---------------------------------------------------------------------------------------------
-- 4. The role-only rule goes (nothing calls it any more), and the new one is for signed-in staff
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.patient_note_types_for_role(text);

REVOKE ALL ON FUNCTION public.patient_note_types_for_staff(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_note_types_for_staff(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  c_all constant text[] := ARRAY['clinical', 'account', 'contact', 'general'];
  c_no_clinical constant text[] := ARRAY['account', 'contact', 'general'];
BEGIN
  IF public.patient_note_types_for_staff('admin', 'P-0001') <> c_all
     OR public.patient_note_types_for_staff('receptionist', 'P-0001') <> c_all THEN
    RAISE EXCEPTION 'Check failed: staff with a registration number must see clinical notes';
  END IF;
  IF public.patient_note_types_for_staff('admin', '  ') <> c_no_clinical
     OR public.patient_note_types_for_staff('admin', NULL) <> c_no_clinical
     OR public.patient_note_types_for_staff('receptionist', NULL) <> c_no_clinical THEN
    RAISE EXCEPTION 'Check failed: administrators and receptionists without a number must not see clinical notes';
  END IF;
  IF public.patient_note_types_for_staff('doctor', NULL) <> c_all OR public.patient_note_types_for_staff('nurse', '') <> c_all THEN
    RAISE EXCEPTION 'Check failed: doctors and nurses must see clinical notes';
  END IF;
  IF cardinality(public.patient_note_types_for_staff('patient', 'P-0001')) <> 0 OR cardinality(public.patient_note_types_for_staff(NULL, NULL)) <> 0 THEN
    RAISE EXCEPTION 'Check failed: only staff roles see patient notes';
  END IF;
  IF to_regprocedure('public.patient_note_types_for_role(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the role-only rule is still there';
  END IF;
  IF has_function_privilege('anon', 'public.patient_note_types_for_staff(text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: only signed-in users may call the notes functions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = 'public.patient_note_save(uuid, uuid, text, text, text, date, uuid, boolean)'::regprocedure
       AND prosecdef AND proconfig @> ARRAY['search_path=""']
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = 'public.patient_note_types_i_see()'::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'Check failed: the notes functions must run as their owner with an empty search_path';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
