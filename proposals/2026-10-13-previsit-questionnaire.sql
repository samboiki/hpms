-- Applied 2026-10-13 as migration previsit_questionnaire_2026_10_13 (version 20261013011021; stored statement md5 08cc72375391f1e9303639e6d10dcd4c = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins on five invented bookings (rolled back, then checked: no table, function or booking
-- left): reception could not change the questions (42501) or make a link before there were any (22023); a
-- practitioner saved two (tidied, unknown keys dropped, "required" no by default); a repeated id, an unknown kind, 31
-- questions, a capital id and a 201-character question were refused (22023). Reception made a link: 22 characters,
-- only its SHA-256 kept (the code itself found 0 times), working until the end of the booking's day in Windhoek. With
-- the public key the code opened only {status, practice_name, intro, questions}; a short, unknown or empty code said
-- not_found; a missing required answer, "yes" as text and a 501-character answer said invalid; the answers were kept
-- once (tidied, a question not asked dropped) and the code then said answered, also when answering again. The public
-- key could not read the three tables, make a link, answer as the tablet or run the internal check (42501). A link
-- after answers was refused (22023); the tablet answered once (23505 the second time) and needed the required answer
-- (22023); a link stopped working once the tablet answered (answered), when a newer link was made (expired, the newer
-- one open), when the booking was cancelled and after its end (expired). Another practice's staff and a patient-app
-- login read 0 rows and could not make links, answer or change questions (42501); staff could not change answers
-- directly (42501); clearing the questions left the kept answers with the questions as asked.
-- =============================================================================================
-- PROPOSAL: a pre-visit screening questionnaire: the practice's own questions, answered on a tablet at check-in or
--           through a per-booking link the patient opens without signing in (parity B17)
-- File:   proposals/2026-10-13-previsit-questionnaire.sql                Drafted: 2026-10-13
-- Code:   src/utils/clinical/previsitQuestions.ts (the questions, the answers, the link; tested),
--         src/services/previsitService.ts (reads and writes; "not set up yet" before this file),
--         src/components/previsit/* (Diary settings > Questions, the booking's "Questions before the visit", the
--         tablet screen, the answers on the visit) and src/pages/PrevisitQuestionnairePage.tsx (the public page at
--         /q/<link code>, which talks only to previsit_questionnaire()).
--
-- Why (parity B17): Eminance practices screen patients before a visit (its COVID-19 screener: Y/N questions on the
-- diary entry, or an external screener link). OneHealth asked nothing before the patient sat in front of the
-- practitioner.
--
-- What it does
--   1. previsit_questionnaires: one per practice: an optional welcome line and up to 30 questions
--      ({id, text, kind 'yes_no' or 'text', required}). Practice administrators and practitioners change it
--      (save_previsit_questionnaire); no questions = the practice does not ask.
--   2. previsit_answers: one per booking, never changed: the questions as asked, the answers, how (tablet or link),
--      who handed over the tablet, when.
--   3. previsit_links: a booking's link codes. The code itself (22 URL-safe characters from 16 random bytes,
--      pgcrypto) is shown to staff once to send or copy; only its SHA-256 is kept. A link works until the end of the
--      booking's day (Windhoek time, at most 30 days), once: a new link for the booking, answers given on the
--      tablet, or a cancelled booking end it.
--   4. Functions for signed-in staff of the booking's practice (any role: reception sends links and hands over the
--      tablet): create_previsit_link and save_previsit_answers. previsit_practice_for_visit and
--      previsit_clean_answers are internal.
--   5. previsit_questionnaire(link code, answers): the ONE function a patient's browser calls without signing in
--      (EXECUTE granted to anon; every other function and table stays closed to anon). With a valid, unused,
--      unexpired code it returns only the practice's name, its welcome line and the questions (no patient,
--      practitioner, date or id); with answers it checks them against the questions and keeps them once. Any other
--      code gets {status: not_found / expired / answered}, never a reason that reveals more. Nothing else is
--      reachable with a code.
--   6. Row level security: staff of the practice read the three tables; nobody writes them directly; the patient
--      app's logins get nothing (portal_staff_only, as on every OneHealth table).
--   7. Checks after.
--   The link is sent by staff through centralized-sms-gateway (communicationService), after they confirm the number
--   and the text, or copied. Nothing here sends anything. The page at /q/<code> works once this version of the app is
--   deployed; until then staff use the tablet screen.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Needs pgcrypto (extensions.gen_random_bytes) and ar_today().
-- Undo:
--   DROP FUNCTION IF EXISTS public.previsit_questionnaire(text, jsonb), public.save_previsit_answers(uuid, jsonb),
--     public.create_previsit_link(uuid), public.save_previsit_questionnaire(uuid, text, jsonb),
--     public.previsit_clean_answers(jsonb, jsonb), public.previsit_practice_for_visit(uuid);
--   DROP TABLE IF EXISTS public.previsit_links, public.previsit_answers, public.previsit_questionnaires;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.visits') IS NULL OR to_regclass('public.patients') IS NULL OR to_regclass('public.practices') IS NULL THEN
    RAISE EXCEPTION 'Stopped: visits, patients or practices is missing';
  END IF;
  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: pgcrypto (extensions.gen_random_bytes) is missing';
  END IF;
  IF to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: ar_today() is missing; apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The practice's questions
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.previsit_questionnaires (
  practice_id uuid PRIMARY KEY,
  intro       text,
  questions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT previsit_questionnaires_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT previsit_questionnaires_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT previsit_questionnaires_intro_check CHECK (intro IS NULL OR char_length(intro) BETWEEN 1 AND 500),
  CONSTRAINT previsit_questionnaires_questions_check CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) <= 30)
);
COMMENT ON TABLE public.previsit_questionnaires IS
  'A practice''s questions before a visit ([{id, text, kind yes_no|text, required}]), changed through save_previsit_questionnaire. See proposals/2026-10-13-previsit-questionnaire.sql.';

-- ---------------------------------------------------------------------------------------------
-- 2. The answers of a booking (once, never changed)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.previsit_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL,
  patient_id   uuid NOT NULL,
  visit_id     uuid NOT NULL,
  -- The questions as they were asked (the practice may change its questions later)
  questions    jsonb NOT NULL,
  -- {"<question id>": true | false | "written answer"}; a question left out was not answered
  answers      jsonb NOT NULL,
  answered_via text NOT NULL,
  -- The staff member who handed over the tablet (null for the link)
  recorded_by  uuid,
  answered_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT previsit_answers_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT previsit_answers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT previsit_answers_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE,
  CONSTRAINT previsit_answers_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT previsit_answers_visit_key UNIQUE (visit_id),
  CONSTRAINT previsit_answers_via_check CHECK (answered_via IN ('tablet', 'link')),
  CONSTRAINT previsit_answers_shape_check CHECK (
    jsonb_typeof(questions) = 'array' AND jsonb_typeof(answers) = 'object' AND octet_length(answers::text) <= 40000)
);
CREATE INDEX IF NOT EXISTS previsit_answers_patient_idx ON public.previsit_answers (patient_id);
COMMENT ON TABLE public.previsit_answers IS
  'A booking''s answers to the practice''s questions before the visit, given on a tablet at check-in or through the booking''s link. Insert only, through save_previsit_answers and previsit_questionnaire.';

-- ---------------------------------------------------------------------------------------------
-- 3. A booking's link codes (only their SHA-256 is kept)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.previsit_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL,
  visit_id     uuid NOT NULL,
  token_sha256 text NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT previsit_links_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT previsit_links_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE,
  CONSTRAINT previsit_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT previsit_links_token_key UNIQUE (token_sha256),
  CONSTRAINT previsit_links_token_check CHECK (token_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS previsit_links_visit_idx ON public.previsit_links (visit_id);
COMMENT ON TABLE public.previsit_links IS
  'Link codes for a booking''s questions: the SHA-256 of the code, until when it works and when it was used. The code itself is never stored.';

-- ---------------------------------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------------------------------

-- 4a. The booking's practice, when the signed-in user is active staff of it; raises otherwise
CREATE OR REPLACE FUNCTION public.previsit_practice_for_visit(p_visit_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT v.practice_id INTO v_practice FROM public.visits v WHERE v.id = p_visit_id;
  IF auth.uid() IS NULL OR v_practice IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = v_practice
  ) THEN
    RAISE EXCEPTION 'Only staff of the booking''s practice can do this' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- 4b. The answers kept for the questions: a yes/no question takes true or false, a written one up to 500 characters
--     (trimmed; an empty one is not an answer); questions not asked are dropped; a required question must be
--     answered. The same rules as cleanPrevisitAnswers in src/utils/clinical/previsitQuestions.ts.
CREATE OR REPLACE FUNCTION public.previsit_clean_answers(p_questions jsonb, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_question jsonb;
  v_id text;
  v_answer jsonb;
  v_text text;
  v_clean jsonb := '{}'::jsonb;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'The answers could not be read' USING ERRCODE = '22023';
  END IF;
  FOR v_question IN SELECT value FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb)) LOOP
    v_id := v_question ->> 'id';
    v_answer := p_answers -> v_id;
    IF v_answer IS NULL OR jsonb_typeof(v_answer) = 'null' THEN
      NULL;
    ELSIF v_question ->> 'kind' = 'yes_no' THEN
      IF jsonb_typeof(v_answer) <> 'boolean' THEN
        RAISE EXCEPTION 'Answer yes or no to: %', v_question ->> 'text' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object(v_id, v_answer);
    ELSE
      IF jsonb_typeof(v_answer) <> 'string' THEN
        RAISE EXCEPTION 'Write the answer to: %', v_question ->> 'text' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(regexp_replace(v_answer #>> '{}', '[[:cntrl:]]+', ' ', 'g'));
      IF char_length(v_text) > 500 THEN
        RAISE EXCEPTION 'Keep each answer to 500 characters' USING ERRCODE = '22023';
      END IF;
      IF v_text <> '' THEN
        v_clean := v_clean || jsonb_build_object(v_id, v_text);
      END IF;
    END IF;
    IF COALESCE((v_question ->> 'required')::boolean, false) AND NOT (v_clean ? v_id) THEN
      RAISE EXCEPTION 'Please answer: %', v_question ->> 'text' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN v_clean;
END
$$;

-- 4c. save_previsit_questionnaire(practice, welcome line, questions): practice administrators and practitioners.
--     Each question is kept as exactly {id, text, kind, required}.
CREATE OR REPLACE FUNCTION public.save_previsit_questionnaire(p_practice_id uuid, p_intro text, p_questions jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_question jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_ids text[] := '{}';
  v_id text;
  v_text text;
  v_kind text;
  v_intro text := NULLIF(btrim(COALESCE(p_intro, '')), '');
BEGIN
  IF auth.uid() IS NULL OR p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = p_practice_id AND u.role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'Only a practice administrator or a practitioner can change the questions' USING ERRCODE = '42501';
  END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'Give the questions as a list' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_questions) > 30 THEN
    RAISE EXCEPTION 'Ask at most 30 questions' USING ERRCODE = '22023';
  END IF;
  IF v_intro IS NOT NULL AND char_length(v_intro) > 500 THEN
    RAISE EXCEPTION 'Keep the welcome line to 500 characters' USING ERRCODE = '22023';
  END IF;
  FOR v_question IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
    v_id := v_question ->> 'id';
    v_text := btrim(regexp_replace(COALESCE(v_question ->> 'text', ''), '\s+', ' ', 'g'));
    v_kind := v_question ->> 'kind';
    IF v_id IS NULL OR v_id !~ '^[a-z0-9]{1,12}$' OR v_id = ANY (v_ids) THEN
      RAISE EXCEPTION 'Each question needs its own short id' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_text) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Write each question in 1 to 200 characters' USING ERRCODE = '22023';
    END IF;
    IF v_kind IS NULL OR v_kind NOT IN ('yes_no', 'text') THEN
      RAISE EXCEPTION 'A question is answered with yes or no, or in words' USING ERRCODE = '22023';
    END IF;
    IF v_question ? 'required' AND jsonb_typeof(v_question -> 'required') <> 'boolean' THEN
      RAISE EXCEPTION 'Say whether each question must be answered' USING ERRCODE = '22023';
    END IF;
    v_ids := v_ids || v_id;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'text', v_text, 'kind', v_kind, 'required', COALESCE((v_question ->> 'required')::boolean, false)));
  END LOOP;
  INSERT INTO public.previsit_questionnaires (practice_id, intro, questions, updated_by, updated_at)
  VALUES (p_practice_id, v_intro, v_clean, auth.uid(), now())
  ON CONFLICT (practice_id) DO UPDATE
    SET intro = EXCLUDED.intro, questions = EXCLUDED.questions, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
END
$$;

-- 4d. create_previsit_link(booking): a new link code for a booking still to come whose questions are not answered yet.
--     Returns {token, expires_at}; the code is shown once (staff send or copy it) and only its SHA-256 is kept. An
--     earlier open link of the booking stops working.
CREATE OR REPLACE FUNCTION public.create_previsit_link(p_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := public.previsit_practice_for_visit(p_visit_id);
  v_visit public.visits%ROWTYPE;
  v_day date;
  v_token text;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_visit FROM public.visits WHERE id = p_visit_id;
  v_day := COALESCE(v_visit.scheduled_date, v_visit.visit_date);
  IF v_visit.patient_id IS NULL THEN
    RAISE EXCEPTION 'The booking has no patient file yet' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_visit.is_cancelled, false) OR COALESCE(v_visit.status, '') IN ('cancelled', 'no-show', 'completed') THEN
    RAISE EXCEPTION 'The booking is cancelled or the visit is over' USING ERRCODE = '22023';
  END IF;
  IF v_day IS NULL OR v_day < public.ar_today() THEN
    RAISE EXCEPTION 'The booking''s day has passed' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.previsit_questionnaires q WHERE q.practice_id = v_practice AND jsonb_array_length(q.questions) > 0) THEN
    RAISE EXCEPTION 'The practice has no questions yet: add them in Diary settings' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.previsit_answers a WHERE a.visit_id = p_visit_id) THEN
    RAISE EXCEPTION 'The questions for this booking were already answered' USING ERRCODE = '22023';
  END IF;

  UPDATE public.previsit_links SET expires_at = now()
   WHERE visit_id = p_visit_id AND used_at IS NULL AND expires_at > now();

  -- 16 random bytes as 22 URL-safe characters
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
  -- Until the end of the booking's day in Windhoek, and never more than 30 days
  v_expires := LEAST(((v_day + 1)::timestamp AT TIME ZONE 'Africa/Windhoek'), now() + interval '30 days');
  INSERT INTO public.previsit_links (practice_id, visit_id, token_sha256, expires_at, created_by)
  VALUES (v_practice, p_visit_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_expires, auth.uid());
  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires);
END
$$;

-- 4e. save_previsit_answers(booking, answers): answers given on the practice's tablet at check-in, once. The booking's
--     open link stops working.
CREATE OR REPLACE FUNCTION public.save_previsit_answers(p_visit_id uuid, p_answers jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := public.previsit_practice_for_visit(p_visit_id);
  v_visit public.visits%ROWTYPE;
  v_questions jsonb;
BEGIN
  SELECT * INTO v_visit FROM public.visits WHERE id = p_visit_id FOR UPDATE;
  IF v_visit.patient_id IS NULL THEN
    RAISE EXCEPTION 'The booking has no patient file yet' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_visit.is_cancelled, false) OR COALESCE(v_visit.status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'The booking is cancelled' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.previsit_answers a WHERE a.visit_id = p_visit_id) THEN
    RAISE EXCEPTION 'The questions for this booking were already answered' USING ERRCODE = '23505';
  END IF;
  SELECT q.questions INTO v_questions FROM public.previsit_questionnaires q WHERE q.practice_id = v_practice;
  IF v_questions IS NULL OR jsonb_array_length(v_questions) = 0 THEN
    RAISE EXCEPTION 'The practice has no questions yet: add them in Diary settings' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.previsit_answers (practice_id, patient_id, visit_id, questions, answers, answered_via, recorded_by)
  VALUES (v_practice, v_visit.patient_id, p_visit_id, v_questions, public.previsit_clean_answers(v_questions, p_answers), 'tablet', auth.uid());
  UPDATE public.previsit_links SET used_at = now() WHERE visit_id = p_visit_id AND used_at IS NULL;
END
$$;

-- 4f. previsit_questionnaire(link code, answers): what a patient's browser calls WITHOUT signing in.
--     Without answers: {status: 'open', practice_name, intro, questions} for a valid, unused, unexpired code.
--     With answers: checks them and keeps them once: {status: 'saved'}, or {status: 'invalid', message}.
--     Any other code: {status: 'not_found' | 'expired' | 'answered'}. No patient, practitioner, date or id is ever
--     returned, and nothing else can be read or changed with a code.
CREATE OR REPLACE FUNCTION public.previsit_questionnaire(p_token text, p_answers jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.previsit_links%ROWTYPE;
  v_patient uuid;
  v_questions jsonb;
  v_intro text;
  v_practice_name text;
  v_clean jsonb;
BEGIN
  -- A link code is exactly 22 URL-safe characters; anything else is not one (and is not looked up)
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{22}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT * INTO v_link FROM public.previsit_links
   WHERE token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_link.used_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.previsit_answers a WHERE a.visit_id = v_link.visit_id) THEN
    RETURN jsonb_build_object('status', 'answered');
  END IF;
  SELECT v.patient_id INTO v_patient FROM public.visits v
   WHERE v.id = v_link.visit_id AND v.patient_id IS NOT NULL
     AND NOT COALESCE(v.is_cancelled, false) AND COALESCE(v.status, '') NOT IN ('cancelled', 'no-show', 'completed');
  SELECT q.questions, q.intro INTO v_questions, v_intro FROM public.previsit_questionnaires q WHERE q.practice_id = v_link.practice_id;
  IF v_link.expires_at <= now() OR v_patient IS NULL OR v_questions IS NULL OR jsonb_array_length(v_questions) = 0 THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  SELECT p.name INTO v_practice_name FROM public.practices p WHERE p.id = v_link.practice_id;

  IF p_answers IS NULL THEN
    RETURN jsonb_build_object('status', 'open', 'practice_name', v_practice_name, 'intro', v_intro, 'questions', v_questions);
  END IF;
  BEGIN
    v_clean := public.previsit_clean_answers(v_questions, p_answers);
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN jsonb_build_object('status', 'invalid', 'message', SQLERRM);
  END;
  BEGIN
    INSERT INTO public.previsit_answers (practice_id, patient_id, visit_id, questions, answers, answered_via)
    VALUES (v_link.practice_id, v_patient, v_link.visit_id, v_questions, v_clean, 'link');
  EXCEPTION WHEN unique_violation THEN
    -- Answered on the tablet a moment ago
    RETURN jsonb_build_object('status', 'answered');
  END;
  UPDATE public.previsit_links SET used_at = now() WHERE visit_id = v_link.visit_id AND used_at IS NULL;
  RETURN jsonb_build_object('status', 'saved');
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Row level security and grants
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.previsit_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsit_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsit_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS previsit_questionnaires_staff_read ON public.previsit_questionnaires;
CREATE POLICY previsit_questionnaires_staff_read ON public.previsit_questionnaires FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = previsit_questionnaires.practice_id));
DROP POLICY IF EXISTS previsit_answers_staff_read ON public.previsit_answers;
CREATE POLICY previsit_answers_staff_read ON public.previsit_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = previsit_answers.practice_id));
DROP POLICY IF EXISTS previsit_links_staff_read ON public.previsit_links;
CREATE POLICY previsit_links_staff_read ON public.previsit_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = previsit_links.practice_id));

REVOKE ALL ON public.previsit_questionnaires, public.previsit_answers, public.previsit_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.previsit_questionnaires, public.previsit_answers, public.previsit_links TO authenticated;
GRANT ALL ON public.previsit_questionnaires, public.previsit_answers, public.previsit_links TO service_role;

-- Internal
REVOKE ALL ON FUNCTION public.previsit_practice_for_visit(uuid), public.previsit_clean_answers(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
-- Signed-in staff
REVOKE ALL ON FUNCTION public.save_previsit_questionnaire(uuid, text, jsonb), public.create_previsit_link(uuid),
  public.save_previsit_answers(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_previsit_questionnaire(uuid, text, jsonb), public.create_previsit_link(uuid),
  public.save_previsit_answers(uuid, jsonb) TO authenticated, service_role;
-- The patient's link: the only OneHealth function the public key may run
REVOKE ALL ON FUNCTION public.previsit_questionnaire(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.previsit_questionnaire(text, jsonb) TO anon, authenticated, service_role;

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['previsit_questionnaires', 'previsit_answers', 'previsit_links'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['previsit_questionnaires', 'previsit_answers', 'previsit_links'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION 'check failed: %: row level security is off', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_staff_read') <> 1 THEN
      RAISE EXCEPTION 'check failed: %: the staff read policy is missing', t;
    END IF;
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION 'check failed: %: the patient app''s staff-only guard is missing', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles))
       OR has_table_privilege('anon', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       OR NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION 'check failed: %: signed-in users must read only, anon nothing', t;
    END IF;
  END LOOP;
  -- Only previsit_questionnaire is open to the public key
  IF NOT has_function_privilege('anon', 'public.previsit_questionnaire(text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_previsit_link(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.save_previsit_answers(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.save_previsit_questionnaire(uuid, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.previsit_clean_answers(jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.previsit_practice_for_visit(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.previsit_clean_answers(jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.previsit_practice_for_visit(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: function grants';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname IN ('previsit_practice_for_visit', 'previsit_clean_answers', 'save_previsit_questionnaire',
                                  'create_previsit_link', 'save_previsit_answers', 'previsit_questionnaire')
                AND (NOT p.prosecdef OR NOT (p.proconfig @> ARRAY['search_path=public']))) THEN
    RAISE EXCEPTION 'check failed: every questionnaire function is SECURITY DEFINER with search_path public';
  END IF;
END $$;

ROLLBACK;
