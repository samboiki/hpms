-- Applied 2026-10-08 as migration media_bucket_2026_10_08 (stored statement md5 dc6a18e8d612d65d8fe2d7ac5a528eea)
-- Rehearsed with simulated logins: the public key listed 17 media files before, 0 after; staff still 17.
-- =============================================================================================
-- PROPOSAL: the public key can no longer list or read the files in "media"
-- File:   proposals/2026-10-08-media-bucket.sql                         Drafted: 2026-10-08
--
-- Why (found by the records-bucket work, 2026-10-08): three SELECT policies of bucket "media" ("Allow public
-- read access", "Public read access", "public can view media") were granted to every role, so anyone with the
-- public key could list its 17 files (lab and visit photos that no row references any more) and read them.
-- Same fix as 2026-10-08-documents-bucket.sql: the policies keep their rules but apply to signed-in users only,
-- so nothing changes for staff or for today's live app.
--
-- Still open (owner decision): the bucket is public, so a file whose path is known can still be downloaded
-- without signing in, and any signed-in user may upload, replace or delete any media file (the policies check
-- the bucket only). New uploads go to the private "records" bucket (2026-10-08-records-bucket.sql), so after
-- the release the 17 orphaned files can be deleted and the bucket made private or removed.
--
-- Undo: ALTER POLICY "<name>" ON storage.objects TO public;  (for each of the three policies)
-- =============================================================================================

BEGIN;

ALTER POLICY "Allow public read access" ON storage.objects TO authenticated;
ALTER POLICY "Public read access" ON storage.objects TO authenticated;
ALTER POLICY "public can view media" ON storage.objects TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual, '') ILIKE '%''media''%' OR coalesce(with_check, '') ILIKE '%''media''%')
       AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
  ) THEN
    RAISE EXCEPTION 'Check failed: a media policy still applies to the public key';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;
