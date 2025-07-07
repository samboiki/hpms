/*
  # Storage Bucket Configuration

  1. Changes
    - Creates a public media storage bucket
    - Ensures bucket is publicly accessible
    - Disables RLS for storage objects
*/

-- Create bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('media', 'media', true)
  ON CONFLICT (id) DO 
    UPDATE SET public = true;
END $$;

-- Disable RLS on objects table to allow unrestricted access
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;