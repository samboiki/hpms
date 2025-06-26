-- Make visit_date nullable for visits that haven't occurred yet
-- This is needed for online bookings where we only have scheduled_date/scheduled_time

-- Step 1: Remove the NOT NULL constraint from visit_date
ALTER TABLE visits 
ALTER COLUMN visit_date DROP NOT NULL;

-- Step 2: Add a comment explaining the nullable behavior
COMMENT ON COLUMN visits.visit_date IS 'Actual date when the visit occurred. NULL for scheduled visits that haven\'t happened yet.';

-- Step 3: Add a check constraint to ensure data integrity
-- Either visit_date is set (for completed visits) OR scheduled_date is set (for scheduled visits)
ALTER TABLE visits
DROP CONSTRAINT IF EXISTS visits_date_check;

ALTER TABLE visits
ADD CONSTRAINT visits_date_check 
CHECK (
  visit_date IS NOT NULL OR scheduled_date IS NOT NULL
);

-- Step 4: Update any existing records that might have issues
-- If a visit has scheduled_date but no visit_date and is not completed, that's valid
-- If a visit is completed, it should have visit_date
UPDATE visits
SET visit_date = scheduled_date
WHERE status = 'completed' 
  AND visit_date IS NULL 
  AND scheduled_date IS NOT NULL;

-- Step 5: Display the current state
SELECT 
  COUNT(*) as total_visits,
  COUNT(visit_date) as visits_with_date,
  COUNT(scheduled_date) as visits_with_scheduled_date,
  COUNT(*) FILTER (WHERE visit_date IS NULL AND scheduled_date IS NOT NULL) as scheduled_only,
  COUNT(*) FILTER (WHERE status = 'completed' AND visit_date IS NULL) as completed_without_date
FROM visits;