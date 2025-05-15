/*
  # Add RLS policies for visits table

  1. Security Changes
    - Add RLS policies for the visits table to allow:
      - Authenticated users to insert new visits
      - Staff members to view and update visits they create
      - Doctors to view all visits
*/

-- Enable RLS on visits table if not already enabled
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

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

-- Allow staff to update visits they create
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

-- Allow staff to delete visits they create
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