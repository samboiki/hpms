-- Add is_from_website flag to visits table to track online bookings
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_from_website BOOLEAN DEFAULT false;

-- Add index for efficient filtering of website bookings
CREATE INDEX IF NOT EXISTS idx_visits_from_website 
ON visits(is_from_website) 
WHERE is_from_website = true;

-- Add comment for documentation
COMMENT ON COLUMN visits.is_from_website IS 'Indicates if this visit was booked through the practice website';

-- Update any existing visits that might have been from website (optional)
-- This is a one-time update based on notes pattern
UPDATE visits 
SET is_from_website = true 
WHERE notes LIKE '%Service:%' 
  AND notes LIKE '%Price:%' 
  AND notes LIKE '%Duration:%'
  AND is_from_website = false;