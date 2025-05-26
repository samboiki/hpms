-- Update passwords for doctor@drpolina.com and reception@drpolina.com

-- First, let's check if these users exist
SELECT 'Checking existing users...' as status;

SELECT 
    au.id,
    au.email,
    u.full_name,
    u.role,
    p.name as practice_name
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
LEFT JOIN practices p ON u.practice_id = p.id
WHERE au.email IN ('doctor@drpolina.com', 'reception@drpolina.com');

-- Update doctor@drpolina.com password to 'doctor123'
UPDATE auth.users
SET 
    encrypted_password = crypt('doctor123', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'doctor@drpolina.com';

-- Update reception@drpolina.com password to 'reception123'  
UPDATE auth.users
SET 
    encrypted_password = crypt('reception123', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'reception@drpolina.com';

-- If reception@drpolina.com doesn't exist, we might need to look for the correct email
-- Check for reception@drpolinaaesthetics.com instead
UPDATE auth.users
SET 
    encrypted_password = crypt('reception123', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'reception@drpolinaaesthetics.com';

-- Verify the updates
SELECT 
    'Updated Credentials:' as info,
    au.email,
    u.full_name,
    u.role,
    CASE 
        WHEN au.email = 'doctor@drpolina.com' THEN 'Password: doctor123'
        WHEN au.email LIKE 'reception@%' THEN 'Password: reception123'
        ELSE 'Unknown'
    END as new_password
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email IN (
    'doctor@drpolina.com', 
    'reception@drpolina.com',
    'reception@drpolinaaesthetics.com'
)
ORDER BY au.email;

-- Display login credentials
SELECT '=== LOGIN CREDENTIALS ===' as credentials
UNION ALL
SELECT '1. doctor@drpolina.com / doctor123'
UNION ALL  
SELECT '2. reception@drpolina.com (or reception@drpolinaaesthetics.com) / reception123';