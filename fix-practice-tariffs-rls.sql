-- Fix RLS policies for practice_tariffs table
-- This will allow all authenticated and anonymous users to read the tariff data

-- First, check current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'practice_tariffs';

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can view tariffs" ON practice_tariffs;
DROP POLICY IF EXISTS "Enable read access for all users" ON practice_tariffs;
DROP POLICY IF EXISTS "practice_tariffs_select_policy" ON practice_tariffs;

-- Create a new permissive policy for reading
CREATE POLICY "practice_tariffs_read_all" 
ON practice_tariffs 
FOR SELECT 
TO public 
USING (true);

-- Verify RLS is enabled
ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON practice_tariffs TO anon;
GRANT SELECT ON practice_tariffs TO authenticated;

-- Test the policy
SELECT COUNT(*) as total_records FROM practice_tariffs;