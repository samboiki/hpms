-- Fix the appointments status check constraint to include 'ready' status
-- This properly updates the constraint that's preventing 'ready' status from being used

-- First, drop the existing constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Add the updated constraint with 'ready' status included
ALTER TABLE appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'scheduled', 'ready', 'in-progress', 'completed', 'cancelled', 'no-show'));

-- Add comment for documentation
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, scheduled, ready, in-progress, completed, cancelled, no-show';

-- Now we can safely update appointments to 'ready' status
-- Update any existing appointments that should be marked as ready
-- This is optional and can be customized based on business logic
UPDATE appointments 
SET status = 'ready' 
WHERE status = 'scheduled' 
  AND date = CURRENT_DATE 
  AND time <= CURRENT_TIME + INTERVAL '30 minutes'
  AND status != 'completed'
  AND status != 'cancelled'
  AND status != 'in-progress';

-- Create indexes for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_appointments_status_date 
ON appointments(status, date) 
WHERE status IN ('scheduled', 'ready', 'in-progress');

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_status 
ON appointments(doctor_id, date, status) 
WHERE status IN ('scheduled', 'ready', 'in-progress');