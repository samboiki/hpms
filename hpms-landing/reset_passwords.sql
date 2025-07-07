-- Reset passwords for Dr. Polina users to ensure they can login
-- This will set new passwords that we know will work

-- Update Dr. Polina's password
UPDATE auth.users
SET encrypted_password = crypt('drpolina123', gen_salt('bf'))
WHERE email = 'polina@drpolinaaesthetics.com';

-- Update Nurse Maria's password  
UPDATE auth.users
SET encrypted_password = crypt('nurse123', gen_salt('bf'))
WHERE email = 'nurse.maria@drpolinaaesthetics.com';

-- Update Reception's password
UPDATE auth.users
SET encrypted_password = crypt('reception123', gen_salt('bf'))
WHERE email = 'reception@drpolinaaesthetics.com';

-- Update Consultant's password
UPDATE auth.users
SET encrypted_password = crypt('consultant123', gen_salt('bf'))
WHERE email = 'consultant@drpolinaaesthetics.com';

-- Verify the users exist and show their details
SELECT 
    au.id,
    au.email,
    au.email_confirmed_at,
    u.full_name,
    u.role,
    p.name as practice_name,
    CASE 
        WHEN u.id IS NOT NULL THEN 'Ready to login'
        ELSE 'Missing from users table'
    END as status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
LEFT JOIN practices p ON u.practice_id = p.id
WHERE au.email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com',
    'test@drpolinaaesthetics.com'
)
ORDER BY au.email;

-- Show the credentials
SELECT 'Login Credentials:' as info
UNION ALL
SELECT '1. polina@drpolinaaesthetics.com / drpolina123'
UNION ALL
SELECT '2. nurse.maria@drpolinaaesthetics.com / nurse123'
UNION ALL
SELECT '3. reception@drpolinaaesthetics.com / reception123'
UNION ALL
SELECT '4. consultant@drpolinaaesthetics.com / consultant123'
UNION ALL
SELECT '5. test@drpolinaaesthetics.com / test123456';