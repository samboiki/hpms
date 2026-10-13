-- Applied 2026-10-08 as migration records_bucket_2026_10_08
-- =============================================================================================
-- PROPOSAL: patient and staff records in a private bucket ("records"), opened through short-lived links
-- File:    proposals/2026-10-08-records-bucket.sql                         Drafted: 2026-10-08
--
-- Why (owner decision of 2026-10-08, see "Still open" in 2026-10-08-practice-isolation-2.sql)
--   Bucket "documents" is public: the storage server hands out any of its files to anyone who knows the
--   path, without signing in and without asking the bucket's policies. It holds 134 files: visit
--   invoices (invoices/, 19) and sick notes (leave_forms/, 33) under guessable names, prescriptions (17),
--   lab and imaging results (9, 4), timesheets (4), patient documents and media under patient folders
--   (35) and practice documents (7), next to the practice logo, staff avatars and signatures (6), which
--   printouts and practice websites show through public links. Since 2026-10-08 its policies are
--   staff-only and practice-scoped, but invoices/ and leave_forms/ could not be scoped (no practice id in
--   their paths) and a public bucket skips the policies for downloads anyway.
--
-- The rules
--   1. Bucket "records" is private: the storage server serves a file only to a signed-in user its
--      policies allow, or through a signed link that expires. The app makes a 10-minute link at the
--      moment someone opens a file and stores paths, never links (src/services/recordFiles.ts).
--   2. Paths are <practice id>/<kind>/...: the first folder is the practice the record belongs to.
--      Kinds: prescriptions, leave_forms, invoices, patient-documents, patient-media, lab-results,
--      imaging-results, practice-documents, timesheets, leave-documents (recordFiles.ts RECORD_KINDS).
--   3. Staff of that practice (users.practice_id of an active staff member: rls_my_practice_id) read,
--      upload, replace and delete its files. Super admins (rls_is_super_admin) read every practice's
--      files (admin portal) and write only under their own practice. Signed-in logins without a staff
--      row (the patient app's), staff of other practices and the public key get nothing. The helpers
--      come from proposals/2026-10-07-practice-isolation.sql.
--   4. Logos, avatars and signatures stay in "documents" (public on purpose).
--
-- How it was applied
--   Additive: the live app (July 2025 build) never uses this bucket. Rehearsed once, before applying,
--   inside one rolled-back DO block (this file's statements, then the tests below as staff of practice A
--   (b646) and B (ffed), a super admin of a third practice, A's administrator made inactive, a signed-in
--   outsider without a staff row and the anon key, on storage.objects rows inserted inside the block).
--   Then applied as migration records_bucket_2026_10_08 (version 20261008124405): this file's statements
--   between BEGIN; and ROLLBACK; (3,861 characters, md5 6364c391ed525cada894fd2712e2fdae, the same as the
--   stored migration), and the tests run again (rolled back). Order for a rehearsal: after
--   proposals/2026-10-07-practice-isolation.sql (its rls_* helpers), before 2026-10-07-patient-portal.sql.
--
-- Moving the existing files: NOT part of this migration (run at release time)
--   The live app (July 2025 build) still opens the public links, so the files move only when this
--   version of the app is live: node scripts/storage/move-records.ts (plan and counts, changes nothing),
--   then node scripts/storage/move-records.ts --apply (needs SUPABASE_DB_URL, SUPABASE_DB_CA, the project
--   URL and SUPABASE_SERVICE_ROLE_KEY in .env). The plan is scripts/storage/record-moves.sql. Per file:
--     1. the practice: that of the row pointing at the file (visit_documents.practice_id; the patient's
--        practice for patient_documents, patient_media, patient_imaging, patient_laboratory;
--        practice_documents.practice_id; lab_requests.practice_id, else its patient's; the staff
--        member's for timesheets and leave_requests); for a file no row points at, the practice its path
--        names (practice, patient, visit, staff member, leave form or invoice number), else that of the
--        staff member who uploaded it. A file that rows of two practices point at, or whose practice
--        cannot be found, is kept where it is and counted;
--     2. copy it to records/<practice>/<kind>/<rest of its path> (an existing copy is kept, so a stopped
--        run can be started again);
--     3. repoint every row (path, bucket column, or the old public or signed link) to the new path, each
--        update checked against the old value;
--     4. only then delete the public copy.
--   Plan on 2026-10-08 (read-only, counts only): 128 record files in "documents" (134 less 4 avatars,
--   1 signature, 1 logo), all 128 would move and none stay; 2 practices; 102 MB to copy.
--     Rows repointed: 112 (visit_documents 65, patient_media 20, patient_imaging 7, practice_documents 6,
--       lab_requests 5 (4 public links, 1 expired signed link), patient_documents 3, patient_laboratory 3,
--       timesheets 3 (public links)); 20 of them (patient_media 10, patient_imaging 7, patient_laboratory 3)
--       also hold the path in file_name, moved with it. leave_requests: none.
--     Files: 112 that rows point at, 16 that no row points at (practice from the path 12, from the
--       uploader 4: sick notes whose form number names no single practice). By kind: leave_forms 33, patient-media 20,
--       invoices 19, prescriptions 17, lab-results 12, imaging-results 8, patient-documents 8,
--       practice-documents 7, timesheets 4. Copies 128, public copies deleted 128.
--
-- Test results (counts only; identical in the rehearsal and after applying, both rolled back)
--   Personas: A receptionist / A administrator / B doctor / super admin (a third practice) / signed-in
--   outsider (no staff row) / anon key, with one file under A and one under B inserted in the block.
--   Bucket "records" private. Reads: records 1/1/1/2/0/0; documents 102/102/84/134/0/0 (unchanged).
--   Uploads: A staff under A (receptionist, administrator) and B's doctor under B, a super admin under
--   their own practice: allowed; A staff under B, with the practice not first (lab-results/<A>/...),
--   without a practice (invoices/...), with the practice id in capitals, a super admin under B, the
--   outsider and the anon key: refused (42501). Replace: A staff on A's file 1 row, on B's file 0, moving
--   A's file into B's folder 42501, a super admin on B's file 0. Delete: A staff on A's file 1 row; A staff,
--   a super admin, the outsider and the anon key on another practice's file 0. A's administrator made
--   inactive: reads 0, upload 42501.
--
-- Still open / for the owner (not changed here)
--   - Bucket "media" is public and its read policies are granted to the public key, so anyone can list
--     and download its 17 files: photos and lab reports uploaded for AI reading from the visit forms
--     (no row points at them, no practice in their paths, no uploader recorded). This version uploads
--     those to "records"; review and delete the 17 files, then drop the media policies granted to
--     public/anon.
--   - After the move, "documents" holds only logos, avatars and signatures; it can stay public.
--   - 11 screens nothing imports any more still upload records to "documents" or "media" (listed in
--     src/services/__tests__/recordFiles.guard.test.ts, which fails if one is imported again): delete them.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The bucket: private, so the storage server never serves a file without a policy or a signed link
-- ---------------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('records', 'records', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ---------------------------------------------------------------------------------------------
-- 2. Policies: the first folder is the practice; its staff read and write, super admins read
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS records_staff_read ON storage.objects;
CREATE POLICY records_staff_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'records'
         AND (split_part(name, '/', 1) = (SELECT public.rls_my_practice_id())::text
              OR (SELECT public.rls_is_super_admin())));
DROP POLICY IF EXISTS records_staff_insert ON storage.objects;
CREATE POLICY records_staff_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'records' AND split_part(name, '/', 1) = (SELECT public.rls_my_practice_id())::text);
DROP POLICY IF EXISTS records_staff_update ON storage.objects;
CREATE POLICY records_staff_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'records' AND split_part(name, '/', 1) = (SELECT public.rls_my_practice_id())::text)
  WITH CHECK (bucket_id = 'records' AND split_part(name, '/', 1) = (SELECT public.rls_my_practice_id())::text);
