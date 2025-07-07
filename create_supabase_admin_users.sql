-- Create OneHealth Admin Users in Supabase Auth System
-- This integrates with the existing OneHealth authentication

-- First, let's create the admin users in the auth.users table (using Supabase admin functions)
-- Note: These users will be created directly in the auth schema

-- Create Super Admin User
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@onehealth.na',
  crypt('OneHealth2025!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "OneHealth Super Administrator"}',
  false
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  updated_at = NOW();

-- Create Practice Manager User  
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'manager@onehealth.na',
  crypt('OneHealth2025!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "OneHealth Practice Manager"}',
  false
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  updated_at = NOW();

-- Now create user profiles for these admin users
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  preferences,
  created_at,
  updated_at
) 
SELECT 
  au.id,
  au.email,
  CASE 
    WHEN au.email = 'admin@onehealth.na' THEN 'OneHealth Super Administrator'
    WHEN au.email = 'manager@onehealth.na' THEN 'OneHealth Practice Manager'
  END,
  'admin', -- Both get admin role for full system access
  true,
  '{"theme": "light", "notifications": true, "dashboard": "admin"}'::jsonb,
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Assign admin users to all practices (so they can manage everything)
INSERT INTO user_practice_assignments (
  user_id,
  practice_id,
  role,
  is_primary,
  assigned_at,
  assigned_by
)
SELECT 
  up.id,
  p.id,
  'admin',
  true,
  NOW(),
  up.id -- Self-assigned for initial setup
FROM user_profiles up
CROSS JOIN practices p
WHERE up.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (user_id, practice_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_primary = EXCLUDED.is_primary;

-- Create identity records for the auth users
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  au.id,
  json_build_object(
    'sub', au.id::text,
    'email', au.email,
    'email_verified', true
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (user_id, provider) DO NOTHING;

-- Verify the admin users were created successfully
SELECT 
  'OneHealth Admin Users Created Successfully!' as status,
  json_build_object(
    'admin_users_in_auth', (SELECT COUNT(*) FROM auth.users WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')),
    'admin_profiles_created', (SELECT COUNT(*) FROM user_profiles WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')),
    'practice_assignments', (SELECT COUNT(*) FROM user_practice_assignments WHERE user_id IN (
      SELECT id FROM user_profiles WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')
    )),
    'login_credentials', json_build_object(
      'email_1', 'admin@onehealth.na',
      'email_2', 'manager@onehealth.na',
      'password', 'OneHealth2025!',
      'app_url', 'https://hpms-one.vercel.app/auth/login'
    )
  ) as details;