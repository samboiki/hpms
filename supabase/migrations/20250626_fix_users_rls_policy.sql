-- Fix RLS policy for users table to allow practice members to see each other

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view users in their practice" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Create new comprehensive policies

-- Policy 1: All authenticated users can view users in their practice
CREATE POLICY "Users can view practice members" ON users
  FOR SELECT
  USING (
    -- User can see themselves
    auth.uid() = id 
    OR
    -- User can see others in their practice
    practice_id IN (
      SELECT practice_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Admins and doctors can insert/update users in their practice
CREATE POLICY "Admins and doctors can manage practice users" ON users
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id 
      FROM users 
      WHERE practice_id = users.practice_id 
      AND role IN ('admin', 'doctor')
    )
  );

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;