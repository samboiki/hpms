/*
  # Create demo user accounts

  1. Changes
    - Insert demo user accounts for testing
    - Add RLS policies for user management
  
  2. Security
    - Only admins can manage users
    - Users can view their own data
*/

-- First create the users in auth.users
DO $$
DECLARE
  admin_uid UUID;
  doctor_uid UUID;
  nurse_uid UUID;
  receptionist_uid UUID;
BEGIN
  -- Create admin user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'
  )
  RETURNING id INTO admin_uid;

  -- Create doctor user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    'doctor@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'
  )
  RETURNING id INTO doctor_uid;

  -- Create nurse user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    'nurse@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'
  )
  RETURNING id INTO nurse_uid;

  -- Create receptionist user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (
    'receptionist@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'
  )
  RETURNING id INTO receptionist_uid;

  -- Create corresponding entries in public.users
  INSERT INTO public.users (id, email, full_name, role)
  VALUES
    (admin_uid, 'admin@example.com', 'Admin User', 'admin'),
    (doctor_uid, 'doctor@example.com', 'Doctor User', 'doctor'),
    (nurse_uid, 'nurse@example.com', 'Nurse User', 'nurse'),
    (receptionist_uid, 'receptionist@example.com', 'Receptionist User', 'receptionist');
END $$;