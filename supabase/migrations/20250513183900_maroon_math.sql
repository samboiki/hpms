/*
  # Add RLS policies for next_of_kin table

  1. Security Changes
    - Enable RLS on next_of_kin table (already enabled)
    - Add policies for authenticated users to:
      - Insert new next of kin records
      - Update existing next of kin records
      - View next of kin records
    - Policies ensure staff members can manage next of kin records for all patients
*/

-- Policy to allow authenticated users to insert next of kin records
CREATE POLICY "Allow authenticated users to insert next of kin"
ON next_of_kin
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy to allow authenticated users to view next of kin records
CREATE POLICY "Allow authenticated users to view next of kin"
ON next_of_kin
FOR SELECT
TO authenticated
USING (true);

-- Policy to allow authenticated users to update next of kin records
CREATE POLICY "Allow authenticated users to update next of kin"
ON next_of_kin
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);