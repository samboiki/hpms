-- FIX FOR USERS TABLE RLS INFINITE RECURSION ERROR
-- Run this in Supabase SQL Editor to resolve the 500 error

-- First, drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view practice members" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;
DROP POLICY IF EXISTS "Admin can view all users" ON users;
DROP POLICY IF EXISTS "Admin can manage all users" ON users;
DROP POLICY IF EXISTS "Doctors can view practice members" ON users;
DROP POLICY IF EXISTS "Nurses and receptionists can view own data" ON users;

-- Create new non-recursive policies

-- 1. SELECT Policy - Allows authenticated users to see all users in their practice
-- This avoids recursion by using a simple EXISTS check instead of subqueries
CREATE POLICY "users_select_policy" ON users
FOR SELECT
TO authenticated
USING (
    -- Users can always see themselves
    auth.uid() = id
    OR
    -- Users can see others in their practice (non-recursive check)
    EXISTS (
        SELECT 1 
        FROM auth.users au
        WHERE au.id = auth.uid()
        AND au.raw_user_meta_data->>'practice_id' = users.practice_id::text
    )
);

-- 2. UPDATE Policy - Users can only update their own profile
CREATE POLICY "users_update_own" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. INSERT Policy - Only admins and doctors can add new users
CREATE POLICY "users_insert_admin" ON users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.raw_user_meta_data->>'role' IN ('admin', 'doctor')
    )
);

-- 4. DELETE Policy - Only admins can delete users
CREATE POLICY "users_delete_admin" ON users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.raw_user_meta_data->>'role' = 'admin'
    )
);

-- If the above still causes issues, use this simpler temporary fix:
-- COMMENT OUT THE ABOVE POLICIES AND UNCOMMENT THESE:

/*
-- TEMPORARY SIMPLE FIX - Less secure but avoids all recursion
CREATE POLICY "users_select_all_authenticated" ON users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users_update_own" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "users_insert_admin_simple" ON users
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Temporarily allow all inserts

CREATE POLICY "users_delete_admin_simple" ON users
FOR DELETE
TO authenticated
USING (false);  -- Temporarily disable deletions
*/