-- Script to clean up appointments without doctors
-- First, let's see what we're dealing with

-- Check appointments by status and doctor assignment
SELECT 
    status,
    COUNT(*) as total,
    COUNT(doctor_id) as with_doctor,
    COUNT(*) - COUNT(doctor_id) as without_doctor
FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
GROUP BY status
ORDER BY status;

-- List appointments that should have doctors but don't
SELECT 
    id,
    date,
    time,
    status,
    patient_id,
    type,
    created_at
FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
    AND doctor_id IS NULL
    AND status IN ('scheduled', 'confirmed', 'in-progress', 'completed')
ORDER BY date DESC, time DESC;

-- Delete appointments without doctors that should have them
-- (excluding 'pending' status as those are awaiting approval)
DELETE FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
    AND doctor_id IS NULL
    AND status IN ('scheduled', 'confirmed', 'in-progress', 'completed');

-- Verify cleanup
SELECT 
    status,
    COUNT(*) as total,
    COUNT(doctor_id) as with_doctor,
    COUNT(*) - COUNT(doctor_id) as without_doctor
FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
GROUP BY status
ORDER BY status;