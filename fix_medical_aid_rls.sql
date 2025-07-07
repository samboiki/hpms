-- Fix RLS policy for medical_aid_details table to allow frontend access
-- This allows authenticated users to read medical aid data

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "medical_aid_details_policy" ON medical_aid_details;

-- Create a policy that allows reading medical aid data
CREATE POLICY "read_medical_aid_details" ON medical_aid_details
  FOR SELECT 
  USING (true);

-- Ensure RLS is enabled on the table
ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;