DROP POLICY IF EXISTS records_staff_delete ON storage.objects;
CREATE POLICY records_staff_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'records' AND split_part(name, '/', 1) = (SELECT public.rls_my_practice_id())::text);

-- ---------------------------------------------------------------------------------------------
-- 3. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'records' AND public = false) THEN
    RAISE EXCEPTION 'Check failed: bucket records is missing or public';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'Check failed: row security is off on storage.objects';
  END IF;

  -- The four policies, for signed-in users only
  IF (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
        AND p.policyname IN ('records_staff_read', 'records_staff_insert', 'records_staff_update', 'records_staff_delete')
        AND p.roles = ARRAY['authenticated']::name[]) <> 4 THEN
    RAISE EXCEPTION 'Check failed: the four records policies are not all there, for signed-in users only';
  END IF;

  -- No other policy mentions the bucket, and every other storage policy names the bucket it is for
  -- (a policy without one, such as "auth.role() = 'authenticated'", would open "records" too)
  SELECT string_agg(format('"%s"', p.policyname), ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
    AND p.policyname NOT IN ('records_staff_read', 'records_staff_insert', 'records_staff_update', 'records_staff_delete')
    AND ((COALESCE(p.qual, '') || COALESCE(p.with_check, '')) LIKE '%''records''%'
         OR (COALESCE(p.qual, '') || COALESCE(p.with_check, '')) NOT LIKE '%bucket_id = ''%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: storage policies that can reach bucket records: %', v_bad;
  END IF;

  RAISE NOTICE 'Bucket records in place: private, 4 practice-scoped policies';
END
$$;

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction, while the bucket is still empty (Storage refuses to drop a
-- bucket that holds files: move them back first):
--   DROP POLICY records_staff_read ON storage.objects;
--   DROP POLICY records_staff_insert ON storage.objects;
--   DROP POLICY records_staff_update ON storage.objects;
--   DROP POLICY records_staff_delete ON storage.objects;
--   SET LOCAL storage.allow_delete_query = 'true';
--   DELETE FROM storage.buckets WHERE id = 'records';
-- =============================================================================================
