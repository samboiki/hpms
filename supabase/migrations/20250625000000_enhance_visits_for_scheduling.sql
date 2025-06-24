/*
  # Enhance Visits Table for Unified Scheduling System
  
  This migration transforms the visits table to handle all scheduling functionality,
  replacing the appointments table with a unified visits-only system.
  
  ## New Fields for Visit Lifecycle:
  - is_scheduled: Initial booking request (from website or direct)
  - is_confirmed: Practice has confirmed the booking
  - is_ready: Patient is next in queue to see doctor
  - is_checked_in: Patient is in practice area/waiting room
  - is_cancelled: Visit has been cancelled
  - scheduled_date: Original date when visit was booked
  - scheduled_time: Original time when visit was booked
  
  ## Data Separation:
  - scheduled_date/scheduled_time: When the visit was originally booked
  - visit_date/visit_time: Actual date/time when patient was seen
  
  ## Visit Lifecycle Flow:
  1. Website Booking → is_scheduled=true, is_confirmed=false
  2. Practice Confirms → is_confirmed=true  
  3. Patient Arrives → is_checked_in=true
  4. Next Patient → is_ready=true
  5. Start Visit → status='in-progress'
  6. Complete Visit → status='completed'
*/

-- Add new boolean columns for visit scheduling states
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;

-- Add scheduled date/time tracking (when visit was originally booked)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_time TIME;

-- Add practice_id for multi-tenant support
ALTER TABLE visits ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id) ON DELETE CASCADE;

-- Add indexes for performance on the new boolean columns
CREATE INDEX IF NOT EXISTS idx_visits_scheduled ON visits(is_scheduled) WHERE is_scheduled = true;
CREATE INDEX IF NOT EXISTS idx_visits_confirmed ON visits(is_confirmed) WHERE is_confirmed = true;
CREATE INDEX IF NOT EXISTS idx_visits_ready ON visits(is_ready) WHERE is_ready = true;
CREATE INDEX IF NOT EXISTS idx_visits_checked_in ON visits(is_checked_in) WHERE is_checked_in = true;
CREATE INDEX IF NOT EXISTS idx_visits_cancelled ON visits(is_cancelled) WHERE is_cancelled = true;
CREATE INDEX IF NOT EXISTS idx_visits_practice_date ON visits(practice_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_datetime ON visits(scheduled_date, scheduled_time);

-- Add updated_at trigger for visits table if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
CREATE TRIGGER update_visits_updated_at
    BEFORE UPDATE ON visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get visit current state (for UI display)
CREATE OR REPLACE FUNCTION get_visit_state(visit_row visits)
RETURNS TEXT AS $$
BEGIN
    -- Priority order: cancelled > completed > in-progress > ready > checked_in > confirmed > scheduled
    IF visit_row.is_cancelled THEN
        RETURN 'cancelled';
    ELSIF visit_row.status = 'completed' THEN
        RETURN 'completed';
    ELSIF visit_row.status = 'in-progress' THEN
        RETURN 'in-progress';
    ELSIF visit_row.is_ready THEN
        RETURN 'ready';
    ELSIF visit_row.is_checked_in THEN
        RETURN 'checked-in';
    ELSIF visit_row.is_confirmed THEN
        RETURN 'confirmed';
    ELSIF visit_row.is_scheduled THEN
        RETURN 'scheduled';
    ELSE
        RETURN 'pending';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- View to get all visits with their current state
CREATE OR REPLACE VIEW visits_with_state AS
SELECT 
    v.*,
    get_visit_state(v) as current_state,
    p.first_name as patient_first_name,
    p.last_name as patient_last_name,
    p.cell_number as patient_cell_number,
    u.full_name as doctor_name,
    pr.name as practice_name
FROM visits v
LEFT JOIN patients p ON v.patient_id = p.id
LEFT JOIN users u ON v.doctor_id = u.id
LEFT JOIN practices pr ON v.practice_id = pr.id;

-- Function to transition visit states safely
CREATE OR REPLACE FUNCTION transition_visit_state(
    visit_id UUID,
    new_state TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_visit visits%ROWTYPE;
BEGIN
    -- Get current visit
    SELECT * INTO current_visit FROM visits WHERE id = visit_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Visit not found';
    END IF;
    
    -- Check if visit is cancelled
    IF current_visit.is_cancelled THEN
        RAISE EXCEPTION 'Cannot transition cancelled visit';
    END IF;
    
    -- Perform state transitions
    CASE new_state
        WHEN 'confirmed' THEN
            UPDATE visits SET 
                is_confirmed = true,
                updated_at = now()
            WHERE id = visit_id AND is_scheduled = true;
            
        WHEN 'checked-in' THEN
            UPDATE visits SET 
                is_checked_in = true,
                updated_at = now()
            WHERE id = visit_id AND is_confirmed = true;
            
        WHEN 'ready' THEN
            -- First, clear any other ready patients for this doctor/practice on this date
            UPDATE visits SET 
                is_ready = false 
            WHERE doctor_id = current_visit.doctor_id 
                AND visit_date = current_visit.visit_date 
                AND is_ready = true;
            
            -- Then set this patient as ready
            UPDATE visits SET 
                is_ready = true,
                updated_at = now()
            WHERE id = visit_id AND is_checked_in = true;
            
        WHEN 'in-progress' THEN
            UPDATE visits SET 
                status = 'in-progress',
                is_ready = false,
                updated_at = now()
            WHERE id = visit_id AND is_ready = true;
            
        WHEN 'completed' THEN
            UPDATE visits SET 
                status = 'completed',
                is_ready = false,
                updated_at = now()
            WHERE id = visit_id AND status = 'in-progress';
            
        WHEN 'cancelled' THEN
            UPDATE visits SET 
                is_cancelled = true,
                is_ready = false,
                updated_at = now()
            WHERE id = visit_id;
            
        ELSE
            RAISE EXCEPTION 'Invalid state transition: %', new_state;
    END CASE;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies for visits
DROP POLICY IF EXISTS "Staff can view all visits" ON visits;
DROP POLICY IF EXISTS "Staff can insert visits" ON visits;
DROP POLICY IF EXISTS "Staff can update visits" ON visits;

CREATE POLICY "Staff can view practice visits" ON visits
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.practice_id = visits.practice_id
        )
    );

