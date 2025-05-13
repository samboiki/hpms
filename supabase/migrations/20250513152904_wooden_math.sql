/*
  # Add RLS policies for next_of_kin table

  1. Security Changes
    - Enable RLS on next_of_kin table (already enabled)
    - Add policies for authenticated users to:
      - Insert new next of kin records
      - Update existing next of kin records
      - Select next of kin records
      - Delete next of kin records
    
  2. Policy Logic
    - All authenticated users can view and manage next of kin records
    - This matches the existing permissions on the patients table
    - Follows the same pattern as other tables in the system
*/

-- Policy to allow authenticated users to insert next of kin records
CREATE POLICY "Staff can insert next of kin"
  ON next_of_kin
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy to allow authenticated users to select next of kin records
CREATE POLICY "Staff can view all next of kin"
  ON next_of_kin
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow authenticated users to update next of kin records
CREATE POLICY "Staff can update next of kin"
  ON next_of_kin
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy to allow authenticated users to delete next of kin records
CREATE POLICY "Staff can delete next of kin"
  ON next_of_kin
  FOR DELETE
  TO authenticated
  USING (true);