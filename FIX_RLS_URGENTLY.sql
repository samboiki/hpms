-- URGENT: Fix RLS policy for users table to remove infinite recursion
-- Run this in Supabase SQL Editor immediately

-- First, drop ALL existing policies on users table to clean up
DO $$ 
BEGIN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Users can view users in their practice" ON users;
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Users can view practice members" ON users;
    DROP POLICY IF EXISTS "Admins can manage users" ON users;
    DROP POLICY IF EXISTS "Admins and doctors can manage practice users" ON users;
    DROP POLICY IF EXISTS "Allow users to view other users in same practice" ON users;
    DROP POLICY IF EXISTS "Enable read access for all users" ON users;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
    DROP POLICY IF EXISTS "Enable update for users based on id" ON users;
    DROP POLICY IF EXISTS "Enable delete for users based on id" ON users;
END $$;

-- Create a simple, non-recursive policy for viewing users
CREATE POLICY "users_select_policy" ON users
FOR SELECT
TO authenticated
USING (true);  -- Allow all authenticated users to see all users temporarily

-- Create update policy for own profile
CREATE POLICY "users_update_own" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create insert policy for admins
CREATE POLICY "users_insert_admin" ON users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'doctor')
    )
);

-- Create delete policy for admins
CREATE POLICY "users_delete_admin" ON users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'doctor')
    )
);

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;