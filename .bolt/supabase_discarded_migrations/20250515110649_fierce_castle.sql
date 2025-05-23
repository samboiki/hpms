/*
  # Create media storage bucket

  1. Storage
    - Creates a new storage bucket named 'media' for storing medical images and documents
    - Enables public access for viewing uploaded files
    - Sets up appropriate security policies

  2. Security
    - Enables RLS on the storage bucket
    - Adds policy for authenticated users to upload files
    - Adds policy for public read access to media files
*/

-- Create the media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

-- Enable row level security
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Create policy to allow authenticated users to update their uploaded files
CREATE POLICY "Allow authenticated users to update media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- Create policy to allow public read access to media files
CREATE POLICY "Allow public to view media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media');

-- Create policy to allow authenticated users to delete their uploaded files
CREATE POLICY "Allow authenticated users to delete media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media');