/*
  # Setup Media Storage
  
  1. New Tables
    - `media_files` - Stores media file metadata and references
      - `id` (uuid, primary key)
      - `filename` (text)
      - `url` (text)
      - `description` (text)
      - `visit_id` (uuid, foreign key)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on media_files table
    - Add policies for authenticated users
*/

-- Create media_files table
CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  url text NOT NULL,
  description text,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users"
ON media_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for all users"
ON media_files FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
ON media_files FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for all users"
ON media_files FOR DELETE
TO authenticated
USING (true);

-- Create updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();