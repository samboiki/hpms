/*
  # Disable RLS for visits table
  
  This migration disables row level security (RLS) on the visits table to allow direct access.
  
  1. Changes
    - Disables RLS on visits table
    - Drops existing RLS policies
  
  Note: This is a temporary measure. In production, proper RLS policies should be implemented.
*/

-- Disable RLS on visits table
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to insert visits" ON visits;
  DROP POLICY IF EXISTS "Staff can view visits they create" ON visits;
  DROP POLICY IF EXISTS "Staff can update visits" ON visits;
  DROP POLICY IF EXISTS "Staff can delete visits" ON visits;
END $$;