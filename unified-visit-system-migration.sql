-- UNIFIED VISIT SYSTEM MIGRATION
-- This migration unifies appointments and visits into a single table

-- Step 1: Add 'scheduled' status to visits table
ALTER TABLE visits 
DROP CONSTRAINT IF EXISTS visits_status_check;

ALTER TABLE visits 
ADD CONSTRAINT visits_status_check CHECK (
  status = ANY (ARRAY[
    'scheduled'::text,      -- NEW: For appointments
    'in-progress'::text,    -- Visit in progress
    'completed'::text,      -- Completed visit
    'cancelled'::text       -- Cancelled appointment/visit
  ])
);

-- Step 2: Migrate existing appointments to visits table
INSERT INTO visits (
  patient_id,
  doctor_id,
  appointment_id,
  visit_date,
  visit_time,
  visit_type,
  chief_complaint,
  notes,
  status,
  created_at,
  updated_at,
  practice_id
)
SELECT 
  a.patient_id,
  a.doctor_id,
  a.id as appointment_id,  -- Link to original appointment
  a.date as visit_date,
  a.time as visit_time,
  a.type as visit_type,
  a.notes as chief_complaint,  -- Put appointment notes in chief complaint
  'Migrated from appointment #' || a.id as notes,
  CASE 
    WHEN a.status IN ('pending', 'scheduled', 'confirmed') THEN 'scheduled'
    WHEN a.status = 'in-progress' THEN 'in-progress'
    WHEN a.status = 'completed' THEN 'completed'
    WHEN a.status IN ('cancelled', 'no-show') THEN 'cancelled'
    ELSE 'scheduled'
  END as status,
  a.created_at,
  a.updated_at,
  a.practice_id
FROM appointments a
WHERE NOT EXISTS (
  -- Don't migrate if already linked to a visit
  SELECT 1 FROM visits v WHERE v.appointment_id = a.id
);

-- Step 3: Create a view for backward compatibility (optional)
CREATE OR REPLACE VIEW appointments_view AS
SELECT 
  id,
  patient_id,
  doctor_id,
  visit_date as date,
  visit_time as time,
  30 as duration,  -- Default duration
  visit_type as type,
  status,
  chief_complaint as notes,
  created_at,
  updated_at,
  practice_id
FROM visits
WHERE status = 'scheduled';

-- Step 4: Add visit_number column for sequential numbering
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS visit_number INTEGER;

-- Step 5: Create function to auto-generate visit numbers
CREATE OR REPLACE FUNCTION generate_visit_number() 
RETURNS TRIGGER AS $$
BEGIN
  -- Get the max visit number for this patient
  SELECT COALESCE(MAX(visit_number), 0) + 1 
  INTO NEW.visit_number
  FROM visits 
  WHERE patient_id = NEW.patient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for auto-numbering
DROP TRIGGER IF EXISTS set_visit_number ON visits;
CREATE TRIGGER set_visit_number
  BEFORE INSERT ON visits
  FOR EACH ROW
  EXECUTE FUNCTION generate_visit_number();

-- Step 7: Update existing visits with numbers
WITH numbered_visits AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id 
      ORDER BY visit_date, visit_time
    ) as visit_num
  FROM visits
)
UPDATE visits v
SET visit_number = nv.visit_num
FROM numbered_visits nv
WHERE v.id = nv.id
AND v.visit_number IS NULL;

-- Step 8: Make visit_number NOT NULL after population
ALTER TABLE visits 
ALTER COLUMN visit_number SET NOT NULL;