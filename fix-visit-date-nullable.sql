-- URGENT FIX: Make visit_date nullable for online bookings

-- Step 1: Drop NOT NULL constraint
ALTER TABLE visits 
ALTER COLUMN visit_date DROP NOT NULL;

-- Step 2: Also make visit_time nullable for consistency
ALTER TABLE visits 
ALTER COLUMN visit_time DROP NOT NULL;

-- Step 3: Add comments
COMMENT ON COLUMN visits.visit_date IS 'Actual date when visit occurred. NULL for scheduled visits.';
COMMENT ON COLUMN visits.visit_time IS 'Actual time when visit occurred. NULL for scheduled visits.';

-- Step 4: Verify the change
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'visits' 
AND column_name IN ('visit_date', 'visit_time', 'scheduled_date', 'scheduled_time')
ORDER BY ordinal_position;