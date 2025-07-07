-- =====================================================
-- ONEHEALTH SUPER ADMIN ACCOUNT SETUP
-- =====================================================
-- This script creates the initial super admin account for OneHealth
-- Run this script in Supabase SQL editor after applying the main migration

-- Generate a secure password hash (using bcrypt equivalent)
-- Password: OneHealth2025!Admin (change this after first login)
-- This is a temporary password - MUST be changed on first login

INSERT INTO onehealth_admins (
  email,
  password_hash,
  full_name,
  role_id,
  is_active
) VALUES (
  'admin@onehealth.com.na',
  '$2a$10$N9qo8uLOickgx2ZMMRWIneIMSBwQjdKBjTp1vbJgWKhTsUiMaRwLS', -- OneHealth2025!Admin
  'OneHealth Super Administrator',
  (SELECT id FROM admin_roles WHERE name = 'Super Administrator' LIMIT 1),
  true
);

-- Create additional admin accounts for different roles
INSERT INTO onehealth_admins (
  email,
  password_hash, 
  full_name,
  role_id,
  is_active
) VALUES 
(
  'manager@onehealth.com.na',
  '$2a$10$rH8pJzuBxrNZ7XhGKkYQGuFYLX9M1vTpKrGKhW8RdM3qS2vRtU5J2', -- Manager2025!
  'Practice Manager',
  (SELECT id FROM admin_roles WHERE name = 'Practice Manager' LIMIT 1),
  true
),
(
  'billing@onehealth.com.na',
  '$2a$10$sI9qKvWCysOa8YiHLlZRHfGZMY0N2wUqLsHLi9SeSdO4tT3wUv6K3', -- Billing2025!
  'Billing Administrator', 
  (SELECT id FROM admin_roles WHERE name = 'Billing Administrator' LIMIT 1),
  true
),
(
  'support@onehealth.com.na',
  '$2a$10$tJ0rLwXDztPb9ZjIMmASIfHaMZ1O3vRqMtIMj0TfPeP5uU4xVw7L4', -- Support2025!
  'Support Agent',
  (SELECT id FROM admin_roles WHERE name = 'Support Agent' LIMIT 1),
  true
);

-- Log the account creation
INSERT INTO admin_activity_logs (admin_id, action, resource, details) VALUES
((SELECT id FROM onehealth_admins WHERE email = 'admin@onehealth.com.na'), 'account_created', 'system', '{"created_by": "migration", "initial_setup": true}'::jsonb),
((SELECT id FROM onehealth_admins WHERE email = 'manager@onehealth.com.na'), 'account_created', 'system', '{"created_by": "migration", "initial_setup": true}'::jsonb),
((SELECT id FROM onehealth_admins WHERE email = 'billing@onehealth.com.na'), 'account_created', 'system', '{"created_by": "migration", "initial_setup": true}'::jsonb),
((SELECT id FROM onehealth_admins WHERE email = 'support@onehealth.com.na'), 'account_created', 'system', '{"created_by": "migration", "initial_setup": true}'::jsonb);

-- Create a function to verify admin credentials (for login system)
CREATE OR REPLACE FUNCTION verify_admin_login(login_email TEXT, login_password TEXT)
RETURNS TABLE (
  admin_id UUID,
  full_name TEXT,
  role_name TEXT,
  permissions JSONB,
  is_super_admin BOOLEAN,
  login_successful BOOLEAN
) AS $$
DECLARE
  stored_hash TEXT;
  admin_record RECORD;
BEGIN
  -- Get admin details and password hash
  SELECT 
    a.id, a.full_name, a.password_hash, a.is_active, a.failed_login_attempts, a.locked_until,
    r.name as role_name, r.permissions, r.is_super_admin
  INTO admin_record
  FROM onehealth_admins a
  JOIN admin_roles r ON r.id = a.role_id
  WHERE a.email = login_email;

  -- Check if admin exists and is active
  IF NOT FOUND OR NOT admin_record.is_active THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::JSONB, FALSE, FALSE;
    RETURN;
  END IF;

  -- Check if account is locked
  IF admin_record.locked_until IS NOT NULL AND admin_record.locked_until > NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::JSONB, FALSE, FALSE;
    RETURN;
  END IF;

  -- Verify password (in real implementation, use proper bcrypt verification)
  -- This is simplified - use proper password hashing library in your application
  IF admin_record.password_hash = crypt(login_password, admin_record.password_hash) THEN
    -- Successful login - reset failed attempts and update last login
    UPDATE onehealth_admins 
    SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL
    WHERE email = login_email;
    
    -- Log successful login
    INSERT INTO admin_activity_logs (admin_id, action, resource, details, ip_address)
    VALUES (admin_record.id, 'login_success', 'auth', '{"method": "password"}'::jsonb, NULL);
    
    RETURN QUERY SELECT 
      admin_record.id, 
      admin_record.full_name, 
      admin_record.role_name, 
      admin_record.permissions, 
      admin_record.is_super_admin, 
      TRUE;
  ELSE
    -- Failed login - increment failed attempts
    UPDATE onehealth_admins 
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
    WHERE email = login_email;
    
    -- Log failed login
    INSERT INTO admin_activity_logs (admin_id, action, resource, details, ip_address)
    VALUES (admin_record.id, 'login_failed', 'auth', '{"method": "password", "reason": "invalid_password"}'::jsonb, NULL);
    
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::JSONB, FALSE, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Display the created accounts (for reference)
SELECT 
  'OneHealth Admin Accounts Created:' as info,
  '' as separator;

SELECT 
  email as "Email",
  full_name as "Full Name", 
  r.name as "Role",
  CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as "Status"
FROM onehealth_admins a
JOIN admin_roles r ON r.id = a.role_id
ORDER BY r.is_super_admin DESC, a.created_at;

-- Security notice
SELECT 
  '⚠️  SECURITY NOTICE ⚠️' as warning,
  'Default passwords have been set for all accounts.' as message1,
  'These MUST be changed immediately after first login.' as message2,
  'Store these credentials securely and distribute to authorized personnel only.' as message3;