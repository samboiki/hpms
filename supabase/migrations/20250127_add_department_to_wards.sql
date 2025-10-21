-- =====================================================
-- Add department_id to hospital_wards for hierarchical management
-- =====================================================

-- Add department_id column to hospital_wards table
ALTER TABLE hospital_wards
ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_hospital_wards_department ON hospital_wards(department_id);

-- Add helpful comment
COMMENT ON COLUMN hospital_wards.department_id IS 'Department responsible for managing this ward';

-- Update the ward_beds view or any dependent views if needed
-- This ensures the department relationship is available in queries

-- Optional: Create a view for department ward statistics
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

-- Grant appropriate permissions
GRANT SELECT ON department_ward_statistics TO authenticated;

-- Add RLS policy for the view
ALTER TABLE department_ward_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view department statistics for their practice"
ON department_ward_statistics
FOR SELECT
USING (
  practice_id IN (
    SELECT practice_id
    FROM practice_staff
    WHERE user_id = auth.uid()
    AND is_active = true
  )
);