-- Applied 2026-10-12 as migration letter_templates_2026_10_12 (version 20261012191412; stored statement md5 d11b3c98a6002665121e49ff424838aa = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 of patient_letters_stamp afterwards 500251aa05f3bb5447e43e55491b688e (the 6g stamp plus template_id).
-- Rehearsed with simulated logins (rolled back): anon read and saved nothing (42501); a patient-app login read 0
-- templates and saved none (42501); a receptionist could not save or insert directly (42501) but read the practice's 2
-- templates; the administrator saved one (name trimmed, stamped), was refused a second template of the same name in
-- other letters (23505), a second sick note template (23505), an unknown kind, an empty letter and a 61-character title
-- (22023), and another practice (42501), and changed and archived templates (archived twice or changed: P0002); an
-- administrator of another practice read 0 and changed or archived nothing (42501, P0002); support saved for any
-- practice; a kept letter named its own practice's template, kept it through the "sent" update, and could not name
-- another practice's (23503); a new sick note template could follow an archived one. Repeated after applying.
-- =============================================================================================
-- PROPOSAL: letter templates with merge fields, kept per practice; each letter issued from one keeps its template
--           (parity C15, O8, P11)
-- File:   proposals/2026-10-12-letter-templates.sql                Drafted: 2026-10-12
-- Code:   src/utils/templates/mergeFields.ts (the {{fields}} letters, SMS and email templates share; tested),
--         src/utils/templates/letterTemplates.ts (kinds, examples, checks; tested), src/utils/clinical/letters.ts
--         (a letter and the sick note from a template; tested), src/services/letterTemplatesService.ts (reads and
--         saves), src/components/templates/* (Messages > Templates), src/components/letters/LetterComposer.tsx
--         (a letter from a template on the visit and the patient file), src/components/patientLists/
--         ListLettersSheet.tsx (the same letter for everyone on a list)
--
-- Why (parity C15, O8, P11): Eminance practices keep their own letters with merge fields (sick notes, certificates,
-- referral and recall letters) and merge one for a patient or a whole list. OneHealth wrote referral letters, other
-- letters and the visit's sick note from fixed wording; certificates and motivations were retyped every time and a
-- recall letter could not be made for a list.
--
-- What it does (additive; patient_letters keeps its policies)
--   1. letter_templates: a practice's letter templates: kind (sick note, certificate, referral, recall, other
--      letter), name, the title on the letterhead, an optional "To" block, subject line and greeting, and the text,
--      each with {{merge fields}} the app fills from the patient file, the visit and the practice. A removed
--      template is archived (is_active false), so letters made from it still say where they came from. Names are
--      unique among a practice's templates in use; a practice has at most one sick note template in use (its
--      wording for every sick note printed from a visit; the sick note itself stays in leave_forms, never copied).
--   2. patient_letters.template_id: the template a kept letter was made from. The letter, its practice and its
--      template belong together: (template_id, practice_id) refers to letter_templates (id, practice_id), so a letter
--      can never point at another practice's template. patient_letters_stamp() also keeps template_id unchanged
--      after the letter is made (the stamp keeps every column except the "sent" details).
--   3. RLS: staff of the practice (and OneHealth support) read its templates; nobody writes the table directly.
--   4. save_letter_template(...) and archive_letter_template(...): the practice's administrators (users.role
--      'admin') and OneHealth support add, change and remove templates, checked inside and answered in plain words.
--      SECURITY DEFINER; EXECUTE for signed-in users only.
--   5. The patient app's logins get nothing here, as on every OneHealth table.
--   Needs the practice-isolation helpers rls_my_practice_id() and rls_is_super_admin()
--   (proposals/2026-10-07-practice-isolation.sql) and patient_letters (proposals/2026-10-07-patient-safety.sql).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then Messages > Templates says letter templates are not set up yet; letters, sick notes, SMS and
-- email templates keep working as before.
-- Undo: DROP FUNCTION IF EXISTS public.archive_letter_template(uuid);
--       DROP FUNCTION IF EXISTS public.save_letter_template(uuid, uuid, text, text, text, text, text, text, text);
--       Put back patient_letters_stamp() as proposals/2026-10-07-patient-safety.sql section 6g wrote it (without
--       the template_id line), then
--       ALTER TABLE public.patient_letters DROP COLUMN IF EXISTS template_id;
--       DROP TABLE IF EXISTS public.letter_templates;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_my_practice_id()') IS NULL OR to_regprocedure('public.rls_is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: rls_my_practice_id() and rls_is_super_admin() must exist first (2026-10-07-practice-isolation.sql)';
  END IF;
  IF to_regclass('public.patient_letters') IS NULL OR to_regprocedure('public.patient_letters_stamp()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: patient_letters and patient_letters_stamp() must exist first (2026-10-07-patient-safety.sql)';
  END IF;
  -- Section 2 replaces patient_letters_stamp(): only when it is as the patient-safety file left it (85536...) or as
  -- this file writes it (500251..., when run again)
  IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = 'public.patient_letters_stamp()'::regprocedure)
     NOT IN ('85536ba8679c8748342597e2266cabd1', '500251aa05f3bb5447e43e55491b688e') THEN
    RAISE EXCEPTION 'Stopped: patient_letters_stamp() is not as proposals/2026-10-07-patient-safety.sql left it; merge section 2 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The templates
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.letter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- sick_note: the wording of every sick note printed from a visit (one in use per practice); the others are made
  -- from the visit, the patient file or a patient list
  kind text NOT NULL CHECK (kind IN ('sick_note', 'certificate', 'referral', 'recall', 'letter')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- The big title on the letterhead: "MEDICAL CERTIFICATE"
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  -- Optional "To" block (one line each), subject line and greeting ("To whom it may concern"), with merge fields
  recipient text CHECK (recipient IS NULL OR char_length(recipient) <= 300),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 200),
  greeting text CHECK (greeting IS NULL OR char_length(greeting) <= 120),
  -- The letter: paragraphs separated by a blank line, with {{merge fields}}
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 3 AND 8000),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The key a kept letter refers to, so its template is always of its own practice
  CONSTRAINT letter_templates_id_practice_key UNIQUE (id, practice_id)
);

COMMENT ON TABLE public.letter_templates IS
  'A practice''s letter templates with {{merge fields}} (src/utils/templates/mergeFields.ts). Changed only through save_letter_template and archive_letter_template (the practice''s administrators and OneHealth support). A removed template is archived (is_active false).';

-- Names are unique among the templates in use; one sick note template in use per practice
CREATE UNIQUE INDEX IF NOT EXISTS letter_templates_active_name_key
  ON public.letter_templates (practice_id, lower(btrim(name))) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS letter_templates_one_sick_note_key
  ON public.letter_templates (practice_id) WHERE is_active AND kind = 'sick_note';

-- ---------------------------------------------------------------------------------------------
-- 2. The template a kept letter was made from
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_letters ADD COLUMN IF NOT EXISTS template_id uuid;
COMMENT ON COLUMN public.patient_letters.template_id IS
  'The letter template the letter was made from (letter_templates), if any. Always a template of the letter''s own practice.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_letters_template_fkey' AND conrelid = 'public.patient_letters'::regclass) THEN
    -- Archiving keeps the template; were one ever deleted, the letter keeps its text and loses only the link
    ALTER TABLE public.patient_letters
      ADD CONSTRAINT patient_letters_template_fkey FOREIGN KEY (template_id, practice_id)
      REFERENCES public.letter_templates (id, practice_id) ON DELETE SET NULL (template_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patient_letters_template_idx ON public.patient_letters (template_id) WHERE template_id IS NOT NULL;

-- The stamp of 2026-10-07-patient-safety.sql 6g, plus template_id: after a letter is made only the "sent" details change
CREATE OR REPLACE FUNCTION public.patient_letters_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    NEW.created_at := now();
    NEW.sent_at := NULL;
    NEW.sent_via := NULL;
    NEW.sent_to := NULL;
    RETURN NEW;
  END IF;
  NEW.visit_id := OLD.visit_id;
  NEW.kind := OLD.kind;
  NEW.title := OLD.title;
  NEW.recipient_name := OLD.recipient_name;
  NEW.recipient_email := OLD.recipient_email;
  NEW.letter_date := OLD.letter_date;
  NEW.valid_until := OLD.valid_until;
  NEW.content := OLD.content;
  NEW.template_id := OLD.template_id;
  NEW.author_id := OLD.author_id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads what; nobody writes the templates directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.letter_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.letter_templates TO authenticated;

-- Every staff member of the practice writes letters, so every one of them reads its templates
DROP POLICY IF EXISTS letter_templates_read ON public.letter_templates;
CREATE POLICY letter_templates_read ON public.letter_templates FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 4. Adding, changing and removing a template (the practice's administrators and OneHealth support)
-- ---------------------------------------------------------------------------------------------

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

  IF v_kind NOT IN ('sick_note', 'certificate', 'referral', 'recall', 'letter') THEN
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

CREATE OR REPLACE FUNCTION public.archive_letter_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Only the practice''s administrators remove its letter templates.' USING ERRCODE = '42501';
  END IF;
  SELECT t.practice_id INTO v_practice FROM public.letter_templates t
   WHERE t.id = p_template_id AND t.is_active
     AND (t.practice_id = public.rls_my_practice_id() OR public.rls_is_super_admin())
   FOR UPDATE;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'This template does not exist any more (it may have been removed).' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = v_practice
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice''s administrators remove its letter templates.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.letter_templates t SET is_active = false, updated_by = auth.uid(), updated_at = now() WHERE t.id = p_template_id;
END
$$;

REVOKE ALL ON FUNCTION public.save_letter_template(uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_letter_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_letter_template(uuid, uuid, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_letter_template(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.letter_templates;
    CREATE POLICY portal_staff_only ON public.letter_templates AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('letter_templates', 'patient_letters')
 ORDER BY tablename, policyname;

SELECT has_table_privilege('anon', 'public.letter_templates', 'SELECT') AS anon_reads_templates,
       has_table_privilege('authenticated', 'public.letter_templates', 'INSERT') AS staff_insert_directly,
       has_function_privilege('anon', 'public.save_letter_template(uuid, uuid, text, text, text, text, text, text, text)', 'EXECUTE') AS anon_saves,
       has_function_privilege('authenticated', 'public.archive_letter_template(uuid)', 'EXECUTE') AS staff_run_archive;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
