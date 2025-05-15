/*
  # Fix visits table RLS policies

  1. Security
    - Enable RLS on visits table
    - Add policies for authenticated users to insert visits
    - Add policies for staff to view, update, and delete visits
    - Check for existing policies before creating new ones
*/

-- Enable RLS on visits table if not already enabled
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to insert visits" ON visits;
  DROP POLICY IF EXISTS "Staff can view visits they create" ON visits;
  DROP POLICY IF EXISTS "Staff can update visits" ON visits;
  DROP POLICY IF EXISTS "Staff can delete visits" ON visits;
END $$;

-- Allow authenticated users to insert visits
CREATE POLICY "Allow authenticated users to insert visits"
  ON visits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow staff to view visits they create
CREATE POLICY "Staff can view visits they create"
  ON visits
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE role IN ('admin', 'doctor', 'nurse', 'receptionist')
    )
  );

-- Allow staff to update visits
CREATE POLICY "Staff can update visits"
  ON visits
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE role IN ('admin', 'doctor', 'nurse', 'receptionist')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE role IN ('admin', 'doctor', 'nurse', 'receptionist')
    )
  );

-- Allow staff to delete visits
CREATE POLICY "Staff can delete visits"
  ON visits
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE role IN ('admin', 'doctor', 'nurse', 'receptionist')
    )
  );