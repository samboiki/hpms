-- Applied 2026-10-13 as migration consent_files_locked_2026_10_13 (version 20261012232838; stored statement md5 20dc1fa6c2a6cbe6aca0e4bcb872975d = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 of record_patient_consent afterwards 2383dcf12172951f938f097572b86c7b (the consents folder required).
-- Rehearsed with simulated logins (rolled back; once before applying and again after, same results), with
-- storage.allow_delete_query set as the Storage API sets it: reception uploaded a consent PDF (1 row); the same name
-- again was refused (23505) and an upsert over it too (42501); replacing its metadata, archiving it, moving it out and
-- deleting it changed 0 rows. In other folders reception changed a file (1 row), renamed a prescription (1) and
-- deleted two files (2), but could not move one into a consents folder (42501); the media bucket still let it upload
-- and delete (1). A consent was recorded with its PDF in the folder; one outside it was refused by the function
-- (22023) and by the table check (23514). The practice's administrator and a practitioner deleted and replaced 0 rows
-- (the administrator could still upload a new form, 1 row); another practice could not upload into the folder (42501)
-- and deleted 0; OneHealth support, a patient-app login and anon deleted or replaced 0 (anon's upload 42501). The PDF
-- was still there, unchanged; the service role could delete (1), as before. Two RESTRICTIVE policies added; the other
-- 20 storage policies were unchanged (fingerprint b200f15fb96c7867e784285482f53a5c before and after).
-- =============================================================================================
-- PROPOSAL: a signed consent form's PDF is uploaded once and is then never deleted, replaced or moved (parity C14)
-- File:   proposals/2026-10-13-consent-files-locked.sql                  Drafted: 2026-10-13
-- Code:   src/services/patientConsentsService.ts (consentPdfPath: <practice>/patient-documents/<patient>/consents/...)
--
-- Why: a signed consent is a legal record. proposals/2026-10-13-patient-file-extras.sql records each form once in
-- patient_consents and never changes it, but the PDF itself sat in the records bucket under the rules of every other
-- record file (proposals/2026-10-08-records-bucket.sql): records_staff_update and records_staff_delete let any staff
-- member of the practice replace or delete any file of the practice. The text, signature and SHA-256 kept with the form
-- showed a change afterwards; now the file cannot be changed at all.
--
-- What it does (every other folder of the records bucket, and every other bucket, behave as before)
--   1. Two RESTRICTIVE policies on storage.objects for the consents folder of the records bucket
--      (<practice id>/patient-documents/<patient id>/consents/...):
--        records_consents_no_delete: nothing in a consents folder is deleted;
--        records_consents_no_update: nothing in a consents folder is replaced, renamed, archived or moved out, and
--          nothing is moved in.
--      A new file there is still uploaded under records_staff_insert (the practice's staff, as before), once: a second
--      upload under the same name is refused by the bucket's unique name, and an upload that would replace the file
--      (an upsert) is an update, refused. RESTRICTIVE policies only narrow what the permissive policies allow, and only
--      for rows in a consents folder: every other row passes them unchanged. Reading is unchanged. They bind every role
--      under row level security (signed-in staff and the public key); the service role (OneHealth support tools, the
--      record-move script) is not under row level security, as before, for a lawful removal.
--   2. patient_consents: a form's PDF must be in that folder (the check patient_consents_file_check and
--      record_patient_consent, which is replaced with that one check added), so every recorded consent is protected.
--      No form had been recorded yet (0 rows), and the app has always stored them there.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Needs proposals/2026-10-08-records-bucket.sql and 2026-10-13-patient-file-extras.sql.
-- Undo:
--   DROP POLICY IF EXISTS records_consents_no_delete ON storage.objects;
--   DROP POLICY IF EXISTS records_consents_no_update ON storage.objects;
--   Put back patient_consents_file_check and record_patient_consent as proposals/2026-10-13-patient-file-extras.sql
--   wrote them (without the consents folder).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'records' AND NOT b.public) THEN
    RAISE EXCEPTION 'Stopped: the private records bucket must exist first (2026-10-08-records-bucket.sql)';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects' AND permissive = 'PERMISSIVE'
         AND policyname IN ('records_staff_read', 'records_staff_insert', 'records_staff_update', 'records_staff_delete')) <> 4 THEN
    RAISE EXCEPTION 'Stopped: the records bucket''s four staff policies are not as 2026-10-08-records-bucket.sql left them';
  END IF;
  IF to_regclass('public.patient_consents') IS NULL THEN
    RAISE EXCEPTION 'Stopped: patient_consents must exist first (2026-10-13-patient-file-extras.sql)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.patient_consents c WHERE split_part(c.file_path, '/', 4) <> 'consents') THEN
    RAISE EXCEPTION 'Stopped: a recorded consent form''s PDF is outside a consents folder; move it before applying';
  END IF;
  -- Section 2 replaces record_patient_consent: only when it is as the patient-file-extras file left it (c91d3a...) or
  -- as this file writes it (2383dc..., when run again)
  IF (SELECT md5(p.prosrc) FROM pg_proc p
       WHERE p.oid = 'public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer)'::regprocedure)
     NOT IN ('c91d3a6b1b6aac0039b6794055ae927f', '2383dcf12172951f938f097572b86c7b') THEN
    RAISE EXCEPTION 'Stopped: record_patient_consent() is not as proposals/2026-10-13-patient-file-extras.sql left it; merge section 2 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Nothing in a consents folder of the records bucket is deleted, replaced or moved
