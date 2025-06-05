# 🚀 Direct NewCharm Storage Setup - Execute These Steps

## Step 1: Create Storage Bucket (Execute this SQL)

Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

Copy and execute this SQL:

```sql
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Storage bucket created successfully!';
  RAISE NOTICE '📁 Go to Storage tab to upload images';
END $$;
```

## Step 2: Upload Images via UI

1. After executing the SQL, go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/storage/buckets
2. Click on `practice-images` bucket
3. Create folder: `newcharm`
4. Inside `newcharm`, create folder: `before-after`

Upload these files from `c:/Users/Happyou2/Documents/mxhealth/newcharm/`:

### Logo
- Upload `logo.png` → `practice-images/newcharm/logo.png`

### Before/After Images
- Upload `before1.jpg` → `practice-images/newcharm/before-after/before1.jpg`
- Upload `after1.jpg` → `practice-images/newcharm/before-after/after1.jpg`
- Upload `before2.jpg` → `practice-images/newcharm/before-after/before2.jpg`
- Upload `after2.jpg` → `practice-images/newcharm/before-after/after2.jpg`
- Upload `before3.jpg` → `practice-images/newcharm/before-after/before3.jpg`
- Upload `after3.jpg` → `practice-images/newcharm/before-after/after3.jpg`
- Upload `before4.jpg` → `practice-images/newcharm/before-after/before4.jpg`
- Upload `after4.jpg` → `practice-images/newcharm/before-after/after4.jpg`
- Upload `before5.jpg` → `practice-images/newcharm/before-after/before5.jpg`
- Upload `after5.jpg` → `practice-images/newcharm/before-after/after5.jpg`

## Step 3: Get URLs and Update Migration

After uploading, each image will have a URL like:
```
https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/logo.png
```

Copy each URL and let me know - I'll create the final migration SQL for you.

## Alternative: I'll Create Placeholder Setup

If manual upload is too tedious, I can:
1. Create the bucket with professional dental stock images
2. Set up the complete structure 
3. You can replace with your images later

Which approach do you prefer?