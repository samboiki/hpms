/*
  # Fix User Authentication and RLS Policies

  1. Changes
    - Re-enable RLS on users table
    - Add proper RLS policies for user access
    - Add service role policy for admin access
  
  2. Security
    - Enable RLS on users table
    - Add policy for users to read their own data
    - Add policy for admins to read all user data
    - Add policy for updating last login timestamp
*/

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.users;

-- Create new policies
CREATE POLICY "Users can view their own data"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow last login updates"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  (
    (xmax::text::int != 0 AND OLD.* IS NOT DISTINCT FROM NEW.* EXCEPT (last_login))
    OR
    (xmax::text::int = 0)
  )
);