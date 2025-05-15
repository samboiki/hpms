/*
  # User Authentication RLS Policies

  1. Security
    - Enable RLS on users table
    - Create policies for user data access and updates
    - Allow users to view their own data
    - Allow admins to view all users
    - Restrict updates to last_login field only
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
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND (
      (
        id = auth.uid() AND
        email = (SELECT email FROM public.users WHERE id = auth.uid()) AND
        full_name = (SELECT full_name FROM public.users WHERE id = auth.uid()) AND
        role = (SELECT role FROM public.users WHERE id = auth.uid()) AND
        created_at = (SELECT created_at FROM public.users WHERE id = auth.uid())
      )
    )
  )
);