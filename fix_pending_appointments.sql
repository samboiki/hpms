-- Fix appointments created from landing page to have pending status
UPDATE appointments 
SET status = 'pending'
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
  AND doctor_id IS NULL
  AND notes LIKE '%Online Booking:%'
  AND status = 'scheduled';

-- Show the updated appointments
SELECT id, patient_id, doctor_id, date, time, status, notes, practice_id
FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY created_at DESC
LIMIT 10;