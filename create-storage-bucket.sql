-- 📁 Create Supabase Storage Bucket for NewCharm Images
-- Execute this in Supabase SQL Editor first

-- Create the practice-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-images',
  'practice-images', 
  true,  -- Make it public so images can be accessed
  52428800,  -- 50MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']  -- Allowed image types
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy to allow public read access
CREATE POLICY IF NOT EXISTS "Public can view practice images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'practice-images');

-- Create RLS policy to allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload practice images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'practice-images');

-- Create RLS policy to allow authenticated users to update
CREATE POLICY IF NOT EXISTS "Authenticated users can update practice images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'practice-images');

-- Create RLS policy to allow authenticated users to delete
CREATE POLICY IF NOT EXISTS "Authenticated users can delete practice images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'practice-images');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Storage bucket setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Bucket Details:';
  RAISE NOTICE '   • Name: practice-images';
  RAISE NOTICE '   • Public: Yes (images can be accessed via URL)';
  RAISE NOTICE '   • File Size Limit: 50MB';
  RAISE NOTICE '   • Allowed Types: JPEG, PNG, WebP, GIF';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Access URL format:';
  RAISE NOTICE '   https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/logo.png';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '   1. Go to Storage in Supabase Dashboard';
  RAISE NOTICE '   2. Create folder: newcharm/';
  RAISE NOTICE '   3. Upload your images from local folder';
  RAISE NOTICE '   4. Copy the public URLs';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for image uploads!';
END $$;