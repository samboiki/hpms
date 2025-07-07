-- Debug auth issues for Dr. Polina users

-- 1. Check if the users exist in auth.users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
);

-- 2. Check if they exist in the users table
SELECT 
    id,
    email,
    full_name,
    role,
    practice_id,
    created_at
FROM users
WHERE email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
);

-- 3. Create a test user with a known password
-- This will create a user you can definitely log in with
DO $$
DECLARE
    test_user_id UUID;
    practice_id UUID;
BEGIN
    -- Get Dr. Polina practice ID
    SELECT id INTO practice_id FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    -- Create test user in auth.users
    test_user_id := gen_random_uuid();
    
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
        test_user_id,
        'test@drpolinaaesthetics.com',
        crypt('test123456', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'admin',
            'practice_id', practice_id::text,
            'full_name', 'Test User'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO NOTHING;
    
    -- Also insert into users table
    INSERT INTO users (id, email, full_name, role, practice_id)
    VALUES (
        test_user_id,
        'test@drpolinaaesthetics.com',
        'Test User',
        'admin',
        practice_id
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        practice_id = EXCLUDED.practice_id;
        
    RAISE NOTICE 'Test user created: test@drpolinaaesthetics.com / test123456';
END $$;

-- 4. Show all users that should be able to login
SELECT 
    u.email,
    u.full_name,
    u.role,
    p.name as practice_name,
    CASE 
        WHEN au.id IS NOT NULL THEN 'Yes'
        ELSE 'No'
    END as in_auth_users
FROM users u
LEFT JOIN practices p ON u.practice_id = p.id
LEFT JOIN auth.users au ON u.id = au.id
WHERE p.slug = 'dr-polina-aesthetics'
   OR u.email LIKE '%drpolinaaesthetics.com';