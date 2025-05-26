-- Check appointments for Dr. Polina practice
-- Your practice_id is: b64632c2-3a56-44cf-a2c9-0e42be03a2d3

-- Count appointments by practice_id
SELECT practice_id, COUNT(*) as count 
FROM appointments 
GROUP BY practice_id;

-- Check if there are any appointments for Dr. Polina practice
SELECT * FROM appointments 
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY created_at DESC
LIMIT 10;

-- Check recent appointments created from landing page (should have notes mentioning service)
SELECT id, patient_id, doctor_id, date, time, status, notes, practice_id, created_at 
FROM appointments 
WHERE notes LIKE '%Service:%' 
   OR notes LIKE '%requested%'
   OR created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Update appointments that should belong to Dr. Polina practice
-- These are appointments without doctor_id that were likely created from landing page
UPDATE appointments 
SET practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3',
    status = 'pending'
WHERE practice_id IS NULL 
   OR (notes LIKE '%Service:%' AND practice_id != 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
RETURNING *;