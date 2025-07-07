-- Create OneHealth Admin User Profiles
-- This assumes the auth users will be created via Supabase Dashboard or API

-- First, create user profiles for the admin emails (they'll link when users are created)
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  preferences,
  created_at,
  updated_at
) VALUES 
(
  gen_random_uuid(),
  'admin@onehealth.na',
  'OneHealth Super Administrator',
  'admin',
  true,
  '{"theme": "light", "notifications": true, "dashboard": "admin", "super_admin": true}'::jsonb,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'manager@onehealth.na', 
  'OneHealth Practice Manager',
  'admin',
  true,
  '{"theme": "light", "notifications": true, "dashboard": "admin", "practice_manager": true}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  preferences = EXCLUDED.preferences,
  updated_at = NOW();

-- Assign admin users to all existing practices
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
  up.id
FROM user_profiles up
CROSS JOIN practices p
WHERE up.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (user_id, practice_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_primary = EXCLUDED.is_primary;

-- Create a function to automatically assign new practices to admin users
CREATE OR REPLACE FUNCTION assign_admins_to_new_practice()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign both admin users to any new practice created
  INSERT INTO user_practice_assignments (user_id, practice_id, role, is_primary, assigned_at, assigned_by)
  SELECT 
    up.id,
    NEW.id,
    'admin',
    false,
    NOW(),
    up.id
  FROM user_profiles up
  WHERE up.email IN ('admin@onehealth.na', 'manager@onehealth.na')
  ON CONFLICT (user_id, practice_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign admins to new practices
DROP TRIGGER IF EXISTS assign_admins_to_new_practice_trigger ON practices;
CREATE TRIGGER assign_admins_to_new_practice_trigger
  AFTER INSERT ON practices
  FOR EACH ROW
  EXECUTE FUNCTION assign_admins_to_new_practice();

-- Display current status
SELECT 
  'OneHealth Admin Setup Completed!' as status,
  json_build_object(
    'admin_profiles_ready', (SELECT COUNT(*) FROM user_profiles WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')),
    'total_practices', (SELECT COUNT(*) FROM practices),
    'admin_practice_assignments', (SELECT COUNT(*) FROM user_practice_assignments WHERE user_id IN (
      SELECT id FROM user_profiles WHERE email IN ('admin@onehealth.na', 'manager@onehealth.na')
    )),
    'next_steps', 'Create Supabase auth users for admin@onehealth.na and manager@onehealth.na via Dashboard',
    'credentials', json_build_object(
      'email_1', 'admin@onehealth.na',
      'email_2', 'manager@onehealth.na', 
      'password', 'OneHealth2025!',
      'app_url', 'https://hpms-one.vercel.app/auth/login'
    )
  ) as details;