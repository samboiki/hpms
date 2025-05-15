/*
  # Authentication and User Roles Setup

  1. Changes
    - Add role enum type for user roles
    - Add role column to users table
    - Create default users for each role
    - Set up RLS policies for user access

  2. Security
    - Enable RLS on users table
    - Add policies for user access control
*/

-- Create role enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'nurse', 'receptionist');
  END IF;
END $$;

-- Add role column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'receptionist';

-- Create default users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES
-- Admin user
(
  '00000000-0000-0000-0000-000000000001',
  'admin@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Admin User"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
-- Doctor user
(
  '00000000-0000-0000-0000-000000000002',
  'doctor@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Dr. Sarah Johnson"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
-- Nurse user
(
  '00000000-0000-0000-0000-000000000003',
  'nurse@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Emily Wilson"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
-- Receptionist user
(
  '00000000-0000-0000-0000-000000000004',
  'receptionist@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Robert Brown"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Create corresponding user profiles
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  created_at,
  last_login
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'admin@example.com',
  'Admin User',
  'admin',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000002',
  'doctor@example.com',
  'Dr. Sarah Johnson',
  'doctor',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000003',
  'nurse@example.com',
  'Emily Wilson',
  'nurse',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000004',
  'receptionist@example.com',
  'Robert Brown',
  'receptionist',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all users
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

-- Admins can update all users
CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );