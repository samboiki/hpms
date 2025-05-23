/*
  # Storage Bucket Setup
  
  1. Changes
    - Creates a public media bucket for file storage
  
  2. Notes
    - Bucket will be publicly accessible
    - No RLS policies required
*/

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO 
  UPDATE SET public = true;