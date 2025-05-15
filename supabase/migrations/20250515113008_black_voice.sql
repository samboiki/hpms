-- Drop any existing policies
DROP POLICY IF EXISTS "authenticated can upload media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can update media" ON storage.objects;
DROP POLICY IF EXISTS "public can view media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can delete media" ON storage.objects;

-- Disable RLS on storage.objects
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Create the media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;