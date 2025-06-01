-- Fix RLS policies for medical_aid_details table to allow frontend access
-- Created: 2025-06-01
-- Purpose: Allow anonymous and authenticated users to read medical aid details

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own medical aid details" ON medical_aid_details;
DROP POLICY IF EXISTS "Enable read access for all users" ON medical_aid_details;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON medical_aid_details;
DROP POLICY IF EXISTS "Allow read access for anonymous users" ON medical_aid_details;

-- Add a permissive policy for read access
-- For now, allowing all users to read medical aid details
-- This can be made more restrictive later if needed
CREATE POLICY "Allow read access for all users" ON medical_aid_details
FOR SELECT USING (true);

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT ON medical_aid_details TO anon;
GRANT SELECT ON medical_aid_details TO authenticated;

-- Ensure RLS is enabled on the table
ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;