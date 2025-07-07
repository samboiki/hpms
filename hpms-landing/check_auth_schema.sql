-- Check auth schema and potential issues

-- 1. Check auth schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- 2. Check auth.users table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check if there are any issues with auth functions
SELECT 
    routine_name,
    routine_type,
    routine_schema
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name IN ('uid', 'email', 'jwt');

-- 4. Check current users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    CASE 
        WHEN encrypted_password IS NOT NULL THEN 'Has Password'
        ELSE 'No Password'
    END as password_status
FROM auth.users
WHERE email LIKE '%drpolina%'
ORDER BY created_at DESC;

-- 5. Test the crypt function (used for passwords)
SELECT 
    'Testing password encryption...' as status,
    crypt('test123', gen_salt('bf')) IS NOT NULL as encryption_works;

-- 6. Check for any auth-related errors in pg_stat_database
SELECT 
    datname,
    xact_rollback,
    deadlocks,
    temp_files,
    temp_bytes
FROM pg_stat_database
WHERE datname = current_database();