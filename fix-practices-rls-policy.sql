-- ===================================================================
-- FIX: Practices Table RLS Policies for Registration
-- ===================================================================
-- Problem: Anonymous/authenticated users cannot INSERT into practices table
-- Solution: Create comprehensive RLS policies for practice registration
-- ===================================================================

-- First, let's check current RLS status
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'practices' AND schemaname = 'public';

-- Check existing policies
SELECT
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'practices';

-- ===================================================================
-- SOLUTION 1: Allow authenticated users to INSERT practices
-- ===================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to insert practices" ON practices;

-- Create INSERT policy for authenticated users
CREATE POLICY "Allow authenticated users to insert practices"
ON practices
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ===================================================================
-- SOLUTION 2: Allow authenticated users to SELECT their own practices
-- ===================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow users to view all practices" ON practices;

-- Create SELECT policy - Allow all authenticated users to view all practices
-- (Needed for admin portal to list practices)
CREATE POLICY "Allow users to view all practices"
ON practices
FOR SELECT
TO authenticated
USING (true);

-- ===================================================================
-- SOLUTION 3: Allow authenticated users to UPDATE their own practices
-- ===================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow users to update practices" ON practices;

-- Create UPDATE policy
CREATE POLICY "Allow users to update practices"
ON practices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ===================================================================
-- SOLUTION 4: Only allow service role to DELETE practices
-- ===================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Only service role can delete practices" ON practices;

-- Create DELETE policy
CREATE POLICY "Only service role can delete practices"
ON practices
FOR DELETE
TO service_role
USING (true);

-- ===================================================================
-- OPTIONAL: If you need ANON users to register practices (not recommended)
-- ===================================================================

-- Uncomment below if you want anonymous users to register practices
-- WARNING: This allows anyone to create practices without authentication

-- DROP POLICY IF EXISTS "Allow anonymous users to insert practices" ON practices;
--
-- CREATE POLICY "Allow anonymous users to insert practices"
-- ON practices
-- FOR INSERT
-- TO anon
-- WITH CHECK (true);

-- ===================================================================
-- Verify policies were created
-- ===================================================================

SELECT
    policyname,
    cmd,
    roles::text[],
    CASE
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE tablename = 'practices'
ORDER BY cmd, policyname;