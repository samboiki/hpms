-- Complete auth fix for Dr. Polina users
-- Run this entire script to ensure users can login

-- Step 1: Ensure users exist in auth.users with correct passwords
DO $$
DECLARE
    practice_uuid UUID;
BEGIN
    -- Get Dr. Polina practice ID
    SELECT id INTO practice_uuid FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    -- Create/Update Dr. Polina
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        'polina@drpolinaaesthetics.com',
        crypt('drpolina123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'admin',
            'practice_id', practice_uuid::text,
            'full_name', 'Dr. Teopolina N. Tileinge'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO UPDATE SET
        encrypted_password = crypt('drpolina123', gen_salt('bf')),
        email_confirmed_at = NOW(),
        raw_user_meta_data = jsonb_build_object(
            'role', 'admin',
            'practice_id', practice_uuid::text,
            'full_name', 'Dr. Teopolina N. Tileinge'
        );
END $$;

-- Step 2: Sync all auth users to users table
INSERT INTO users (id, email, full_name, role, practice_id)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Dr. Polina') as full_name,
    COALESCE(au.raw_user_meta_data->>'role', 'admin')::text as role,
    (SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics') as practice_id
FROM auth.users au
WHERE au.email = 'polina@drpolinaaesthetics.com'
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    practice_id = EXCLUDED.practice_id;

-- Step 3: Create a simple test user that will definitely work
DO $$
DECLARE
    new_user_id UUID;
    practice_id UUID;
BEGIN
    new_user_id := gen_random_uuid();
    SELECT id INTO practice_id FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    -- Delete if exists
    DELETE FROM users WHERE email = 'admin@drpolina.com';
    DELETE FROM auth.users WHERE email = 'admin@drpolina.com';
    
    -- Create in auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        role
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'admin@drpolina.com',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NULL,
        '',
        NULL,
        '',
        NULL,
        '',
        '',
        NULL,
        NULL,
        '{"provider": "email", "providers": ["email"]}',
        '{"role": "admin", "full_name": "Admin User"}',
        false,
        NOW(),
        NOW(),
        NULL,
        NULL,
        '',
        '',
        NULL,
        '',
        0,
        NULL,
        '',
        NULL,
        false,
        'authenticated'
    );
    
    -- Create in users table
    INSERT INTO users (id, email, full_name, role, practice_id, created_at)
    VALUES (
        new_user_id,
        'admin@drpolina.com',
        'Admin User',
        'admin',
        practice_id,
        NOW()
    );
END $$;

-- Step 4: Show all available logins
SELECT 
    u.email,
    u.full_name,
    u.role,
    p.name as practice,
    CASE 
        WHEN au.id IS NOT NULL THEN 'Active'
        ELSE 'Inactive'
    END as auth_status,
    CASE u.email
        WHEN 'polina@drpolinaaesthetics.com' THEN 'drpolina123'
        WHEN 'admin@drpolina.com' THEN 'admin123'
        ELSE 'contact admin'
    END as password
FROM users u
JOIN practices p ON u.practice_id = p.id
LEFT JOIN auth.users au ON u.id = au.id
WHERE p.slug = 'dr-polina-aesthetics'
ORDER BY u.email;