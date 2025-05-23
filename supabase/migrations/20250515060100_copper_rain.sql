/*
  # Disable RLS for vitals table
  
  This migration disables row level security (RLS) for the vitals table to allow direct access
  without policy restrictions.
*/

-- Disable RLS on vitals table
ALTER TABLE vitals DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DO $$ 
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON vitals;
  DROP POLICY IF EXISTS "Enable select for authenticated users only" ON vitals;
  DROP POLICY IF EXISTS "Enable update for authenticated users only" ON vitals;
  DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON vitals;
END $$;