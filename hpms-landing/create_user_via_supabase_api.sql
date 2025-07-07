-- First, let's check what's actually in the database

-- 1. Check auth.users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
WHERE email LIKE '%drpolina%'
   OR email LIKE '%drpolinaaesthetics%'
ORDER BY created_at DESC;

-- 2. Check users table
SELECT 
    id,
    email,
    full_name,
    role,
    practice_id,
    created_at
FROM users
WHERE email LIKE '%drpolina%'
   OR email LIKE '%drpolinaaesthetics%'
ORDER BY created_at DESC;

-- 3. Check if dr-polina-aesthetics practice exists
SELECT id, name, slug 
FROM practices 
WHERE slug = 'dr-polina-aesthetics';

-- 4. Instead of complex user creation, let's use Supabase's built-in function
-- This is the PROPER way to create auth users
SELECT auth.email() as current_user_email;

-- 5. Create a user using the proper method
-- First, ensure we have the practice
DO $$
DECLARE
    practice_id UUID;
    user_id UUID;
BEGIN
    -- Get practice ID
    SELECT id INTO practice_id 
    FROM practices 
    WHERE slug = 'dr-polina-aesthetics';
    
    IF practice_id IS NULL THEN
        RAISE NOTICE 'Practice dr-polina-aesthetics not found!';
        RETURN;
    END IF;
    
    -- Create user properly
    user_id := extensions.uuid_generate_v4();
    
    -- Insert into auth.users with minimal required fields
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        user_id,
        'authenticated',
        'authenticated',
        'simple@drpolina.com',
        crypt('simple123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'admin',
            'full_name', 'Simple Test User',
            'practice_id', practice_id::text
        ),
        NOW(),
        NOW(),
        '',
        ''
    ) ON CONFLICT (email) 
    DO UPDATE SET 
        encrypted_password = EXCLUDED.encrypted_password,
        updated_at = NOW();
    
    -- Also add to users table
    INSERT INTO users (id, email, full_name, role, practice_id)
    VALUES (
        user_id,
        'simple@drpolina.com',
        'Simple Test User',
        'admin',
        practice_id
    ) ON CONFLICT (id) 
    DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        practice_id = EXCLUDED.practice_id;
        
    RAISE NOTICE 'User created: simple@drpolina.com / simple123';
END $$;

-- 6. Verify what we have
SELECT 
    'AUTH.USERS' as table_name,
    COUNT(*) as count
FROM auth.users
WHERE email LIKE '%drpolina%'
UNION ALL
SELECT 
    'USERS' as table_name,
    COUNT(*) as count
FROM users
WHERE email LIKE '%drpolina%';

-- 7. Show exact login credentials that should work
SELECT 
    au.email,
    u.full_name,
    u.role,
    CASE 
        WHEN au.id = u.id THEN 'Synced'
        ELSE 'Not Synced - IDs do not match!'
    END as sync_status,
    au.id as auth_id,
    u.id as user_id
FROM auth.users au
LEFT JOIN users u ON au.email = u.email
WHERE au.email IN ('simple@drpolina.com', 'admin@drpolina.com', 'polina@drpolinaaesthetics.com')
ORDER BY au.email;