/*
  # Media Files Management
  
  1. New Tables
    - `media_files` table for storing media file metadata
      - `id` (uuid, primary key)
      - `filename` (text)
      - `url` (text) 
      - `description` (text, optional)
      - `visit_id` (uuid, foreign key to visits)
      - `type` (text) - photo, xray, ct, mri, ultrasound, document
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on visit_id for faster lookups
    - Index on created_at for chronological queries

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create media_files table
CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  url text NOT NULL,
  description text,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'photo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_media_type CHECK (type IN ('photo', 'xray', 'ct', 'mri', 'ultrasound', 'document'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_media_files_visit ON media_files(visit_id);
CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at);

-- Enable RLS
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON media_files;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON media_files;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON media_files;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON media_files;

-- Create RLS policies
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

-- Create updated_at trigger
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

COMMENT ON TABLE media_files IS 'Stores metadata for uploaded media files associated with visits';