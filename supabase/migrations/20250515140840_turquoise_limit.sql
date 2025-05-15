/*
  # Create Demo Users

  This migration creates demo user accounts for testing purposes.
  
  1. Changes:
    - Cleans up any existing demo accounts
    - Creates new users in auth.users table
    - Creates corresponding profiles in public.users table
    
  2. Demo Accounts:
    - Admin: admin@example.com / password123
    - Doctor: doctor@example.com / password123
    - Nurse: nurse@example.com / password123
    - Receptionist: receptionist@example.com / password123
*/

-- First, clean up any existing demo accounts from both tables
DELETE FROM public.users WHERE email IN (
  'admin@example.com',
  'doctor@example.com',
  'nurse@example.com',
  'receptionist@example.com'
);

DELETE FROM auth.users WHERE email IN (
  'admin@example.com',
  'doctor@example.com',
  'nurse@example.com',
  'receptionist@example.com'
);

-- Create demo accounts with explicit UUIDs
DO $$
DECLARE
  admin_id UUID := '11111111-1111-1111-1111-111111111111';
  doctor_id UUID := '22222222-2222-2222-2222-222222222222';
  nurse_id UUID := '33333333-3333-3333-3333-333333333333';
  receptionist_id UUID := '44444444-4444-4444-4444-444444444444';
BEGIN
  -- Insert admin user
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
    role,
    aud,
    confirmation_sent_at
  ) VALUES (
    admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Admin User"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated',
    'authenticated',
    NOW()
  );

  -- Insert doctor user
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
    role,
    aud,
    confirmation_sent_at
  ) VALUES (
    doctor_id,
    '00000000-0000-0000-0000-000000000000',
    'doctor@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Doctor User"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated',
    'authenticated',
    NOW()
  );

  -- Insert nurse user
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
    role,
    aud,
    confirmation_sent_at
  ) VALUES (
    nurse_id,
    '00000000-0000-0000-0000-000000000000',
    'nurse@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Nurse User"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated',
    'authenticated',
    NOW()
  );

  -- Insert receptionist user
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
    role,
    aud,
    confirmation_sent_at
  ) VALUES (
    receptionist_id,
    '00000000-0000-0000-0000-000000000000',
    'receptionist@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Receptionist User"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    FALSE,
    'authenticated',
    'authenticated',
    NOW()
  );

  -- Create corresponding entries in public.users
  INSERT INTO public.users (id, email, full_name, role, created_at, last_login)
  VALUES
    (admin_id, 'admin@example.com', 'Admin User', 'admin', NOW(), NULL),
    (doctor_id, 'doctor@example.com', 'Doctor User', 'doctor', NOW(), NULL),
    (nurse_id, 'nurse@example.com', 'Nurse User', 'nurse', NOW(), NULL),
    (receptionist_id, 'receptionist@example.com', 'Receptionist User', 'receptionist', NOW(), NULL);
END $$;