-- Add ready_status column to appointments table
-- This migration adds appointment readiness tracking functionality

BEGIN;

-- Create the ready status enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_ready_status') THEN
        CREATE TYPE appointment_ready_status AS ENUM ('not_ready', 'ready', 'in_queue');
    END IF;
END $$;

-- Add the ready_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'ready_status'
    ) THEN
        ALTER TABLE appointments 
        ADD COLUMN ready_status appointment_ready_status DEFAULT 'not_ready';
    END IF;
END $$;

-- Add a comment for documentation
COMMENT ON COLUMN appointments.ready_status IS 'Patient readiness status: not_ready (default), ready (patient has arrived), in_queue (being processed)';

-- Create an index for better performance when filtering by ready_status
CREATE INDEX IF NOT EXISTS idx_appointments_ready_status ON appointments(ready_status);

-- Update any existing scheduled appointments to not_ready status
UPDATE appointments 
SET ready_status = 'not_ready' 
WHERE ready_status IS NULL;

COMMIT;

-- Verification query to check the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'ready_status';