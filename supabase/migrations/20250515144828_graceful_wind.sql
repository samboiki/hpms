/*
  # Fix infinite recursion in users table RLS policies
  
  1. Changes
    - Create SECURITY DEFINER function for checking admin status
    - Replace recursive policies with simplified versions
    - Fix infinite recursion issue in RLS policies
    
  2. Security
    - Enable RLS on users table
    - Add policies for viewing and updating profiles
    - Maintain proper access control while avoiding recursion
*/

-- Create admin check function with SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin'
  FROM users
  WHERE id = user_id;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON users;

-- Create new policies using the SECURITY DEFINER function
CREATE POLICY "View profiles"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR is_admin(auth.uid())
);

CREATE POLICY "Update profiles"
ON users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR is_admin(auth.uid())
)
WITH CHECK (
  auth.uid() = id OR is_admin(auth.uid())
);