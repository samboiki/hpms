-- Check if RLS is enabled on practices table
SELECT 
  tablename,
  rowsecurity
FROM 
  pg_tables
WHERE 
  schemaname = 'public' 
  AND tablename = 'practices';

-- Disable RLS on practices table (for public read access)
ALTER TABLE practices DISABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access
CREATE POLICY "Allow public read access on practices" 
ON practices 
FOR SELECT 
TO public 
USING (true);

-- Test query
SELECT id, name, domain, slug FROM practices;