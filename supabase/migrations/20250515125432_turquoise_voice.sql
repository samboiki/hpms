-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "public_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_delete_policy" ON storage.objects;

-- Create the media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE 
SET public = true;

-- Enable RLS on objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows public access to upload files
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'media');

-- Create a policy that allows public access to read files
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media');

-- Create a policy that allows public access to update files
CREATE POLICY "Allow public updates"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'media');

-- Create a policy that allows public access to delete files
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'media');