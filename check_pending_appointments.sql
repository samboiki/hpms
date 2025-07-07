-- Check pending appointments and their practice_id
SELECT 
    a.id,
    a.date,
    a.time,
    a.status,
    a.doctor_id,
    a.practice_id,
    a.created_at,
    p.first_name || ' ' || p.last_name as patient_name
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
WHERE a.status = 'pending'
ORDER BY a.created_at DESC;

-- Check if practice_id is set for all appointments
SELECT 
    status,
    COUNT(*) as total,
    COUNT(practice_id) as with_practice,
    COUNT(*) - COUNT(practice_id) as without_practice
FROM appointments
GROUP BY status
ORDER BY status;

-- Check doctors in the practice
SELECT 
    id,
    full_name,
    role,
    practice_id
FROM users
WHERE role = 'doctor'
AND practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

-- Verify appointments table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'appointments'
AND column_name IN ('id', 'practice_id', 'doctor_id', 'status')
ORDER BY ordinal_position;