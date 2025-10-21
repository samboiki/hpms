-- Add department_id column to hospital_wards table
ALTER TABLE hospital_wards
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id ON hospital_wards(department_id);

-- Update existing wards to have a department_id if departments exist
-- This is optional and can be customized based on your needs
UPDATE hospital_wards
SET department_id = (SELECT id FROM departments WHERE practice_id = hospital_wards.practice_id LIMIT 1)
WHERE department_id IS NULL
  AND EXISTS (SELECT 1 FROM departments WHERE practice_id = hospital_wards.practice_id);