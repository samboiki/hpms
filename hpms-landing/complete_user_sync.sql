-- Complete sync of Dr. Polina auth users to users table
-- This will allow them to login to the HPMS portal

-- First, check if the avatar column exists (it might be missing)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'avatar') THEN
        ALTER TABLE users ADD COLUMN avatar TEXT;
    END IF;
END $$;

-- Now sync all Dr. Polina users from auth.users to users table
INSERT INTO users (id, email, full_name, role, practice_id, created_at, avatar)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 
             au.raw_user_meta_data->>'first_name' || ' ' || au.raw_user_meta_data->>'last_name',
             'Unknown User') as full_name,
    CASE 
        WHEN au.raw_user_meta_data->>'role' IN ('admin', 'doctor', 'nurse', 'receptionist') 
        THEN (au.raw_user_meta_data->>'role')::text
        ELSE 'doctor'
    END as role,
    CASE 
        WHEN au.raw_user_meta_data->>'practice_id' IS NOT NULL 
        THEN (au.raw_user_meta_data->>'practice_id')::uuid
        ELSE (SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics')
    END as practice_id,
    au.created_at,
    NULL as avatar
FROM auth.users au
WHERE au.email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    practice_id = EXCLUDED.practice_id,
    email = EXCLUDED.email;

-- Also check if there are any other auth users that need syncing
-- This will show all auth users not in the users table
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'full_name' as full_name,
    au.raw_user_meta_data->>'role' as role,
    'Not in users table' as status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL;

-- Verify the sync worked
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    p.name as practice_name
FROM users u
LEFT JOIN practices p ON u.practice_id = p.id
WHERE u.email IN (
    'polina@drpolinaaesthetics.com',
    'nurse.maria@drpolinaaesthetics.com', 
    'reception@drpolinaaesthetics.com',
    'consultant@drpolinaaesthetics.com'
);

-- Update appointments to use the correct doctor_id
UPDATE appointments a
SET doctor_id = u.id
FROM users u
WHERE u.email = 'polina@drpolinaaesthetics.com'
AND a.practice_id = (SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics')
AND a.doctor_id IS NULL;

-- Final check: Show recent appointments with doctor names
SELECT 
    a.id,
    a.date,
    a.time,
    p.first_name || ' ' || p.last_name as patient_name,
    u.full_name as doctor_name,
    pr.name as practice_name
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN users u ON a.doctor_id = u.id
LEFT JOIN practices pr ON a.practice_id = pr.id
WHERE a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC;