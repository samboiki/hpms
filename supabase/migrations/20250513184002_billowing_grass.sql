/*
  # Fix Next of Kin RLS Policies

  1. Changes
    - Drop existing RLS policies on next_of_kin table
    - Create new comprehensive RLS policies for next_of_kin table
      - Allow authenticated users to insert next of kin records
      - Allow authenticated users to update next of kin records
      - Allow authenticated users to read next of kin records
      - Allow authenticated users to delete next of kin records

  2. Security
    - Enable RLS on next_of_kin table (already enabled)
    - Add policies for all CRUD operations
    - Ensure policies are properly scoped to authenticated users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert next of kin" ON next_of_kin;
DROP POLICY IF EXISTS "Allow authenticated users to update next of kin" ON next_of_kin;
DROP POLICY IF EXISTS "Allow authenticated users to view next of kin" ON next_of_kin;

-- Create new comprehensive policies
CREATE POLICY "Enable read access for authenticated users"
ON next_of_kin FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON next_of_kin FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON next_of_kin FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
ON next_of_kin FOR DELETE
TO authenticated
USING (true);