-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "public_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "public_delete_policy" ON storage.objects;

-- Ensure the media bucket exists with correct permissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE 
SET public = true;

-- Create policies for storage.objects
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

CREATE POLICY "Allow authenticated insert access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow authenticated update access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media');

CREATE POLICY "Allow authenticated delete access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media');

-- Ensure media_files table exists with correct structure
CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  url text NOT NULL,
  description text,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on media_files table
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Create policies for media_files table
CREATE POLICY "Enable read access for authenticated users"
ON media_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON media_files FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON media_files FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for authenticated users"
ON media_files FOR DELETE
TO authenticated
USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_media_files_visit ON media_files(visit_id);
CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at);

-- Create updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_media_files_updated_at ON media_files;
CREATE TRIGGER set_media_files_updated_at
    BEFORE UPDATE ON media_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to explain the table's purpose
COMMENT ON TABLE media_files IS 'Stores metadata for uploaded media files associated with visits';