-- ---------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS records_consents_no_delete ON storage.objects;
CREATE POLICY records_consents_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO public
  USING (NOT COALESCE(bucket_id = 'records' AND split_part(name, '/', 2) = 'patient-documents' AND split_part(name, '/', 4) = 'consents', false));

-- USING: a file in a consents folder is never changed or moved out; WITH CHECK: no file is moved (or renamed) into one
DROP POLICY IF EXISTS records_consents_no_update ON storage.objects;
CREATE POLICY records_consents_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
  USING (NOT COALESCE(bucket_id = 'records' AND split_part(name, '/', 2) = 'patient-documents' AND split_part(name, '/', 4) = 'consents', false))
  WITH CHECK (NOT COALESCE(bucket_id = 'records' AND split_part(name, '/', 2) = 'patient-documents' AND split_part(name, '/', 4) = 'consents', false));

-- ---------------------------------------------------------------------------------------------
-- 2. A recorded consent form's PDF is always in its patient's consents folder
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_consents DROP CONSTRAINT IF EXISTS patient_consents_file_check;
ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_file_check CHECK (
  char_length(file_path) <= 500 AND split_part(file_path, '/', 1) = practice_id::text
  AND split_part(file_path, '/', 2) = 'patient-documents' AND split_part(file_path, '/', 4) = 'consents'
  AND lower(right(file_path, 4)) = '.pdf');

-- As proposals/2026-10-13-patient-file-extras.sql wrote it, with the consents folder required
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
  -- The consents folder of the patient's documents, where the files cannot be deleted or replaced
  IF char_length(v_path) > 500 OR split_part(v_path, '/', 1) <> v_practice::text
     OR split_part(v_path, '/', 2) <> 'patient-documents' OR split_part(v_path, '/', 4) <> 'consents'
     OR lower(right(v_path, 4)) <> '.pdf' OR v_path LIKE '%..%' THEN
    RAISE EXCEPTION 'The signed form must be kept in the patient''s consent forms folder of your practice.' USING ERRCODE = '22023';
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

-- The grants stay as the patient-file-extras file set them (a replaced function keeps them); said again for a rerun
REVOKE ALL ON FUNCTION public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_patient_consent(uuid, uuid, uuid, text, text, text, jsonb, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd, roles::text FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'records_%'
 ORDER BY policyname;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
