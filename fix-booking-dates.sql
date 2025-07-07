-- Fix the date format for the existing booking
UPDATE visits 
SET 
  scheduled_date = '2025-06-27',
  scheduled_time = '16:00:00',
  visit_date = NULL,  -- This should be NULL until visit starts
  visit_time = NULL   -- This should be NULL until visit starts
WHERE id = 'dd78c2c7-7a2c-4c11-80a8-7916b9fd0c63';

-- Verify the update
SELECT 
  id,
  patient_id,
  scheduled_date,
  scheduled_time,
  visit_date,
  visit_time,
  status,
  is_confirmed,
  is_from_website,
  notes
FROM visits 
WHERE id = 'dd78c2c7-7a2c-4c11-80a8-7916b9fd0c63';