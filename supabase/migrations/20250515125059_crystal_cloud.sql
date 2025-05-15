/*
  # Configure Storage for Public Access

  1. Changes
    - Create public storage bucket for media uploads
    - Enable public access to storage bucket
    - Set up permissive RLS policies for development
  
  2. Security
    - WARNING: These are development-only policies
    - Should be replaced with proper user-based policies in production
*/

-- Create public storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Create a policy that allows public access to upload files
CREATE POLICY "public_upload_policy" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'media');

-- Create a policy that allows public access to read files
CREATE POLICY "public_read_policy" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'media');

-- Create a policy that allows public access to update files
CREATE POLICY "public_update_policy" 
ON storage.objects FOR UPDATE 
TO public 
USING (bucket_id = 'media');

-- Create a policy that allows public access to delete files
CREATE POLICY "public_delete_policy" 
ON storage.objects FOR DELETE 
TO public 
USING (bucket_id = 'media');