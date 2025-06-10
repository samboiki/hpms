-- Fix for Document Upload: Create Storage Policies for Documents Bucket
-- This resolves the "Documents storage bucket not found" error
-- Execute this in Supabase Dashboard > SQL Editor

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create storage policies for documents bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Authenticated users can update documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- Verify the policies were created
SELECT 
  policyname,
  cmd,
  tablename
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%documents%';

-- Show a success message
DO $$
BEGIN
  RAISE NOTICE 'Storage policies for documents bucket created successfully!';
  RAISE NOTICE 'Document uploads should now work for authenticated users.';
END $$;