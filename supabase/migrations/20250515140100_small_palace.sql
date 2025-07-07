/*
  # Create Demo Users

  1. Changes
    - Creates demo users in auth.users if they don't exist
    - Creates corresponding entries in public.users
    - Sets up different roles (admin, doctor, nurse, receptionist)
  
  2. Security
    - Uses secure password hashing
    - Sets up proper authentication roles
*/

DO $$
DECLARE
  admin_uid UUID;
  doctor_uid UUID;
  nurse_uid UUID;
  receptionist_uid UUID;
BEGIN
  -- Create admin user if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@example.com') THEN
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
    VALUES (
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
    )
    RETURNING id INTO admin_uid;

    -- Create corresponding public.users entry
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (admin_uid, 'admin@example.com', 'Admin User', 'admin');
  END IF;

  -- Create doctor user if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'doctor@example.com') THEN
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
    VALUES (
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
    )
    RETURNING id INTO doctor_uid;

    -- Create corresponding public.users entry
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (doctor_uid, 'doctor@example.com', 'Doctor User', 'doctor');
  END IF;

  -- Create nurse user if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'nurse@example.com') THEN
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
    VALUES (
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
    )
    RETURNING id INTO nurse_uid;

    -- Create corresponding public.users entry
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (nurse_uid, 'nurse@example.com', 'Nurse User', 'nurse');
  END IF;

  -- Create receptionist user if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'receptionist@example.com') THEN
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
    VALUES (
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
    )
    RETURNING id INTO receptionist_uid;

    -- Create corresponding public.users entry
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (receptionist_uid, 'receptionist@example.com', 'Receptionist User', 'receptionist');
  END IF;
END $$;