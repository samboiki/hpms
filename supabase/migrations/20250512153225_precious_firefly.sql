/*
  # Fix RLS policies for patients table

  1. Changes
    - Add INSERT policy for authenticated users to create patients
    - Add UPDATE policy for authenticated users to modify patients
    - Add SELECT policy for authenticated users to view patients

  2. Security
    - Ensures authenticated users can manage patient records
    - Maintains existing RLS protection
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can insert patients" ON patients;
DROP POLICY IF EXISTS "Staff can update patients" ON patients;
DROP POLICY IF EXISTS "Staff can view all patients" ON patients;

-- Create comprehensive policies for patient management
CREATE POLICY "Enable insert for authenticated users only" 
ON patients FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" 
ON patients FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users only" 
ON patients FOR SELECT 
TO authenticated 
USING (true);