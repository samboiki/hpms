-- Add is_no_show column to visits table
-- This column tracks whether a patient did not show up for their scheduled visit
-- Default value is false (patient showed up)

ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN visits.is_no_show IS 'Indicates whether the patient did not show up for their scheduled visit';

-- Create an index for better query performance when filtering by no-show status
CREATE INDEX IF NOT EXISTS idx_visits_is_no_show ON visits(is_no_show) WHERE is_no_show = true;