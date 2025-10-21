-- =====================================================
-- HPMS: Department-Ward Relationship Migration
-- =====================================================
-- This migration adds department_id to hospital_wards table
-- and creates a view for department ward statistics

-- Step 1: Add department_id column to hospital_wards table
ALTER TABLE hospital_wards
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_hospital_wards_department ON hospital_wards(department_id);

-- Step 3: Add helpful comment
COMMENT ON COLUMN hospital_wards.department_id IS 'Department responsible for managing this ward';

-- Step 4: Create a view for department ward statistics
CREATE OR REPLACE VIEW department_ward_statistics AS
SELECT
  d.id as department_id,
  d.name as department_name,
  d.practice_id,
  COUNT(DISTINCT hw.id) as total_wards,
  SUM(hw.total_beds) as total_beds,
  SUM(hw.occupied_beds) as occupied_beds,
  CASE
    WHEN SUM(hw.total_beds) > 0
    THEN ROUND((SUM(hw.occupied_beds)::numeric / SUM(hw.total_beds)::numeric) * 100, 2)
    ELSE 0
  END as occupancy_rate
FROM departments d
LEFT JOIN hospital_wards hw ON hw.department_id = d.id AND hw.is_active = true
GROUP BY d.id, d.name, d.practice_id;

-- Step 5: Grant appropriate permissions
GRANT SELECT ON department_ward_statistics TO authenticated;

-- Step 6: Verification queries (run these to confirm success)
-- Check if department_id column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_wards' AND column_name = 'department_id';

-- Check if index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'hospital_wards' AND indexname = 'idx_hospital_wards_department';

-- Check if view was created
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_name = 'department_ward_statistics';

-- Test the view with sample data
SELECT * FROM department_ward_statistics LIMIT 5;