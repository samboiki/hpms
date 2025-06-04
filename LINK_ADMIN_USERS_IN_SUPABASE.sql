-- Execute this in Supabase Dashboard SQL Editor to complete OneHealth admin setup
-- URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

-- Step 1: Create/Update user profiles for admin users
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
  'admin',
  true,
  CASE 
    WHEN au.email = 'admin@onehealth.na' THEN '{"theme": "light", "notifications": true, "dashboard": "admin", "super_admin": true}'::jsonb
    WHEN au.email = 'manager@onehealth.na' THEN '{"theme": "light", "notifications": true, "dashboard": "admin", "practice_manager": true}'::jsonb
  END,
  NOW(),
  NOW()
FROM auth.users au 
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  preferences = EXCLUDED.preferences,
  updated_at = NOW();

-- Step 2: Assign admin users to all existing practices
INSERT INTO user_practice_assignments (
  user_id,
  practice_id,
  role,
  is_primary,
  assigned_at,
  assigned_by
)
SELECT 
  au.id,
  p.id,
  'admin',
  true,
  NOW(),
  au.id
FROM auth.users au
CROSS JOIN practices p
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (user_id, practice_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_primary = EXCLUDED.is_primary;

-- Step 3: Create function to auto-assign admins to new practices
CREATE OR REPLACE FUNCTION assign_admins_to_new_practice()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign admin users to any new practice
  INSERT INTO user_practice_assignments (user_id, practice_id, role, is_primary, assigned_at, assigned_by)
  SELECT 
    au.id,
    NEW.id,
    'admin',
    false,
    NOW(),
    au.id
  FROM auth.users au
  WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
  ON CONFLICT (user_id, practice_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for auto-assignment
DROP TRIGGER IF EXISTS assign_admins_to_new_practice_trigger ON practices;
CREATE TRIGGER assign_admins_to_new_practice_trigger
  AFTER INSERT ON practices
  FOR EACH ROW
  EXECUTE FUNCTION assign_admins_to_new_practice();

-- Step 5: Verification and Results
SELECT 
  'OneHealth Admin Setup Complete!' as status,
  json_build_object(
    'auth_users_found', (
      SELECT COUNT(*) 
      FROM auth.users 
      WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')
    ),
    'user_profiles_created', (
      SELECT COUNT(*) 
      FROM user_profiles up 
      JOIN auth.users au ON up.id = au.id 
      WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
    ),
    'practice_assignments', (
      SELECT COUNT(*) 
      FROM user_practice_assignments upa 
      JOIN auth.users au ON upa.user_id = au.id 
      WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
    ),
    'total_practices', (SELECT COUNT(*) FROM practices),
    'login_ready', true,
    'credentials', json_build_object(
      'super_admin_email', 'admin@onehealth.na',
      'practice_manager_email', 'manager@onehealth.na',
      'password', 'OneHealth2025!',
      'login_url', 'https://hpms-one.vercel.app/auth/login'
    )
  ) as setup_details;

-- Step 6: Show admin user details
SELECT 
  au.email,
  up.full_name,
  up.role,
  up.is_active,
  (SELECT COUNT(*) FROM user_practice_assignments WHERE user_id = au.id) as assigned_practices,
  au.created_at as auth_created,
  up.created_at as profile_created
FROM auth.users au
JOIN user_profiles up ON up.id = au.id
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ORDER BY au.email;