-- Create OneHealth Super Admin User
-- Execute this after the main migration is complete

-- Create the super admin user with secure credentials
INSERT INTO admin_users (
  email,
  password_hash,
  full_name,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  'admin@onehealth.na',
  '$2b$12$LQv3c7yqBTkd68LQlFtzMOD.eOp4LqjQIL3PUfE.FIqQrCZPXVdgS', -- Password: OneHealth2025!
  'OneHealth Super Administrator',
  (SELECT id FROM admin_roles WHERE name = 'Super Admin' LIMIT 1),
  true,
  true
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_super_admin = true,
  is_active = true;

-- Create a practice manager admin as well
INSERT INTO admin_users (
  email,
  password_hash,
  full_name,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  'manager@onehealth.na',
  '$2b$12$LQv3c7yqBTkd68LQlFtzMOD.eOp4LqjQIL3PUfE.FIqQrCZPXVdgS', -- Password: OneHealth2025!
  'OneHealth Practice Manager',
  (SELECT id FROM admin_roles WHERE name = 'Practice Manager' LIMIT 1),
  false,
  true
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- Update practices table to link with admin users where appropriate
UPDATE practices 
SET admin_user_id = (SELECT id FROM admin_users WHERE email = 'admin@onehealth.na' LIMIT 1)
WHERE admin_user_id IS NULL;

-- Create initial admin session for immediate login (valid for 24 hours)
INSERT INTO admin_sessions (
  admin_user_id,
  session_token,
  expires_at
) VALUES (
  (SELECT id FROM admin_users WHERE email = 'admin@onehealth.na' LIMIT 1),
  'onehealth_initial_session_' || gen_random_uuid()::text,
  NOW() + INTERVAL '24 hours'
);

-- Log the admin creation
INSERT INTO admin_audit_logs (
  admin_user_id,
  action,
  resource_type,
  new_values
) VALUES (
  (SELECT id FROM admin_users WHERE email = 'admin@onehealth.na' LIMIT 1),
  'INITIAL_SETUP',
  'admin_users',
  '{"action": "Created OneHealth super admin accounts", "timestamp": "' || NOW()::text || '"}'::jsonb
);

-- Summary
SELECT 
  'OneHealth Admin System Setup Complete!' as status,
  json_build_object(
    'super_admin_email', 'admin@onehealth.na',
    'manager_email', 'manager@onehealth.na',
    'password', 'OneHealth2025!',
    'admin_users_created', (SELECT COUNT(*) FROM admin_users),
    'active_sessions', (SELECT COUNT(*) FROM admin_sessions WHERE expires_at > NOW()),
    'login_url', 'https://jjxlfunlbyayxwvlpgwt.supabase.co/auth/v1/admin/users'
  ) as credentials_and_info;