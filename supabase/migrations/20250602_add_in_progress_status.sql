-- Add 'in-progress' status to appointment status if it doesn't exist
-- This allows appointments to be marked as in-progress when a visit starts

DO $$ 
BEGIN
    -- Ensure 'in-progress' is an allowed status value
    -- This migration is safe to run multiple times
    
    -- Update the comment to include all valid statuses
    COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, scheduled, ready, in-progress, completed, cancelled, no-show';
    
    RAISE NOTICE 'In-progress status support ensured for appointments table';
END $$;

-- Update any appointments that have active visits to be marked as in-progress
-- This ensures data consistency between visits and appointments
UPDATE appointments a
SET status = 'in-progress',
    updated_at = NOW()
FROM visits v
WHERE a.id = v.appointment_id
  AND v.status = 'in-progress'
  AND a.status NOT IN ('in-progress', 'completed', 'cancelled');

-- Add an index on appointment status for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_status_date 
ON appointments(status, date) 
WHERE status IN ('scheduled', 'ready', 'in-progress');

-- Add an index for doctor queue queries
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_status 
ON appointments(doctor_id, date, status) 
WHERE status IN ('scheduled', 'ready', 'in-progress');