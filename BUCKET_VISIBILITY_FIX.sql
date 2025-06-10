-- Fix bucket visibility for documents bucket
-- Execute this in Supabase Dashboard > SQL Editor

-- Allow everyone to see buckets (needed for bucket listing)
CREATE POLICY IF NOT EXISTS "Allow bucket listing"
  ON storage.buckets FOR SELECT
  USING (true);

-- Or alternatively, allow only authenticated users to see buckets
-- CREATE POLICY IF NOT EXISTS "Allow authenticated bucket listing"
--   ON storage.buckets FOR SELECT
--   USING (auth.role() = 'authenticated');

-- Also ensure storage.objects has the right policies for documents bucket
-- (You should have already created these via the UI, but here they are for reference)

-- Allow authenticated users to upload to documents bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to read from documents bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated reads from documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete from documents bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated deletes from documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to update in documents bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated updates to documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;