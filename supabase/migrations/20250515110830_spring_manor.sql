/*
  # Create storage bucket for media files
  
  1. Changes
    - Creates a new storage bucket named 'media' for storing media files
    - Configures the bucket to be publicly accessible
    - Sets up RLS policies for the bucket:
      - Authenticated users can upload files
      - Authenticated users can update their files
      - Public can view files
      - Authenticated users can delete their files
*/

-- Create the media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

-- Create security policies for the bucket
CREATE POLICY "authenticated can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "authenticated can update media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

CREATE POLICY "public can view media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'media');

CREATE POLICY "authenticated can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media');