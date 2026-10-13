-- Applied 2026-10-08 as migration documents_bucket_2026_10_08
-- =============================================================================================
-- PROPOSAL: the public key can no longer list, upload, replace or delete files in "documents"
-- File:   proposals/2026-10-08-documents-bucket.sql                     Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, section 8 item 3, verified): the five storage policies of bucket
-- "documents" (despite their names, "Allow authenticated document ...") were granted to anon too, so
-- anyone with the public key could list all 134 files and read, replace or delete them: invoices with
-- patient details, prescriptions, lab and imaging results, leave forms and timesheets.
-- Now only signed-in users have these rights (the service key bypasses row security as before).
--
-- Still open (owner decision, needs code): the bucket is public, so a file whose path is known can be
-- downloaded without signing in. invoices/ (19) and leave_forms/ (33) have no random id in their path.
-- The fix is a private bucket for patient and staff records with signed links, keeping logos, avatars
-- and signatures where they are; the app reads those through public links today.
--
-- Undo: ALTER POLICY <name> ON storage.objects TO anon, authenticated, service_role, supabase_realtime_admin;
-- =============================================================================================

BEGIN;

ALTER POLICY "  Allow authenticated document uploads" ON storage.objects TO authenticated;
ALTER POLICY "Allow authenticated document reads flreew_0" ON storage.objects TO authenticated;
ALTER POLICY "Allow authenticated document reads flreew_1" ON storage.objects TO authenticated;
ALTER POLICY "Allow authenticated document reads flreew_2" ON storage.objects TO authenticated;
ALTER POLICY "Allow authenticated document reads flreew_3" ON storage.objects TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual, '') ILIKE '%''documents''%' OR coalesce(with_check, '') ILIKE '%''documents''%')
       AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
  ) THEN
    RAISE EXCEPTION 'Check failed: a documents policy still applies to the public key';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
