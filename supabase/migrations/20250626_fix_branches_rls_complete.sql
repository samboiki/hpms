-- Fix branches table RLS policies to allow doctors and admins to manage branches

-- First, drop ALL existing policies on branches table
DROP POLICY IF EXISTS "Users can view branches of their practice" ON branches;
DROP POLICY IF EXISTS "Admin can manage branches" ON branches;
DROP POLICY IF EXISTS "Admin and doctors can manage branches" ON branches;
DROP POLICY IF EXISTS "Admin and doctors can insert branches" ON branches;

-- Enable RLS on branches table
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow ALL authenticated users to VIEW branches from their practice
CREATE POLICY "Users can view their practice branches"
  ON branches FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow admin and doctor to INSERT branches for their practice
CREATE POLICY "Admin and doctor can create branches"
  ON branches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  );

-- Policy 3: Allow admin and doctor to UPDATE branches in their practice
CREATE POLICY "Admin and doctor can update branches"
  ON branches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  );

-- Policy 4: Allow admin and doctor to DELETE branches from their practice
CREATE POLICY "Admin and doctor can delete branches"
  ON branches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'doctor')
      AND practice_id = branches.practice_id
    )
  );

-- Also update doctor_branch_schedules policies
DROP POLICY IF EXISTS "Users can view doctor schedules" ON doctor_branch_schedules;
DROP POLICY IF EXISTS "Admin can manage doctor schedules" ON doctor_branch_schedules;
DROP POLICY IF EXISTS "Admin and doctors can manage doctor schedules" ON doctor_branch_schedules;

-- Enable RLS on doctor_branch_schedules table
ALTER TABLE doctor_branch_schedules ENABLE ROW LEVEL SECURITY;

-- Allow users to view schedules for branches in their practice
CREATE POLICY "Users can view schedules in their practice"
  ON doctor_branch_schedules FOR SELECT
  USING (
    branch_id IN (
      SELECT b.id FROM branches b
      JOIN users u ON u.practice_id = b.practice_id
      WHERE u.id = auth.uid()
    )
  );

-- Allow admin and doctor to manage schedules
CREATE POLICY "Admin and doctor can manage schedules"
  ON doctor_branch_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN branches b ON b.practice_id = u.practice_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'doctor')
      AND b.id = doctor_branch_schedules.branch_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN branches b ON b.practice_id = u.practice_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'doctor')
      AND b.id = doctor_branch_schedules.branch_id
    )
  );

-- Verify the policies (optional - for checking)
SELECT 
  tablename,
  policyname,
  permissive,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('branches', 'doctor_branch_schedules')
ORDER BY tablename, policyname;