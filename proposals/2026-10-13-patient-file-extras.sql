-- Applied 2026-10-13 as migration patient_file_extras_2026_10_13 (version 20261012221252; stored statement md5 ffbf43605454ee55d302d07d2dc4a454 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 of save_letter_template afterwards 8aceccbf9897cfe9a71421fd2d8f2aae (the letter-templates version with
-- 'consent' among the kinds).
-- Rehearsed with simulated logins (rolled back; once before applying and again after, same results): reception set a
-- due date (1 row; read back; the change history gained 1 row) and listed 1 patient due in the month; another
-- practice's doctor changed 0 rows and saw no due dates; anon was refused (42501). A practitioner wrote a private note
-- (trimmed, author stamped), changed it, deleted it; a direct insert, an empty and a 4,001-character note and a note on
-- another practice's patient were refused (42501, 22023, 22023, 42501). A second practitioner of the same practice read
-- 0 of them and could not change or delete one (P0002), and kept their own note when the first deleted theirs; the
-- practice's administrator, its receptionist, OneHealth support, another practice's doctor and a patient-app login
-- each read 0 and could not write (42501); anon could not read or call the functions (42501); the author, made
-- inactive, read 0. The administrator saved a consent template (an unknown kind 22023; reception 42501). Reception
-- recorded a signed form (title and name tidied, SHA-256 lower-cased, obtained_by stamped, visit and template linked)
-- and could not change, delete or insert one directly (42501); a missing PDF, another folder, another practice's
-- folder, another patient's visit, a letter (not consent) template, an unknown signer kind, no signer name, a bad hash
-- and content that is not an object were each refused (22023). The practice's practitioner read the form; another
-- practice (record 42501), support and a patient-app login read 0; anon 42501. Patient merges move both new tables;
-- both carry portal_staff_only; anon executes none of the three functions.
-- =============================================================================================
-- PROPOSAL: the patient file's extras: private practitioner notes (C8), a pregnancy due date and the due-dates list
--           (A20), consent forms from the practice's templates signed on the screen (C14). The record export (C17)
--           reads what the file already holds and needs nothing new here.
-- File:   proposals/2026-10-13-patient-file-extras.sql                   Drafted: 2026-10-13
-- Code:   src/utils/clinical/pregnancy.ts (due-date rules, tested), src/services/pregnancyService.ts,
--         src/components/patients/pregnancy/* (the patient file's Overview; Messages > Lists > Due dates);
--         src/services/privateNotesService.ts, src/components/patients/privateNotes/PrivateNotesPanel.tsx;
--         src/utils/templates/letterTemplates.ts (the consent kind), src/utils/clinical/consent.ts (the signed form,
--         tested), src/services/patientConsentsService.ts, src/components/consents/* (the patient file's Overview and
--         the visit's Letters tab); src/services/patientRecordExportService.ts, src/components/patients/export/*
--
-- Why
--   C8:  Eminance practitioners keep notes on a patient that nobody else reads. OneHealth's typed notes are read by
--        every colleague whose role allows the kind of note; nothing was the practitioner's own.
--   A20: Eminance keeps a pregnancy due date on the patient and lists who is due in a period. OneHealth had nowhere
--        to keep it (a date typed in an unused follow-up form was never stored).
--   C14: consent was an uploaded scan only. A practice now keeps its consent wording as letter templates of a new
--        kind, fills it from the file and the visit, and the patient signs on the screen (finger or mouse). The
--        signed form is kept as a PDF in the private records bucket, linked to the patient and the visit.
--
-- What it does (additive; the policies of patients, patient_documents and the other protected tables are not touched)
--   1. patients.pregnancy_due_date (nullable). Staff write it through the existing patients policies, and the
--      existing audit_patients_trigger records each change in the file's change history. An index serves the
--      due-dates list (practice, date).
--   2. patient_private_notes: a practitioner's own notes on a patient. Row level security lets only the author read
--      a note, and only while they are active staff of the note's practice: no colleague, no practice administrator
--      and no OneHealth support login reads it through the app (the owner's decision is asked for in the report).
--      save_private_note writes or changes one (practitioners and nurses: the rule of clinical notes,
--      patient_note_types_i_see); delete_private_note removes the author's own note. Nobody writes the table directly.
--   3. letter_templates.kind 'consent': save_letter_template is replaced with the kind added and nothing else changed;
--      archive_letter_template needs no change. patient_consents: each signed form (who signed: the patient, a
--      parent or guardian, or someone else for the patient; their name; the text as signed with the signature; the
--      PDF's path, size and SHA-256; who obtained it and when; the visit and the template). A form is recorded once
--      through record_patient_consent (active staff of the patient's practice; the PDF must already be in the
--      records bucket under the practice's patient-documents folder) and never changed or deleted. Staff of the
--      practice read the forms. (template_id, practice_id) refers to letter_templates (id, practice_id), so a form
--      can only name its own practice's template.
--   4. The patient app's logins get nothing here (portal_staff_only), as on every OneHealth table.
--   Patient merges move both new tables with the rest of the file (patient_merge_columns finds every column with a
--   foreign key to patients). Needs proposals/2026-10-07-practice-isolation.sql (rls_my_practice_id),
--   2026-10-08-patient-notes-practitioners.sql (patient_note_types_i_see), 2026-10-08-records-bucket.sql and
--   2026-10-12-letter-templates.sql.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the patient file says these parts are not set up yet; nothing else changes.
-- Undo:
--   DROP FUNCTION IF EXISTS public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer);
--   DROP TABLE IF EXISTS public.patient_consents;
--   Archive or delete the practices' consent templates (kind 'consent'), then put back letter_templates_kind_check
--   and save_letter_template as proposals/2026-10-12-letter-templates.sql wrote them.
--   DROP FUNCTION IF EXISTS public.delete_private_note(uuid);
--   DROP FUNCTION IF EXISTS public.save_private_note(uuid, uuid, text);
--   DROP TABLE IF EXISTS public.patient_private_notes;
--   DROP INDEX IF EXISTS public.patients_pregnancy_due_date_idx;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS pregnancy_due_date;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_my_practice_id()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: rls_my_practice_id() must exist first (2026-10-07-practice-isolation.sql)';
  END IF;
  IF to_regprocedure('public.patient_note_types_i_see()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: patient_note_types_i_see() must exist first (2026-10-08-patient-notes.sql)';
  END IF;
  IF to_regclass('public.letter_templates') IS NULL THEN
    RAISE EXCEPTION 'Stopped: letter_templates must exist first (2026-10-12-letter-templates.sql)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'records' AND NOT b.public) THEN
    RAISE EXCEPTION 'Stopped: the private records bucket must exist first (2026-10-08-records-bucket.sql)';
  END IF;
  -- Section 3 replaces save_letter_template: only when it is as the letter-templates file left it (1185d0...) or as
  -- this file writes it (8acecc..., when run again)
  IF (SELECT md5(p.prosrc) FROM pg_proc p
       WHERE p.oid = 'public.save_letter_template(uuid, uuid, text, text, text, text, text, text, text)'::regprocedure)
     NOT IN ('1185d0ff1763abbd6f9625b8c528b580', '8aceccbf9897cfe9a71421fd2d8f2aae') THEN
    RAISE EXCEPTION 'Stopped: save_letter_template() is not as proposals/2026-10-12-letter-templates.sql left it; merge section 3 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The pregnancy due date (A20)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pregnancy_due_date date;
COMMENT ON COLUMN public.patients.pregnancy_due_date IS
  'Expected date of delivery while the patient is pregnant; cleared when the pregnancy ends. Shown on the patient file and in Messages > Lists > Due dates (not in dental or optometry practices).';

-- Who is due in a period, per practice
CREATE INDEX IF NOT EXISTS patients_pregnancy_due_date_idx
  ON public.patients (practice_id, pregnancy_due_date) WHERE pregnancy_due_date IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. Private practitioner notes (C8)
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_private_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The practitioner who wrote it, stamped by save_private_note: the only person who reads it. Should the staff row
  -- ever be deleted, the note stays for the record and nobody reads it through the app.
  author_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.patient_private_notes IS
  'A practitioner''s own notes on a patient (parity C8): only the author reads them, while staff of the practice. Written through save_private_note and delete_private_note; left out of record exports for everyone else.';

CREATE INDEX IF NOT EXISTS patient_private_notes_author_idx
  ON public.patient_private_notes (patient_id, author_id, created_at DESC);

ALTER TABLE public.patient_private_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_private_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_private_notes TO authenticated;

DROP POLICY IF EXISTS patient_private_notes_author_read ON public.patient_private_notes;
CREATE POLICY patient_private_notes_author_read ON public.patient_private_notes FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()) AND practice_id = (SELECT public.rls_my_practice_id()));

-- Write a private note (p_note_id null) or change one of your own
CREATE OR REPLACE FUNCTION public.save_private_note(p_patient_id uuid, p_note_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_body text := btrim(COALESCE(p_body, ''));
  v_practice uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT ('clinical' = ANY (COALESCE(public.patient_note_types_i_see(), ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Only practitioners and nurses keep private notes.' USING ERRCODE = '42501';
  END IF;
  SELECT p.practice_id INTO v_practice
    FROM public.patients p
   WHERE p.id = p_patient_id AND p.practice_id = public.rls_my_practice_id();
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'This patient is not on your practice''s files.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_body) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Write the note (up to 4,000 characters).' USING ERRCODE = '22023';
  END IF;

  IF p_note_id IS NULL THEN
    INSERT INTO public.patient_private_notes (practice_id, patient_id, author_id, body)
    VALUES (v_practice, p_patient_id, auth.uid(), v_body)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.patient_private_notes n
     SET body = v_body, updated_at = now()
   WHERE n.id = p_note_id AND n.patient_id = p_patient_id AND n.practice_id = v_practice AND n.author_id = auth.uid()
  RETURNING n.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This private note was not found: only the practitioner who wrote it can change it.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END
$$;

-- Remove one of your own private notes (also after your role changed: the note is still yours)
CREATE OR REPLACE FUNCTION public.delete_private_note(p_note_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Only the practitioner who wrote a private note can remove it.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.patient_private_notes n
   WHERE n.id = p_note_id AND n.author_id = auth.uid() AND n.practice_id = public.rls_my_practice_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This private note was not found: only the practitioner who wrote it can remove it.' USING ERRCODE = 'P0002';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.save_private_note(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_private_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_private_note(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_private_note(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Consent forms (C14): a template kind, and each signed form
-- ---------------------------------------------------------------------------------------------

-- 3a. Consent wording is a letter template of its own kind (Messages > Templates)
ALTER TABLE public.letter_templates DROP CONSTRAINT IF EXISTS letter_templates_kind_check;
ALTER TABLE public.letter_templates ADD CONSTRAINT letter_templates_kind_check
  CHECK (kind IN ('sick_note', 'certificate', 'referral', 'recall', 'letter', 'consent'));

-- As proposals/2026-10-12-letter-templates.sql wrote it, with 'consent' among the kinds
CREATE OR REPLACE FUNCTION public.save_letter_template(
  p_practice_id uuid,
  p_template_id uuid,
  p_kind text,
  p_name text,
  p_title text,
  p_recipient text,
  p_subject text,
  p_greeting text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_kind text := lower(btrim(COALESCE(p_kind, '')));
  v_name text := btrim(COALESCE(p_name, ''));
  v_title text := btrim(COALESCE(p_title, ''));
  v_recipient text := NULLIF(btrim(COALESCE(p_recipient, '')), '');
  v_subject text := NULLIF(btrim(COALESCE(p_subject, '')), '');
  v_greeting text := NULLIF(btrim(COALESCE(p_greeting, '')), '');
  v_body text := btrim(COALESCE(p_body, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice''s administrators change its letter templates.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.id = p_practice_id) THEN
    RAISE EXCEPTION 'This practice does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_kind NOT IN ('sick_note', 'certificate', 'referral', 'recall', 'letter', 'consent') THEN
    RAISE EXCEPTION 'Choose what kind of letter the template is.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the template a name (up to 80 characters).' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Give the letter a title for the letterhead (up to 60 characters).' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) NOT BETWEEN 3 AND 8000 THEN
    RAISE EXCEPTION 'Write the letter (3 to 8,000 characters).' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_recipient, '')) > 300 THEN
    RAISE EXCEPTION 'Keep the "To" lines to 300 characters.' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_subject, '')) > 200 THEN
    RAISE EXCEPTION 'Keep the subject line to 200 characters.' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_greeting, '')) > 120 THEN
    RAISE EXCEPTION 'Keep the greeting to 120 characters.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.letter_templates t
     WHERE t.practice_id = p_practice_id AND t.is_active AND lower(btrim(t.name)) = lower(v_name)
       AND t.id IS DISTINCT FROM p_template_id
  ) THEN
    RAISE EXCEPTION 'Another letter template is already called %.', v_name USING ERRCODE = '23505';
  END IF;
  IF v_kind = 'sick_note' AND EXISTS (
    SELECT 1 FROM public.letter_templates t
     WHERE t.practice_id = p_practice_id AND t.is_active AND t.kind = 'sick_note' AND t.id IS DISTINCT FROM p_template_id
  ) THEN
    RAISE EXCEPTION 'The practice already has a sick note template: change that one instead.' USING ERRCODE = '23505';
  END IF;

  IF p_template_id IS NULL THEN
    INSERT INTO public.letter_templates (practice_id, kind, name, title, recipient, subject, greeting, body, created_by, updated_by)
    VALUES (p_practice_id, v_kind, v_name, v_title, v_recipient, v_subject, v_greeting, v_body, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.letter_templates t
     SET kind = v_kind, name = v_name, title = v_title, recipient = v_recipient, subject = v_subject,
         greeting = v_greeting, body = v_body, updated_by = auth.uid(), updated_at = now()
   WHERE t.id = p_template_id AND t.practice_id = p_practice_id AND t.is_active
  RETURNING t.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This template does not exist any more (it may have been removed).' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END
$$;

-- 3b. Each signed consent form, kept once and never changed
CREATE TABLE IF NOT EXISTS public.patient_consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The visit it was signed for, if any; the form stays on the patient file should the visit go
  visit_id     uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  -- The consent template it was made from; always one of the form's own practice
  template_id  uuid,
  -- "Consent to treatment"
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  -- Who signed: the patient, a parent or guardian, or someone else for the patient
  signed_by    text NOT NULL CHECK (signed_by IN ('patient', 'parent_or_guardian', 'other')),
  signer_name  text NOT NULL CHECK (char_length(btrim(signer_name)) BETWEEN 1 AND 120),
  -- The form as signed: its text and the signature (src/utils/clinical/consent.ts), so it can always be printed again
  content      jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND octet_length(content::text) <= 300000),
  -- The signed PDF in the private records bucket, under the practice (src/services/recordPaths.ts), and its
  -- SHA-256, so a copy can be checked against what was signed
  file_path    text NOT NULL,
  file_sha256  text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_size    integer NOT NULL CHECK (file_size BETWEEN 1 AND 20000000),
  -- The staff member who obtained the consent and witnessed the signature, and when: stamped, never sent
  obtained_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  signed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_consents_template_fkey FOREIGN KEY (template_id, practice_id)
    REFERENCES public.letter_templates (id, practice_id) ON DELETE SET NULL (template_id),
  CONSTRAINT patient_consents_file_check CHECK (
    char_length(file_path) <= 500 AND split_part(file_path, '/', 1) = practice_id::text
    AND split_part(file_path, '/', 2) = 'patient-documents' AND lower(right(file_path, 4)) = '.pdf')
);

COMMENT ON TABLE public.patient_consents IS
  'Consent forms signed on the screen (parity C14): recorded once through record_patient_consent and never changed. The PDF is in the records bucket at file_path.';

CREATE INDEX IF NOT EXISTS patient_consents_patient_idx ON public.patient_consents (patient_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS patient_consents_visit_idx ON public.patient_consents (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS patient_consents_template_idx ON public.patient_consents (template_id) WHERE template_id IS NOT NULL;

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_consents TO authenticated;

DROP POLICY IF EXISTS patient_consents_read ON public.patient_consents;
CREATE POLICY patient_consents_read ON public.patient_consents FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));

CREATE OR REPLACE FUNCTION public.record_patient_consent(
  p_patient_id uuid,
  p_visit_id uuid,
  p_template_id uuid,
  p_title text,
  p_signed_by text,
  p_signer_name text,
  p_content jsonb,
  p_file_path text,
  p_file_sha256 text,
  p_file_size integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid := public.rls_my_practice_id();
  v_title text := regexp_replace(btrim(COALESCE(p_title, '')), '\s+', ' ', 'g');
  v_signer text := regexp_replace(btrim(COALESCE(p_signer_name, '')), '\s+', ' ', 'g');
  v_signed_by text := lower(btrim(COALESCE(p_signed_by, '')));
  v_path text := btrim(COALESCE(p_file_path, ''));
  v_hash text := lower(btrim(COALESCE(p_file_sha256, '')));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_practice IS NULL THEN
    RAISE EXCEPTION 'Only the practice''s staff record consent forms.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = v_practice) THEN
    RAISE EXCEPTION 'This patient is not on your practice''s files.' USING ERRCODE = '42501';
  END IF;
  IF p_visit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.visits v WHERE v.id = p_visit_id AND v.patient_id = p_patient_id AND v.practice_id = v_practice
  ) THEN
    RAISE EXCEPTION 'This visit is not one of the patient''s visits at your practice.' USING ERRCODE = '22023';
  END IF;
  IF p_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.letter_templates t WHERE t.id = p_template_id AND t.practice_id = v_practice AND t.kind = 'consent'
  ) THEN
    RAISE EXCEPTION 'This consent template is not one of your practice''s.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Give the consent form a title (up to 200 characters).' USING ERRCODE = '22023';
  END IF;
  IF v_signed_by NOT IN ('patient', 'parent_or_guardian', 'other') THEN
    RAISE EXCEPTION 'Say who signed: the patient, a parent or guardian, or someone else for the patient.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_signer) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Give the name of the person who signed (up to 120 characters).' USING ERRCODE = '22023';
  END IF;
  IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object' OR octet_length(p_content::text) > 300000 THEN
    RAISE EXCEPTION 'The signed form could not be read: make it again.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_path) > 500 OR split_part(v_path, '/', 1) <> v_practice::text
     OR split_part(v_path, '/', 2) <> 'patient-documents' OR lower(right(v_path, 4)) <> '.pdf' OR v_path LIKE '%..%' THEN
    RAISE EXCEPTION 'The signed form must be kept in your practice''s patient documents.' USING ERRCODE = '22023';
  END IF;
  IF v_hash !~ '^[0-9a-f]{64}$' OR p_file_size IS NULL OR p_file_size NOT BETWEEN 1 AND 20000000 THEN
    RAISE EXCEPTION 'The signed form could not be read: make it again.' USING ERRCODE = '22023';
  END IF;
  -- The PDF is uploaded first; a form whose PDF is not there is never recorded
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'records' AND o.name = v_path) THEN
    RAISE EXCEPTION 'The signed form was not saved in the patient''s documents: try again.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.patient_consents (practice_id, patient_id, visit_id, template_id, title, signed_by, signer_name,
                                       content, file_path, file_sha256, file_size, obtained_by)
  VALUES (v_practice, p_patient_id, p_visit_id, p_template_id, v_title, v_signed_by, v_signer,
          p_content, v_path, v_hash, p_file_size, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['patient_private_notes', 'patient_consents'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('patient_private_notes', 'patient_consents')
 ORDER BY tablename, policyname;

SELECT has_table_privilege('anon', 'public.patient_private_notes', 'SELECT') AS anon_reads_notes,
       has_table_privilege('authenticated', 'public.patient_private_notes', 'INSERT') AS staff_insert_notes,
       has_table_privilege('authenticated', 'public.patient_consents', 'UPDATE') AS staff_update_consents,
       has_function_privilege('anon', 'public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer)', 'EXECUTE') AS anon_records,
       has_function_privilege('authenticated', 'public.save_private_note(uuid, uuid, text)', 'EXECUTE') AS staff_save_notes;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
