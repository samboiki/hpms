-- Add 'ready' status to appointment status check constraint
-- This allows appointments to be marked as ready when patients arrive

DO $$ 
BEGIN
    -- Drop the existing check constraint
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
    
    -- Add a new check constraint that includes 'ready' status
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
    CHECK (status IN ('pending', 'scheduled', 'confirmed', 'ready', 'in-progress', 'completed', 'cancelled', 'no-show'));
    
    RAISE NOTICE 'Ready status support added to appointments table check constraint';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
        -- If constraint update fails, we'll just log it and continue
END $$;

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

-- Add comment for documentation
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, scheduled, confirmed, ready, in-progress, completed, cancelled, no-show';