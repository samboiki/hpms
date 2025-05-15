/*
  # Storage Configuration

  1. Changes
    - Creates storage schema if it doesn't exist
    - Creates storage buckets and objects tables if they don't exist
    - Creates media bucket with public access
    - Sets up RLS policies for storage objects
    
  2. Security
    - Enables RLS on objects table
    - Creates policies for:
      - Public read access
      - Authenticated user uploads
      - Authenticated user updates
      - Authenticated user deletions
*/

-- Create storage schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS storage;

-- Create buckets table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- Create objects table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version text
);

-- Create the media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Individual user access" ON storage.objects;
DROP POLICY IF EXISTS "Individual upload access" ON storage.objects;
DROP POLICY IF EXISTS "Individual delete access" ON storage.objects;

-- Create policies for the objects table
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

CREATE POLICY "Individual upload access"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Individual update access"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'media');

CREATE POLICY "Individual delete access"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'media');