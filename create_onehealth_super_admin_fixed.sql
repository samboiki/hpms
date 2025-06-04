-- =====================================================
-- ONEHEALTH ADMIN USERS CREATION SCRIPT
-- =====================================================
-- Creates admin users for OneHealth system management
-- IMPORTANT: Change default passwords after first login!

-- Insert admin users with default credentials
-- PASSWORD: These are DEFAULT passwords that MUST be changed on first login!

INSERT INTO admin_users (email, password_hash, full_name, role_id, is_super_admin, is_active) VALUES
(
  'admin@onehealth.com.na',
  crypt('OneHealth2025!Admin', gen_salt('bf')), -- DEFAULT PASSWORD: OneHealth2025!Admin
  'OneHealth System Administrator',
  (SELECT id FROM admin_roles WHERE name = 'Super Admin'),
  true,
  true
),
(
  'manager@onehealth.com.na',
  crypt('Manager2025!', gen_salt('bf')), -- DEFAULT PASSWORD: Manager2025!
  'Practice Manager',
  (SELECT id FROM admin_roles WHERE name = 'Practice Manager'),
  false,
  true
),
(
  'billing@onehealth.com.na',
  crypt('Billing2025!', gen_salt('bf')), -- DEFAULT PASSWORD: Billing2025!
  'Billing Manager',
  (SELECT id FROM admin_roles WHERE name = 'Billing Manager'),
  false,
  true
),
(
  'support@onehealth.com.na',
  crypt('Support2025!', gen_salt('bf')), -- DEFAULT PASSWORD: Support2025!
  'Customer Support Agent',
  (SELECT id FROM admin_roles WHERE name = 'Support Agent'),
  false,
  true
);

-- Log the admin user creation
INSERT INTO admin_audit_logs (admin_user_id, action, resource_type, old_values, new_values) 
SELECT 
  au.id,
  'SYSTEM_CREATE',
  'admin_users',
  '{"event": "system_initialization"}'::jsonb,
  jsonb_build_object(
    'email', au.email,
    'full_name', au.full_name,
    'role', ar.name,
    'is_super_admin', au.is_super_admin,
    'created_at', au.created_at
  )
FROM admin_users au
JOIN admin_roles ar ON ar.id = au.role_id
WHERE au.email LIKE '%@onehealth.com.na';

-- Display created admin accounts
SELECT 
  '🔐 ONEHEALTH ADMIN ACCOUNTS CREATED' as status,
  email,
  full_name,
  CASE WHEN is_super_admin THEN 'Super Admin' ELSE ar.name END as role,
  CASE WHEN is_super_admin THEN 'FULL SYSTEM ACCESS' ELSE ar.description END as permissions,
  is_active as active
FROM admin_users au
LEFT JOIN admin_roles ar ON ar.id = au.role_id
WHERE email LIKE '%@onehealth.com.na'
ORDER BY is_super_admin DESC, email;

-- Security warning
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚨 CRITICAL SECURITY NOTICE 🚨';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  DEFAULT ADMIN CREDENTIALS CREATED:';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Super Admin:';
  RAISE NOTICE '   Email: admin@onehealth.com.na';
  RAISE NOTICE '   Password: OneHealth2025!Admin';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Practice Manager:';
  RAISE NOTICE '   Email: manager@onehealth.com.na';
  RAISE NOTICE '   Password: Manager2025!';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Billing Manager:';
  RAISE NOTICE '   Email: billing@onehealth.com.na';
  RAISE NOTICE '   Password: Billing2025!';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Support Agent:';
  RAISE NOTICE '   Email: support@onehealth.com.na';
  RAISE NOTICE '   Password: Support2025!';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 MANDATORY SECURITY ACTIONS:';
  RAISE NOTICE '   1. Change ALL default passwords immediately after first login';
  RAISE NOTICE '   2. Enable two-factor authentication';
  RAISE NOTICE '   3. Configure IP restrictions if needed';
  RAISE NOTICE '   4. Review and audit admin permissions regularly';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Admin users created successfully in admin_users table';
  RAISE NOTICE '📝 All actions logged in admin_audit_logs table';
END $$;