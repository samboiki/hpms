-- Applied 2026-10-07 as migration patient_safety_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: patient safety records (allergies, "no known allergies", the clinical
-- alert note, the problem list, prescribing despite an allergy) and the record of letters
-- File:    proposals/2026-10-07-patient-safety.sql                  Drafted: 2026-10-07
-- Code:    src/utils/clinical/allergyMatch.ts, problemList.ts, letters.ts (rules, unit tested),
--          src/services/patientSafetyService.ts, src/services/patientLettersService.ts,
--          src/components/patients/safety/* (the alert strip on the patient file and the visit
--          screen, the allergy check when a medicine is added, "add to problem list"),
--          src/components/letters/* (referral letters and letters from the visit and the file)
--
-- Why
--   OneHealth had no allergy record: a practitioner could prescribe amoxicillin to a patient with a
--   penicillin allergy and nothing on screen would say so. Eminance shows an alert text when a file
--   opens; practices also expect a problem list (chronic conditions with ICD-10 codes) and referral
--   letters on the letterhead. This file adds the tables those screens use. Until it is applied the
--   screens say "not switched on yet" and change nothing; everything else keeps working.
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review. Run the whole file once as it is (Supabase SQL editor, or a branch first). It must
--      finish without an error; section 8 reports "patient safety tables ready".
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Nothing to deploy. If a patient file still says "not switched on yet" a minute later, run:
--        NOTIFY pgrst, 'reload schema';
--   Order: after the other October proposals and BEFORE proposals/2026-10-07-patient-portal.sql
--   (scripts/db/rehearsal.ts DEFAULT_ORDER), so the portal's staff-only guard covers these tables.
--   If the portal file was applied first, run afterwards:  SELECT public.portal_apply_staff_guard();
--
-- Who may do what (row level security: the same rule as every staff table, the user's practice in
-- public.users; super admins are not included, as this is clinical data)
--   - Staff of the patient's practice see, add and change these records. Reception may record an
--     allergy the patient reports; it shows as "not verified" until a practitioner, nurse or practice
--     admin (users.role doctor, nurse or admin) verifies it. Who verified and when is stamped by the
--     database from the signed-in user, never taken from the screen.
--   - Nothing is deleted. An allergy or problem is removed by its status ('resolved' / 'past', or
--     'entered_in_error' for a mistake), so the record of what was known stays.
--   - "No known allergies" is a statement someone made: who and when are stamped. It cannot be set
--     while active allergies are recorded, and recording an allergy clears it.
--   - Prescribing despite an allergy needs a reason; the reason, the medicine and who decided are kept
--     (patient_allergy_overrides, insert only).
--   - A letter's content cannot be changed after it is made (only "sent" details are added), so the
--     record shows what was sent.
--   - Patients signed in to the patient app read none of this: these tables have staff policies only,
--     no portal_* function returns them, and the portal file's staff-only guard covers them.
--
-- Contents
--   1. patient_allergies
--   2. patient_clinical_profiles (one row per patient: no known allergies, the alert note)
--   3. patient_problems
--   4. patient_allergy_overrides
--   5. patient_letters
--   6. Triggers: practice from the patient, who and when, the rules above
--   7. Row level security and grants
--   8. Checks (behaviour checks run inside a block that undoes itself)
--   Undo: at the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. patient_allergies
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL,
  patient_id     uuid NOT NULL,
  substance      text NOT NULL,
  reaction       text,
  severity       text NOT NULL DEFAULT 'unknown',
  status         text NOT NULL DEFAULT 'active',
  recorded_by    uuid,
  verified_by    uuid,
  verified_at    timestamptz,
  removed_by     uuid,
  removed_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Named, because the app reads the user names through these relationships
  CONSTRAINT patient_allergies_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_allergies_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergies_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergies_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergies_substance_check CHECK (char_length(btrim(substance)) BETWEEN 1 AND 120),
  CONSTRAINT patient_allergies_reaction_check CHECK (reaction IS NULL OR char_length(reaction) <= 200),
  CONSTRAINT patient_allergies_severity_check CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  CONSTRAINT patient_allergies_status_check CHECK (status IN ('active', 'resolved', 'entered_in_error')),
  -- A verifier always has a time (the verifier's user may be deleted later: then only the time stays)
  CONSTRAINT patient_allergies_verified_check CHECK (verified_by IS NULL OR verified_at IS NOT NULL)
);
COMMENT ON TABLE public.patient_allergies IS
  'Allergies per patient (substance, reaction, severity, who verified). Removed by status, never deleted. See proposals/2026-10-07-patient-safety.sql.';
COMMENT ON COLUMN public.patient_allergies.substance IS 'What the patient is allergic to, as recorded ("Penicillin", "Latex"). Matched by name when medicines are added (src/utils/clinical/allergyMatch.ts).';
COMMENT ON COLUMN public.patient_allergies.status IS 'active | resolved (no longer allergic) | entered_in_error (a mistake).';
COMMENT ON COLUMN public.patient_allergies.verified_by IS 'Practitioner, nurse or admin who confirmed it; stamped by the database from the signed-in user.';

CREATE INDEX IF NOT EXISTS patient_allergies_patient_idx ON public.patient_allergies (patient_id);
-- One active record per substance and patient ("Penicillin" = "penicillin ")
CREATE UNIQUE INDEX IF NOT EXISTS patient_allergies_active_substance_key
  ON public.patient_allergies (patient_id, lower(btrim(substance))) WHERE status = 'active';

-- ---------------------------------------------------------------------------------------------
-- 2. patient_clinical_profiles: one row per patient
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_clinical_profiles (
  patient_id          uuid PRIMARY KEY,
  practice_id         uuid NOT NULL,
  no_known_allergies  boolean NOT NULL DEFAULT false,
  nka_confirmed_by    uuid,
  nka_confirmed_at    timestamptz,
  alert_note          text,
  alert_updated_by    uuid,
  alert_updated_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_clinical_profiles_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_clinical_profiles_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_clinical_profiles_nka_confirmed_by_fkey FOREIGN KEY (nka_confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_clinical_profiles_alert_updated_by_fkey FOREIGN KEY (alert_updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_clinical_profiles_alert_note_check CHECK (alert_note IS NULL OR char_length(alert_note) <= 200)
);
COMMENT ON TABLE public.patient_clinical_profiles IS
  'Per patient: "no known allergies" (who and when) and a short clinical alert note ("pacemaker", "latex gloves"). Shown on the alert strip.';
COMMENT ON COLUMN public.patient_clinical_profiles.no_known_allergies IS
  'True only when someone confirmed the patient has no known allergies. False = not stated (or allergies recorded).';

-- ---------------------------------------------------------------------------------------------
-- 3. patient_problems
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_problems (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  description      text NOT NULL,
  icd10_code       text,
  status           text NOT NULL DEFAULT 'active',
  chronic          boolean NOT NULL DEFAULT false,
  onset_date       date,
  resolved_date    date,
  source_visit_id  uuid,
  note             text,
  recorded_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_problems_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_problems_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_problems_source_visit_id_fkey FOREIGN KEY (source_visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT patient_problems_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_problems_description_check CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  -- The WHO ICD-10 shape used in Namibia (src/utils/billing/icd10.ts): A00, J06.9, S52.50
  CONSTRAINT patient_problems_icd10_check CHECK (icd10_code IS NULL OR icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$'),
  CONSTRAINT patient_problems_status_check CHECK (status IN ('active', 'past', 'entered_in_error')),
  CONSTRAINT patient_problems_dates_check CHECK (resolved_date IS NULL OR onset_date IS NULL OR resolved_date >= onset_date),
  CONSTRAINT patient_problems_note_check CHECK (note IS NULL OR char_length(note) <= 500)
);
COMMENT ON TABLE public.patient_problems IS
  'Problem list: active and past conditions with ICD-10 codes. Visit diagnoses are added in one tap. Removed by status, never deleted.';
COMMENT ON COLUMN public.patient_problems.source_visit_id IS 'The visit whose diagnosis it was added from, when it came from a visit.';

CREATE INDEX IF NOT EXISTS patient_problems_patient_idx ON public.patient_problems (patient_id);
-- One active entry per code and patient
CREATE UNIQUE INDEX IF NOT EXISTS patient_problems_active_code_key
  ON public.patient_problems (patient_id, icd10_code) WHERE status = 'active' AND icd10_code IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 4. patient_allergy_overrides: a medicine prescribed despite a recorded allergy, and why
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_allergy_overrides (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL,
  patient_id         uuid NOT NULL,
  visit_id           uuid,
  allergy_id         uuid,
  allergy_substance  text NOT NULL,
  medicine           text NOT NULL,
  reason             text NOT NULL,
  overridden_by      uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_allergy_overrides_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_allergy_overrides_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_allergy_overrides_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergy_overrides_allergy_id_fkey FOREIGN KEY (allergy_id) REFERENCES public.patient_allergies(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergy_overrides_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_allergy_overrides_reason_check CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300),
  CONSTRAINT patient_allergy_overrides_medicine_check CHECK (char_length(btrim(medicine)) BETWEEN 1 AND 200)
);
COMMENT ON TABLE public.patient_allergy_overrides IS
  'Kept when a medicine is added despite an allergy warning: the medicine, the allergy (as it read then), the reason and who decided. Insert only.';

CREATE INDEX IF NOT EXISTS patient_allergy_overrides_patient_idx ON public.patient_allergy_overrides (patient_id);

-- ---------------------------------------------------------------------------------------------
-- 5. patient_letters: referral letters and other letters (sick notes stay in leave_forms)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_letters (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  visit_id         uuid,
  kind             text NOT NULL,
  title            text NOT NULL,
  recipient_name   text,
  recipient_email  text,
  letter_date      date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Windhoek')::date),
  valid_until      date,
  -- The letter as made (recipient, paragraphs, sections, signature): reprinted exactly from this
  content          jsonb NOT NULL,
  author_id        uuid,
  sent_at          timestamptz,
  sent_via         text,
  sent_to          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_letters_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT patient_letters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT patient_letters_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT patient_letters_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT patient_letters_kind_check CHECK (kind IN ('referral', 'letter')),
  CONSTRAINT patient_letters_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT patient_letters_content_check CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT patient_letters_sent_via_check CHECK (sent_via IS NULL OR sent_via IN ('email')),
  CONSTRAINT patient_letters_valid_until_check CHECK (valid_until IS NULL OR valid_until >= letter_date)
);
COMMENT ON TABLE public.patient_letters IS
  'Letters written for a patient (referral, general letter): what was written, by whom, and when it was emailed. Content never changes after it is made.';
COMMENT ON COLUMN public.patient_letters.valid_until IS 'Referrals: the last day the referral is valid.';

CREATE INDEX IF NOT EXISTS patient_letters_patient_idx ON public.patient_letters (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_letters_visit_idx ON public.patient_letters (visit_id) WHERE visit_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------------------------

-- 6a. Every record belongs to its patient's practice, whatever the screen sends, and never moves
--     to another patient. Row level security then checks the user belongs to that practice.
CREATE OR REPLACE FUNCTION public.patient_safety_set_practice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.patient_id := OLD.patient_id;
    NEW.practice_id := OLD.practice_id;
    RETURN NEW;
  END IF;
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = NEW.patient_id;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'The patient was not found or has no practice' USING ERRCODE = '23514';
  END IF;
  NEW.practice_id := v_practice;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_allergies_set_practice ON public.patient_allergies;
CREATE TRIGGER patient_allergies_set_practice BEFORE INSERT OR UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.patient_safety_set_practice();
DROP TRIGGER IF EXISTS patient_clinical_profiles_set_practice ON public.patient_clinical_profiles;
CREATE TRIGGER patient_clinical_profiles_set_practice BEFORE INSERT OR UPDATE ON public.patient_clinical_profiles
  FOR EACH ROW EXECUTE FUNCTION public.patient_safety_set_practice();
DROP TRIGGER IF EXISTS patient_problems_set_practice ON public.patient_problems;
CREATE TRIGGER patient_problems_set_practice BEFORE INSERT OR UPDATE ON public.patient_problems
  FOR EACH ROW EXECUTE FUNCTION public.patient_safety_set_practice();
DROP TRIGGER IF EXISTS patient_allergy_overrides_set_practice ON public.patient_allergy_overrides;
CREATE TRIGGER patient_allergy_overrides_set_practice BEFORE INSERT ON public.patient_allergy_overrides
  FOR EACH ROW EXECUTE FUNCTION public.patient_safety_set_practice();
DROP TRIGGER IF EXISTS patient_letters_set_practice ON public.patient_letters;
CREATE TRIGGER patient_letters_set_practice BEFORE INSERT OR UPDATE ON public.patient_letters
  FOR EACH ROW EXECUTE FUNCTION public.patient_safety_set_practice();

-- 6b. Allergies: who recorded, verified and removed it, stamped from the signed-in user. Only a
--     practitioner, nurse or practice admin may verify. A verification cannot be undone or forged,
--     the substance of a record cannot be changed (record a new one), and a removed record is final.
--     auth.uid() is null in the SQL editor and for the service role: the role check is skipped there.
CREATE OR REPLACE FUNCTION public.patient_allergies_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.substance := btrim(NEW.substance);
    NEW.recorded_by := auth.uid();
    NEW.created_at := now();
    NEW.removed_by := NULL;
    NEW.removed_at := NULL;
    IF NEW.status <> 'active' THEN
      RAISE EXCEPTION 'A new allergy is always recorded as active' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD.status <> 'active' THEN
      RAISE EXCEPTION 'A removed allergy cannot be changed. Record it again if needed.' USING ERRCODE = '23514';
    END IF;
    NEW.substance := OLD.substance;
    NEW.recorded_by := OLD.recorded_by;
    NEW.created_at := OLD.created_at;
  END IF;

  IF NEW.verified_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.verified_at IS NULL) THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
      IF COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
        RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can verify an allergy' USING ERRCODE = '42501';
      END IF;
    END IF;
    NEW.verified_by := auth.uid();
    NEW.verified_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.verified_by := OLD.verified_by;
    NEW.verified_at := OLD.verified_at;
  ELSE
    NEW.verified_by := NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> 'active' THEN
    NEW.removed_by := auth.uid();
    NEW.removed_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.removed_by := NULL;
    NEW.removed_at := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_allergies_stamp ON public.patient_allergies;
CREATE TRIGGER patient_allergies_stamp BEFORE INSERT OR UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.patient_allergies_stamp();

-- 6c. Recording an active allergy ends "no known allergies"
CREATE OR REPLACE FUNCTION public.patient_allergies_clear_nka()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.patient_clinical_profiles
    SET no_known_allergies = false
    WHERE patient_id = NEW.patient_id AND no_known_allergies;
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS patient_allergies_clear_nka ON public.patient_allergies;
CREATE TRIGGER patient_allergies_clear_nka AFTER INSERT ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.patient_allergies_clear_nka();

-- 6d. Profiles: "no known allergies" only without active allergies, with who and when; the alert
--     note's author and time
CREATE OR REPLACE FUNCTION public.patient_clinical_profiles_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  NEW.alert_note := NULLIF(btrim(COALESCE(NEW.alert_note, '')), '');
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;

  IF NEW.no_known_allergies AND (TG_OP = 'INSERT' OR NOT OLD.no_known_allergies) THEN
    IF EXISTS (SELECT 1 FROM public.patient_allergies a WHERE a.patient_id = NEW.patient_id AND a.status = 'active') THEN
      RAISE EXCEPTION 'This patient has recorded allergies. Remove them before marking "no known allergies".' USING ERRCODE = '23514';
    END IF;
    NEW.nka_confirmed_by := auth.uid();
    NEW.nka_confirmed_at := now();
  ELSIF NOT NEW.no_known_allergies THEN
    NEW.nka_confirmed_by := NULL;
    NEW.nka_confirmed_at := NULL;
  ELSE
    NEW.nka_confirmed_by := OLD.nka_confirmed_by;
    NEW.nka_confirmed_at := OLD.nka_confirmed_at;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.alert_note IS NOT NULL) OR (TG_OP = 'UPDATE' AND NEW.alert_note IS DISTINCT FROM OLD.alert_note) THEN
    NEW.alert_updated_by := auth.uid();
    NEW.alert_updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.alert_updated_by := OLD.alert_updated_by;
    NEW.alert_updated_at := OLD.alert_updated_at;
  ELSE
    NEW.alert_updated_by := NULL;
    NEW.alert_updated_at := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_clinical_profiles_stamp ON public.patient_clinical_profiles;
CREATE TRIGGER patient_clinical_profiles_stamp BEFORE INSERT OR UPDATE ON public.patient_clinical_profiles
  FOR EACH ROW EXECUTE FUNCTION public.patient_clinical_profiles_stamp();

-- 6e. Problems: tidy text and code, who recorded it, the day a problem became past (Windhoek date)
CREATE OR REPLACE FUNCTION public.patient_problems_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.description := btrim(regexp_replace(NEW.description, '\s+', ' ', 'g'));
  NEW.icd10_code := NULLIF(upper(btrim(COALESCE(NEW.icd10_code, ''))), '');
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.recorded_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.recorded_by := OLD.recorded_by;
    NEW.created_at := OLD.created_at;
    NEW.source_visit_id := OLD.source_visit_id;
  END IF;
  IF NEW.status = 'past' AND NEW.resolved_date IS NULL THEN
    NEW.resolved_date := (now() AT TIME ZONE 'Africa/Windhoek')::date;
  ELSIF NEW.status = 'active' THEN
    NEW.resolved_date := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_problems_stamp ON public.patient_problems;
CREATE TRIGGER patient_problems_stamp BEFORE INSERT OR UPDATE ON public.patient_problems
  FOR EACH ROW EXECUTE FUNCTION public.patient_problems_stamp();

-- 6f. Overrides: who decided and when, from the signed-in user
CREATE OR REPLACE FUNCTION public.patient_allergy_overrides_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.overridden_by := auth.uid();
  NEW.created_at := now();
  NEW.reason := btrim(NEW.reason);
  NEW.medicine := btrim(NEW.medicine);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_allergy_overrides_stamp ON public.patient_allergy_overrides;
CREATE TRIGGER patient_allergy_overrides_stamp BEFORE INSERT ON public.patient_allergy_overrides
  FOR EACH ROW EXECUTE FUNCTION public.patient_allergy_overrides_stamp();

-- 6g. Letters: the author is the signed-in user; after it is made only the "sent" details change
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
  NEW.author_id := OLD.author_id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_letters_stamp ON public.patient_letters;
CREATE TRIGGER patient_letters_stamp BEFORE INSERT OR UPDATE ON public.patient_letters
  FOR EACH ROW EXECUTE FUNCTION public.patient_letters_stamp();

-- ---------------------------------------------------------------------------------------------
-- 7. Row level security and grants: staff of the patient's practice. No DELETE policies: records
--    are removed by status. Overrides are insert-only.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_clinical_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_allergy_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_allergies_select ON public.patient_allergies;
CREATE POLICY patient_allergies_select ON public.patient_allergies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergies.practice_id));
DROP POLICY IF EXISTS patient_allergies_insert ON public.patient_allergies;
CREATE POLICY patient_allergies_insert ON public.patient_allergies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergies.practice_id));
DROP POLICY IF EXISTS patient_allergies_update ON public.patient_allergies;
CREATE POLICY patient_allergies_update ON public.patient_allergies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergies.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergies.practice_id));

DROP POLICY IF EXISTS patient_clinical_profiles_select ON public.patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_select ON public.patient_clinical_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_clinical_profiles.practice_id));
DROP POLICY IF EXISTS patient_clinical_profiles_insert ON public.patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_insert ON public.patient_clinical_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_clinical_profiles.practice_id));
DROP POLICY IF EXISTS patient_clinical_profiles_update ON public.patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_update ON public.patient_clinical_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_clinical_profiles.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_clinical_profiles.practice_id));

DROP POLICY IF EXISTS patient_problems_select ON public.patient_problems;
CREATE POLICY patient_problems_select ON public.patient_problems FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_problems.practice_id));
DROP POLICY IF EXISTS patient_problems_insert ON public.patient_problems;
CREATE POLICY patient_problems_insert ON public.patient_problems FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_problems.practice_id));
DROP POLICY IF EXISTS patient_problems_update ON public.patient_problems;
CREATE POLICY patient_problems_update ON public.patient_problems FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_problems.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_problems.practice_id));

DROP POLICY IF EXISTS patient_allergy_overrides_select ON public.patient_allergy_overrides;
CREATE POLICY patient_allergy_overrides_select ON public.patient_allergy_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergy_overrides.practice_id));
DROP POLICY IF EXISTS patient_allergy_overrides_insert ON public.patient_allergy_overrides;
CREATE POLICY patient_allergy_overrides_insert ON public.patient_allergy_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_allergy_overrides.practice_id));

DROP POLICY IF EXISTS patient_letters_select ON public.patient_letters;
CREATE POLICY patient_letters_select ON public.patient_letters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_letters.practice_id));
DROP POLICY IF EXISTS patient_letters_insert ON public.patient_letters;
CREATE POLICY patient_letters_insert ON public.patient_letters FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_letters.practice_id));
DROP POLICY IF EXISTS patient_letters_update ON public.patient_letters;
CREATE POLICY patient_letters_update ON public.patient_letters FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_letters.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_letters.practice_id));

REVOKE ALL ON public.patient_allergies, public.patient_clinical_profiles, public.patient_problems,
  public.patient_allergy_overrides, public.patient_letters FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.patient_allergies, public.patient_clinical_profiles, public.patient_problems,
  public.patient_letters TO authenticated;
GRANT SELECT, INSERT ON public.patient_allergy_overrides TO authenticated;
GRANT ALL ON public.patient_allergies, public.patient_clinical_profiles, public.patient_problems,
  public.patient_allergy_overrides, public.patient_letters TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 8. Checks
-- ---------------------------------------------------------------------------------------------

-- 8a. Row level security is on, the expected policies exist, and none of them is for anon
DO $$
DECLARE
  t record;
  v_count integer;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('patient_allergies', 3), ('patient_clinical_profiles', 3), ('patient_problems', 3),
      ('patient_allergy_overrides', 2), ('patient_letters', 3)
    ) AS expected(name, policies)
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t.name)::regclass) THEN
      RAISE EXCEPTION '%: row level security is off', t.name;
    END IF;
    SELECT count(*) INTO v_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t.name AND policyname LIKE t.name || '\_%';
    IF v_count <> t.policies THEN
      RAISE EXCEPTION '%: expected % staff policies, found %', t.name, t.policies, v_count;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t.name AND 'anon' = ANY (roles)) THEN
      RAISE EXCEPTION '%: a policy is open to anon', t.name;
    END IF;
  END LOOP;
END $$;

-- 8b. Behaviour, on one existing patient, inside a block that undoes itself (nothing is left behind,
--     also when this file ends in COMMIT)
DO $$
DECLARE
  v_patient uuid;
  v_allergy uuid;
  v_problem uuid;
  v_letter uuid;
  v_nka boolean;
  v_title text;
BEGIN
  SELECT p.id INTO v_patient
  FROM public.patients p
  WHERE p.practice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.patient_clinical_profiles c WHERE c.patient_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.patient_allergies a WHERE a.patient_id = p.id)
  LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE NOTICE 'No suitable patient: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    -- "No known allergies", then an allergy: the allergy ends it
    INSERT INTO public.patient_clinical_profiles (patient_id, practice_id, no_known_allergies) VALUES (v_patient, gen_random_uuid(), true);
    INSERT INTO public.patient_allergies (patient_id, practice_id, substance, severity) VALUES (v_patient, gen_random_uuid(), ' Penicillin ', 'severe')
      RETURNING id INTO v_allergy;
    SELECT no_known_allergies INTO v_nka FROM public.patient_clinical_profiles WHERE patient_id = v_patient;
    IF v_nka THEN
      RAISE EXCEPTION 'check failed: recording an allergy did not end "no known allergies"';
    END IF;

    -- "No known allergies" is refused while an allergy is active
    BEGIN
      UPDATE public.patient_clinical_profiles SET no_known_allergies = true WHERE patient_id = v_patient;
      RAISE EXCEPTION 'check failed: "no known allergies" was accepted with an active allergy';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- The same substance cannot be active twice
    BEGIN
      INSERT INTO public.patient_allergies (patient_id, practice_id, substance) VALUES (v_patient, gen_random_uuid(), 'penicillin');
      RAISE EXCEPTION 'check failed: a second active "penicillin" was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- Removing it stamps the removal; a removed record is final
    UPDATE public.patient_allergies SET status = 'entered_in_error' WHERE id = v_allergy;
    IF (SELECT removed_at FROM public.patient_allergies WHERE id = v_allergy) IS NULL THEN
      RAISE EXCEPTION 'check failed: the removal time was not stamped';
    END IF;
    BEGIN
      UPDATE public.patient_allergies SET status = 'active' WHERE id = v_allergy;
      RAISE EXCEPTION 'check failed: a removed allergy was made active again';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.patient_clinical_profiles SET no_known_allergies = true WHERE patient_id = v_patient;

    -- Problems: the ICD-10 shape is enforced, "past" gets a date
    BEGIN
      INSERT INTO public.patient_problems (patient_id, practice_id, description, icd10_code) VALUES (v_patient, gen_random_uuid(), 'Check', 'HT1');
      RAISE EXCEPTION 'check failed: a malformed ICD-10 code was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.patient_problems (patient_id, practice_id, description, icd10_code) VALUES (v_patient, gen_random_uuid(), 'Hypertension', 'i10')
      RETURNING id INTO v_problem;
    UPDATE public.patient_problems SET status = 'past' WHERE id = v_problem;
    IF (SELECT resolved_date FROM public.patient_problems WHERE id = v_problem) IS NULL THEN
      RAISE EXCEPTION 'check failed: a past problem has no resolved date';
    END IF;

    -- Overrides need a reason
    BEGIN
      INSERT INTO public.patient_allergy_overrides (patient_id, practice_id, allergy_substance, medicine, reason)
      VALUES (v_patient, gen_random_uuid(), 'Penicillin', 'Amoxicillin', ' ');
      RAISE EXCEPTION 'check failed: an override without a reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- A letter's content does not change after it is made
    INSERT INTO public.patient_letters (patient_id, practice_id, kind, title, content)
    VALUES (v_patient, gen_random_uuid(), 'referral', 'Referral (check)', '{"paragraphs": []}'::jsonb)
    RETURNING id INTO v_letter;
    UPDATE public.patient_letters SET title = 'Changed', sent_via = 'email', sent_at = now() WHERE id = v_letter;
    SELECT title INTO v_title FROM public.patient_letters WHERE id = v_letter;
    IF v_title <> 'Referral (check)' THEN
      RAISE EXCEPTION 'check failed: a letter was changed after it was made';
    END IF;

    RAISE EXCEPTION USING MESSAGE = 'patient_safety_checks_passed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'patient_safety_checks_passed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'patient safety tables ready: row level security on, rules checked (test rows undone)';
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed; removes every allergy, alert, problem, override and letter record):
--   DROP TABLE IF EXISTS public.patient_letters, public.patient_allergy_overrides, public.patient_problems,
--     public.patient_clinical_profiles, public.patient_allergies;
--   DROP FUNCTION IF EXISTS public.patient_safety_set_practice(), public.patient_allergies_stamp(),
--     public.patient_allergies_clear_nka(), public.patient_clinical_profiles_stamp(), public.patient_problems_stamp(),
--     public.patient_allergy_overrides_stamp(), public.patient_letters_stamp();
-- The screens then say "not switched on yet" again and keep working.
-- =============================================================================================
