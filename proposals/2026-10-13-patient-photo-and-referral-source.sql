-- Applied 2026-10-13 as migration patient_photo_and_referral_source_2026_10_13 (version 20261013194343; stored statement md5 12f2f200f2ea6cf6c470227cb5e79a85 = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: the patient's photo (parity A12) and "How did you hear about us?" (parity R26)
-- File:   proposals/2026-10-13-patient-photo-and-referral-source.sql         Drafted: 2026-10-13
-- Code:   src/components/patients/photo/* (taking, making small, storing and showing the photo; tested),
--         src/utils/patients/referralSource.ts (the answers, tested), src/components/patients/referralSource/*,
--         src/components/forms/patientExtrasColumns.ts (the columns probe), the registration form, the patient
--         form, the patient file header, the Patients list, the diary day view, the visit tracker, and
--         src/components/finance/practiceReports/* (Reports > Demographics > Heard about us, per month)
--
-- Why (owner's decisions, 13 Oct 2026):
--   A12  Staff take a photo with the device's camera (phone, tablet or webcam) or upload one, at registration or on
--        the patient file; it shows where the patient's initials show (file header, Patients list, diary, visit
--        tracker). The photo is stored in the private "records" bucket (proposals/2026-10-08-records-bucket.sql,
--        applied) under <practice id>/patient-media/<patient id>/photo-<time>.jpg, so the existing storage rules
--        already keep it to the practice's own staff; only the path on the file is new.
--   R26  An optional "How did you hear about us?" at registration, editable on the patient file, counted per month.
--
-- What it does (additive; the policies of patients are not touched)
--   1. patients.photo_path (nullable): the stored photo's path. A check keeps it inside the patient's own practice
--      folder and patient folder, so a file can never point at another practice's photo.
--   2. patients.referral_source (nullable, one of the eight answers in src/utils/patients/referralSource.ts) and
--      patients.referral_source_other (nullable, up to 80 characters, only with 'other'). Staff write them through
--      the existing patients policies; the file's change history records each change (audit_patients_trigger).
--      An index serves the per-month report.
--   3. Checks: the policies of patients did not change; the three columns are there.
--
-- How to apply: rehearse in a transaction that rolls back (reception sets a photo path in its own practice folder:
-- 1 row; a path in another practice's folder or another patient's folder: 23514; an unknown answer: 23514; 'Other'
-- words with another answer: 23514), then apply the part between BEGIN; and ROLLBACK; as one migration
-- (patient_photo_and_referral_source_2026_10_13). Until then the app shows no photo controls and no question:
-- every patient shows their initials, and the Demographics report has no "Heard about us" view.
-- Undo:
--   DROP INDEX IF EXISTS public.patients_referral_source_idx;
--   ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_photo_path_check,
--     DROP CONSTRAINT IF EXISTS patients_referral_source_check, DROP CONSTRAINT IF EXISTS patients_referral_source_other_check;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS referral_source_other, DROP COLUMN IF EXISTS referral_source,
--     DROP COLUMN IF EXISTS photo_path;
--   (Stored photo files stay in "records" under <practice>/patient-media/<patient>/photo-*.jpg; remove them there.)
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'patients'
                AND column_name IN ('photo_path', 'referral_source', 'referral_source_other')
                AND data_type <> 'text') THEN
    RAISE EXCEPTION 'Stopped: patients.photo_path, referral_source or referral_source_other exists with another type';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'records' AND public = false) THEN
    RAISE EXCEPTION 'Stopped: the private bucket "records" is not there (proposals/2026-10-08-records-bucket.sql first)';
  END IF;
  PERFORM set_config('onehealth.patient_policies_before', (
    SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients'
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The patient's photo
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_photo_path_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_photo_path_check CHECK (
  photo_path IS NULL OR (
    split_part(photo_path, '/', 1) = practice_id::text
    AND split_part(photo_path, '/', 2) = 'patient-media'
    AND split_part(photo_path, '/', 3) = id::text
    AND photo_path ~ '^[0-9a-f-]{36}/patient-media/[0-9a-f-]{36}/photo-[0-9]+\.jpg$'
  )
);

COMMENT ON COLUMN public.patients.photo_path IS
  'The patient''s photo in the private bucket "records" (<practice id>/patient-media/<patient id>/photo-<time>.jpg). Shown through short-lived signed links only.';

-- ---------------------------------------------------------------------------------------------
-- 2. "How did you hear about us?" (the same list as REFERRAL_SOURCES in src/utils/patients/referralSource.ts)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_source_other text;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_referral_source_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_referral_source_check CHECK (
  referral_source IS NULL OR referral_source IN (
    'doctor_referral', 'friend_family', 'medical_aid', 'internet', 'social_media', 'walk_in', 'radio_newspaper', 'other'
  )
);

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_referral_source_other_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_referral_source_other_check CHECK (
  referral_source_other IS NULL
  OR (referral_source = 'other' AND char_length(btrim(referral_source_other)) BETWEEN 1 AND 80)
);

COMMENT ON COLUMN public.patients.referral_source IS
  'What the patient answered to "How did you hear about us?" (optional): doctor_referral, friend_family, medical_aid, internet, social_media, walk_in, radio_newspaper or other.';
COMMENT ON COLUMN public.patients.referral_source_other IS
  'The words typed for "Other" (up to 80 characters).';

-- New patients per month by answer (Reports > Demographics)
CREATE INDEX IF NOT EXISTS patients_referral_source_idx
  ON public.patients (practice_id, referral_source) WHERE referral_source IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients')
     IS DISTINCT FROM current_setting('onehealth.patient_policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of patients changed';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'patients'
         AND column_name IN ('photo_path', 'referral_source', 'referral_source_other')) <> 3 THEN
    RAISE EXCEPTION 'Check failed: the three new patients columns are not all there';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
