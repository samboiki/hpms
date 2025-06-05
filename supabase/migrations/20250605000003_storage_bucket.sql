-- 📁 Storage bucket for practice images

-- Create storage bucket for practice images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-images',
  'practice-images', 
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY IF NOT EXISTS "Public can view practice images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'practice-images');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload practice images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'practice-images');

CREATE POLICY IF NOT EXISTS "Authenticated users can update practice images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'practice-images');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete practice images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'practice-images');