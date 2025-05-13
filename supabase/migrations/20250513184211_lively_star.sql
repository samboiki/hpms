/*
  # Disable RLS for next_of_kin table
  
  1. Changes
    - Disable Row Level Security on next_of_kin table
    - Drop all existing policies as they won't be needed
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert next of kin" ON next_of_kin;
DROP POLICY IF EXISTS "Allow authenticated users to update next of kin" ON next_of_kin;
DROP POLICY IF EXISTS "Allow authenticated users to view next of kin" ON next_of_kin;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON next_of_kin;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON next_of_kin;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON next_of_kin;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON next_of_kin;

-- Disable RLS
ALTER TABLE next_of_kin DISABLE ROW LEVEL SECURITY;