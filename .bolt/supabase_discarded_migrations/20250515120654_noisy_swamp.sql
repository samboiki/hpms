-- Drop any existing policies first
DROP POLICY IF EXISTS "authenticated can upload media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can update media" ON storage.objects;
DROP POLICY IF EXISTS "public can view media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can delete media" ON storage.objects;

-- Ensure the media bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policies that allow authenticated users full access
CREATE POLICY "authenticated can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "authenticated can update media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'media');

CREATE POLICY "authenticated can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media');

-- Allow public read access
CREATE POLICY "public can view media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'media');

-- Enable RLS on the objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;