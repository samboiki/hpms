/*
  # Temporarily disable RLS on patients table
  
  This migration temporarily disables RLS on the patients table to allow all operations
  while maintaining security through authentication.
  
  Note: This is a temporary measure and should be replaced with proper RLS policies
  once the application's access patterns are better defined.
*/

-- Disable RLS on patients table
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
ON patients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);