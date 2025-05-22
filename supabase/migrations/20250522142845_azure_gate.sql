/*
  # Fix RLS policies for appointments table

  1. Changes
    - Enable RLS on appointments table
    - Add policies for authenticated users to:
      - Insert new appointments
      - Update existing appointments
      - View appointments
      - Delete appointments
    - Policies ensure staff members can manage appointments for all patients
*/

-- Enable RLS on appointments table
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create policies for appointments table
CREATE POLICY "Staff can view all appointments"
ON appointments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Staff can delete appointments"
ON appointments
FOR DELETE
TO authenticated
USING (true);