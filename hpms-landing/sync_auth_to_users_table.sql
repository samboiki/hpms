-- Sync Dr. Polina auth users to the users table
-- This will allow them to login to the HPMS portal

-- First, check what users exist in auth.users for Dr. Polina
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'practice_id' as practice_id
FROM auth.users
WHERE email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
);

-- Insert these users into the users table
INSERT INTO users (id, email, full_name, role, practice_id)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', 'Unknown User') as full_name,
    COALESCE(raw_user_meta_data->>'role', 'doctor') as role,
    (raw_user_meta_data->>'practice_id')::uuid as practice_id
FROM auth.users
WHERE email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    practice_id = EXCLUDED.practice_id;

-- Verify the users were created
SELECT * FROM users 
WHERE email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
);

-- Also update any appointments to have the correct doctor_id
UPDATE appointments 
SET doctor_id = (
    SELECT id FROM users 
    WHERE email = 'polina@drpolinaaesthetics.com'
    LIMIT 1
)
WHERE practice_id = (
    SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics'
)
AND doctor_id IS NULL;