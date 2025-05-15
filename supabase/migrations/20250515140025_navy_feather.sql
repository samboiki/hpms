/*
  # Create Demo User Accounts

  1. Changes
    - Creates demo user accounts for different roles
    - Sets up authentication and user profile data
    - Enables email confirmation by default

  2. Security
    - Passwords are properly hashed
    - User roles are properly assigned
*/

-- Create the demo users with UUIDs generated explicitly
INSERT INTO auth.users (
  id,
  instance_id,
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
  email_change,
  phone_change,
  is_super_admin,
  role
)
VALUES
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'doctor@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'nurse@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'receptionist@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated'
  );

-- Create corresponding entries in public.users
INSERT INTO public.users (id, email, full_name, role)
SELECT 
  id,
  email,
  CASE 
    WHEN email = 'admin@example.com' THEN 'Admin User'
    WHEN email = 'doctor@example.com' THEN 'Doctor User'
    WHEN email = 'nurse@example.com' THEN 'Nurse User'
    WHEN email = 'receptionist@example.com' THEN 'Receptionist User'
  END as full_name,
  CASE 
    WHEN email = 'admin@example.com' THEN 'admin'
    WHEN email = 'doctor@example.com' THEN 'doctor'
    WHEN email = 'nurse@example.com' THEN 'nurse'
    WHEN email = 'receptionist@example.com' THEN 'receptionist'
  END as role
FROM auth.users
WHERE email IN (
  'admin@example.com',
  'doctor@example.com',
  'nurse@example.com',
  'receptionist@example.com'
);