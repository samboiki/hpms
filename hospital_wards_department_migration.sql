-- ========================================
-- Hospital Wards Department Migration
-- ========================================
-- This migration adds department_id column to hospital_wards table
-- and creates the necessary relationships and indexes

-- Add department_id column to hospital_wards table
ALTER TABLE hospital_wards
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id ON hospital_wards(department_id);

-- Update existing wards to have a department_id if departments exist
UPDATE hospital_wards
SET department_id = (SELECT id FROM departments WHERE practice_id = hospital_wards.practice_id LIMIT 1)
WHERE department_id IS NULL
  AND EXISTS (SELECT 1 FROM departments WHERE practice_id = hospital_wards.practice_id);

-- Verify the migration
SELECT
    'Migration completed successfully' as status,
    COUNT(*) as total_wards,
    COUNT(department_id) as wards_with_department,
    COUNT(*) - COUNT(department_id) as wards_without_department
FROM hospital_wards;

-- Show sample data
SELECT
    hw.id,
    hw.name as ward_name,
    hw.practice_id,
    hw.department_id,
    d.name as department_name
FROM hospital_wards hw
LEFT JOIN departments d ON hw.department_id = d.id
LIMIT 5;