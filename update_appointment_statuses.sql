-- Update appointment statuses to remove 'confirmed' status
-- This script updates the database schema and data to match the new workflow

-- First, check current status distribution
SELECT status, COUNT(*) as count
FROM appointments
GROUP BY status
ORDER BY status;

-- Update any 'confirmed' appointments to 'scheduled'
UPDATE appointments
SET status = 'scheduled',
    updated_at = NOW()
WHERE status = 'confirmed';

-- Update the CHECK constraint to remove 'confirmed' status
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'));

-- Verify the changes
SELECT status, COUNT(*) as count
FROM appointments
GROUP BY status
ORDER BY status;

-- Check appointments with their workflow status
SELECT 
    a.id,
    a.date,
    a.time,
    a.status,
    a.doctor_id,
    p.first_name || ' ' || p.last_name as patient_name,
    CASE 
        WHEN a.status = 'pending' AND a.doctor_id IS NULL THEN 'Awaiting approval'
        WHEN a.status = 'scheduled' AND a.doctor_id IS NOT NULL THEN 'Ready for visit'
        WHEN a.status = 'in-progress' THEN 'Visit in progress'
        WHEN a.status = 'completed' THEN 'Visit completed'
        ELSE 'Other'
    END as workflow_state
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
WHERE a.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY a.date DESC, a.time DESC
LIMIT 20;