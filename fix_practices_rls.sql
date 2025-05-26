-- Enable RLS on practices table
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

-- Allow public read access to practices (for landing pages)
CREATE POLICY "Allow public read access to practices" 
ON practices FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users to update their own practice
CREATE POLICY "Allow users to update their own practice" 
ON practices FOR UPDATE 
TO authenticated 
USING (id IN (
  SELECT practice_id FROM users WHERE id = auth.uid()
));

-- Test the query that the landing page uses
SELECT * FROM practices WHERE domain = 'drpolina.vercel.app' OR domain = 'healthpractice.vercel.app';