-- Migration: Add is_from_website flag to visits table

-- Step 1: Add the column
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_from_website BOOLEAN DEFAULT false;

-- Step 2: Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_visits_from_website 
ON visits(is_from_website) 
WHERE is_from_website = true;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN visits.is_from_website IS 'Indicates if this visit was booked through the practice website';

-- Step 4: Update any existing visits that might have been from website
-- This is a one-time update based on notes pattern
UPDATE visits 
SET is_from_website = true 
WHERE notes LIKE '%Service:%' 
  AND notes LIKE '%Price:%' 
  AND notes LIKE '%Duration:%'
  AND is_from_website = false;

-- Step 5: Display confirmation
SELECT 
    COUNT(*) as total_visits,
    COUNT(*) FILTER (WHERE is_from_website = true) as website_bookings
FROM visits;