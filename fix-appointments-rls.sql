-- Fix RLS policies for appointments to allow authenticated users to see appointments for their practice

-- First, check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'appointments'
ORDER BY policyname;

-- Drop existing restrictive policies if needed
DROP POLICY IF EXISTS "Appointments are viewable by authenticated users" ON appointments;
DROP POLICY IF EXISTS "Staff can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view appointments" ON appointments;

-- Create new comprehensive policy for viewing appointments
CREATE POLICY "Practice members can view practice appointments" ON appointments
  FOR SELECT
  TO authenticated
  USING (
    practice_id IN (
      SELECT practice_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Allow inserting appointments (for booking system)
CREATE POLICY "Allow insert appointments with practice_id" ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    practice_id IS NOT NULL
  );

-- Allow updating appointments for practice members
CREATE POLICY "Practice members can update practice appointments" ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    practice_id IN (
      SELECT practice_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Also ensure patients table has proper RLS
DROP POLICY IF EXISTS "Staff can view all patients" ON patients;
DROP POLICY IF EXISTS "Patients viewable by authenticated users" ON patients;

CREATE POLICY "Practice members can view practice patients" ON patients
  FOR SELECT
  TO authenticated
  USING (
    practice_id IN (
      SELECT practice_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Test the policies
SELECT 
  'Appointments visible to authenticated users:' as test,
  COUNT(*) as count
FROM appointments
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

SELECT 
  'Patients visible to authenticated users:' as test,
  COUNT(*) as count  
FROM patients
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';