CREATE POLICY "Staff can insert practice visits" ON visits
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.practice_id = visits.practice_id
        )
    );

CREATE POLICY "Staff can update practice visits" ON visits
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.practice_id = visits.practice_id
        )
    );

-- Migrate existing appointments to visits (if appointments table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        -- Insert appointments as confirmed visits
        INSERT INTO visits (
            patient_id, 
            doctor_id, 
            practice_id,
            visit_date, 
            visit_time, 
            visit_type,
            chief_complaint,
            notes,
            status,
            is_scheduled,
            is_confirmed,
            is_ready,
            is_checked_in,
            is_cancelled,
            scheduled_date,
            scheduled_time,
            created_at,
            updated_at
        )
        SELECT 
            a.patient_id,
            a.doctor_id,
            COALESCE(a.practice_id, u.practice_id), -- Get practice_id from doctor if not set
            a.date as visit_date,
            a.time as visit_time,
            a.type as visit_type,
            a.notes as chief_complaint,
            a.notes,
            CASE 
                WHEN a.status = 'scheduled' THEN 'in-progress'
                WHEN a.status = 'confirmed' THEN 'in-progress'
                WHEN a.status = 'in-progress' THEN 'in-progress'
                WHEN a.status = 'completed' THEN 'completed'
                WHEN a.status = 'cancelled' THEN 'in-progress'
                ELSE 'in-progress'
            END as status,
            true as is_scheduled,
            CASE 
                WHEN a.status IN ('scheduled', 'confirmed', 'in-progress', 'completed') THEN true
                ELSE false
            END as is_confirmed,
            CASE 
                WHEN a.status = 'in-progress' THEN true
                ELSE false
            END as is_ready,
            CASE 
                WHEN a.status IN ('confirmed', 'in-progress', 'completed') THEN true
                ELSE false
            END as is_checked_in,
            CASE 
                WHEN a.status = 'cancelled' THEN true
                ELSE false
            END as is_cancelled,
            a.date as scheduled_date, -- Original appointment date becomes scheduled_date
            a.time as scheduled_time, -- Original appointment time becomes scheduled_time
            a.created_at,
            a.updated_at
        FROM appointments a
        LEFT JOIN users u ON a.doctor_id = u.id
        WHERE NOT EXISTS (
            SELECT 1 FROM visits v 
            WHERE v.appointment_id = a.id
        );
        
        RAISE NOTICE 'Migrated appointments to visits table';
    END IF;
END $$;

-- Comment for future reference
COMMENT ON TABLE visits IS 'Unified table for all patient scheduling and encounters. Replaces the appointments table with enhanced state management.';
COMMENT ON COLUMN visits.is_scheduled IS 'Initial booking request, often from website - needs confirmation';
COMMENT ON COLUMN visits.is_confirmed IS 'Practice has confirmed the booking';
COMMENT ON COLUMN visits.is_ready IS 'Patient is next in queue to see doctor';
COMMENT ON COLUMN visits.is_checked_in IS 'Patient is in practice area/waiting room';
COMMENT ON COLUMN visits.is_cancelled IS 'Visit has been cancelled';
COMMENT ON COLUMN visits.scheduled_date IS 'Original date when visit was scheduled/booked';
COMMENT ON COLUMN visits.scheduled_time IS 'Original time when visit was scheduled/booked';