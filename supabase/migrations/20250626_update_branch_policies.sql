-- Update RLS policies for branches to allow doctors to manage branches too

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin can manage branches" ON branches;

-- Create new policy that allows both admin and doctor roles to manage branches
CREATE POLICY "Admin and doctors can manage branches"
  ON branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  );

-- Also update the insert policy to be explicit
CREATE POLICY "Admin and doctors can insert branches"
  ON branches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  );

-- Update doctor_branch_schedules policies as well
DROP POLICY IF EXISTS "Admin can manage doctor schedules" ON doctor_branch_schedules;

CREATE POLICY "Admin and doctors can manage doctor schedules"
  ON doctor_branch_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN branches b ON b.practice_id = u.practice_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'doctor')
      AND b.id = doctor_branch_schedules.branch_id
    )
  );

-- Add comment to clarify the policy
COMMENT ON POLICY "Admin and doctors can manage branches" ON branches IS 'Allows both admin and doctor roles to create, update, and delete branches within their practice';
COMMENT ON POLICY "Admin and doctors can insert branches" ON branches IS 'Allows both admin and doctor roles to insert new branches for their practice';