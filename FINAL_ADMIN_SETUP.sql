-- FINAL ONEHEALTH ADMIN SETUP
-- Execute this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

-- Create user records for existing auth users
INSERT INTO users (
  id,
  email,
  full_name,
  role,
  practice_id,
  is_super_admin,
  can_manage_practices,
  permissions,
  created_at,
  last_active_at
)
SELECT 
  au.id,
  au.email,
  CASE 
    WHEN au.email = 'admin@onehealth.na' THEN 'OneHealth Super Administrator'
    WHEN au.email = 'manager@onehealth.na' THEN 'OneHealth Practice Manager'
    ELSE 'OneHealth Admin'
  END,
  'admin',
  NULL, -- Super admins have no specific practice
  CASE WHEN au.email = 'admin@onehealth.na' THEN true ELSE false END,
  true,
  jsonb_build_object(
    'practices', array['read', 'write', 'delete'],
    'users', array['read', 'write', 'delete'],
    'tariffs', array['read', 'write', 'delete'],
    'sms', array['read', 'write', 'allocate'],
    'reports', array['read', 'export'],
    'admin', array['full_access']
  ),
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  practice_id = EXCLUDED.practice_id,
  is_super_admin = EXCLUDED.is_super_admin,
  can_manage_practices = EXCLUDED.can_manage_practices,
  permissions = EXCLUDED.permissions,
  last_active_at = NOW();

-- Verification query
SELECT 
  'OneHealth Admin Setup Complete!' as status,
  json_build_object(
    'auth_users_found', (
      SELECT COUNT(*) 
      FROM auth.users 
      WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')
    ),
    'user_records_created', (
      SELECT COUNT(*) 
      FROM users u 
      WHERE u.email IN ('admin@onehealth.na', 'manager@onehealth.na')
    ),
    'super_admin_ready', (
      SELECT COUNT(*) 
      FROM users u 
      WHERE u.email = 'admin@onehealth.na' AND u.is_super_admin = true
    ),
    'practice_manager_ready', (
      SELECT COUNT(*) 
      FROM users u 
      WHERE u.email = 'manager@onehealth.na' AND u.can_manage_practices = true
    ),
    'login_credentials', json_build_object(
      'super_admin', 'admin@onehealth.na',
      'practice_manager', 'manager@onehealth.na',
      'password', 'OneHealth2025!',
      'login_url', 'https://hpms-one.vercel.app/auth/login'
    )
  ) as setup_details;

-- Show the created admin users
SELECT 
  u.email,
  u.full_name,
  u.role,
  u.is_super_admin,
  u.can_manage_practices,
  u.permissions,
  u.created_at
FROM users u
WHERE u.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ORDER BY u.email;