/*
  # Storage Configuration

  1. Changes
    - Creates a public media bucket for storing files
    - Configures security policies for the bucket
  
  2. Security
    - Bucket is public for read access
    - Only authenticated users can upload/modify files
*/

-- Create the media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE 
SET public = true;

-- Create security policies for the bucket
BEGIN;
  -- Policy for authenticated users to upload files
  CREATE POLICY "Users can upload files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'media');

  -- Policy for authenticated users to update their files
  CREATE POLICY "Users can update their files"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'media');

  -- Policy for authenticated users to delete their files
  CREATE POLICY "Users can delete their files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'media');

  -- Policy for public read access
  CREATE POLICY "Public read access"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'media' AND auth.role() IS NOT NULL);
COMMIT;