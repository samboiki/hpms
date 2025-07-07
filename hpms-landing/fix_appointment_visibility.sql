-- Check if Dr. Polina appointments exist and why they might not be showing

-- 1. First, let's see all recent appointments
SELECT 
    a.id,
    a.date,
    a.time,
    a.status,
    a.doctor_id,
    a.practice_id,
    a.notes,
    p.first_name || ' ' || p.last_name as patient_name,
    pr.name as practice_name
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN practices pr ON a.practice_id = pr.id
WHERE a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC;

-- 2. Check if there are any appointments without doctor_id
SELECT COUNT(*) as appointments_without_doctor
FROM appointments 
WHERE doctor_id IS NULL;

-- 3. Get Dr. Polina practice ID
SELECT id, name, slug 
FROM practices 
WHERE slug = 'dr-polina-aesthetics';

-- 4. Count appointments by practice
SELECT 
    pr.name as practice_name,
    COUNT(a.id) as appointment_count
FROM appointments a
LEFT JOIN practices pr ON a.practice_id = pr.id
GROUP BY pr.name
ORDER BY appointment_count DESC;

-- 5. If you need to assign a default doctor to appointments without one
-- First, find available doctors for Dr. Polina's practice
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name,
    u.raw_user_meta_data->>'practice_id' as practice_id
FROM auth.users u
WHERE u.raw_user_meta_data->>'practice_id' = (
    SELECT id::text FROM practices WHERE slug = 'dr-polina-aesthetics'
);

-- 6. Optional: Update appointments without doctor_id to assign Dr. Polina
-- UNCOMMENT AND RUN ONLY IF NEEDED:
/*
UPDATE appointments 
SET doctor_id = (
    SELECT id FROM auth.users 
    WHERE email = 'polina@drpolinaaesthetics.com'
    LIMIT 1
)
WHERE practice_id = (
    SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics'
)
AND doctor_id IS NULL;
*/