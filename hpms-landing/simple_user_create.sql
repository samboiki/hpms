-- Simplest possible user creation
-- This follows Supabase best practices

-- 1. First check what we have
SELECT 'Checking existing users...' as status;

SELECT email, id FROM auth.users WHERE email = 'simple@drpolina.com';
SELECT email, id FROM users WHERE email = 'simple@drpolina.com';

-- 2. Clean up if exists
DELETE FROM users WHERE email = 'simple@drpolina.com';
DELETE FROM auth.users WHERE email = 'simple@drpolina.com';

-- 3. Create user the RIGHT way
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    practice_id UUID;
BEGIN
    -- Get practice
    SELECT id INTO practice_id FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    -- Create in auth.users (minimal fields only)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        'simple@drpolina.com',
        crypt('simple123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    );
    
    -- Create in users table with SAME ID
    INSERT INTO users (
        id,  -- MUST match auth.users id
        email,
        full_name,
        role,
        practice_id
    ) VALUES (
        new_user_id,  -- Same ID as auth.users
        'simple@drpolina.com',
        'Simple User',
        'admin',
        practice_id
    );
    
    RAISE NOTICE 'Created user with ID: %', new_user_id;
END $$;

-- 4. Verify it worked
SELECT 
    'Verification Results:' as status,
    au.id as auth_id,
    u.id as user_id,
    au.email,
    u.full_name,
    u.role,
    CASE WHEN au.id = u.id THEN 'IDs MATCH - LOGIN SHOULD WORK' ELSE 'IDs DO NOT MATCH - LOGIN WILL FAIL' END as status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id  -- Join on ID, not email!
WHERE au.email = 'simple@drpolina.com';

-- 5. Show login credentials
SELECT 'Login with: simple@drpolina.com / simple123' as instructions;