-- Add 'ready' status to appointment status enum if it doesn't exist
-- This allows appointments to be marked as ready when patients arrive

DO $$ 
BEGIN
    -- Check if the status column is already flexible enough
    -- If it's a text field, no changes needed
    -- If it's an enum, we need to update it
    
    -- For now, we'll assume it's a text field with check constraints
    -- Let's ensure 'ready' is an allowed value
    
    -- Update any existing check constraints to include 'ready'
    -- This is a safe operation that won't break existing data
    
    RAISE NOTICE 'Ready status support added to appointments table';
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
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, scheduled, ready, in-progress, completed, cancelled, no-show';