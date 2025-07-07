/*
  # Fix RLS policies for user authentication

  1. Changes
    - Enable RLS on users table
    - Create policy for users to view their own data
    - Create policy for admins to view all users
    - Create policy for users to update their last_login
    
  2. Security
    - Users can only access their own data
    - Admins can access all user data
    - Users can only update their last_login field
*/

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.users;
DROP POLICY IF EXISTS "Allow last login updates" ON public.users;

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
    (xmax::text::int != 0 AND (
      NEW.id = OLD.id AND
      NEW.email = OLD.email AND
      NEW.full_name = OLD.full_name AND
      NEW.role = OLD.role AND
      NEW.created_at = OLD.created_at AND
      NEW.last_login IS DISTINCT FROM OLD.last_login
    )) OR
    (xmax::text::int = 0)
  )
);