-- Make visit_date and visit_time nullable for scheduled visits
-- These fields should only be populated when a visit actually starts

-- Step 1: Drop NOT NULL constraints
ALTER TABLE visits 
ALTER COLUMN visit_date DROP NOT NULL;

ALTER TABLE visits 
ALTER COLUMN visit_time DROP NOT NULL;

-- Step 2: Add comments explaining the fields
COMMENT ON COLUMN visits.visit_date IS 'Actual date when visit started. NULL for scheduled visits that haven''t started yet.';
COMMENT ON COLUMN visits.visit_time IS 'Actual time when visit started. NULL for scheduled visits that haven''t started yet.';
COMMENT ON COLUMN visits.scheduled_date IS 'Scheduled date for the visit. Used for appointments and bookings.';
COMMENT ON COLUMN visits.scheduled_time IS 'Scheduled time for the visit. Used for appointments and bookings.';

-- Step 3: Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'visits' 
AND column_name IN ('visit_date', 'visit_time', 'scheduled_date', 'scheduled_time')
ORDER BY ordinal_position;