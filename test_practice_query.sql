-- Test if we can query practices table as anon user
-- This simulates what the landing page is trying to do

-- First check what's in the table
SELECT id, slug, name, domain FROM practices;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'practices';

-- Test the exact query the landing page would use
SELECT * FROM practices WHERE domain = 'drpolina.vercel.app';

-- Also check if we need to handle the new domain
SELECT * FROM practices WHERE domain = 'healthpractice.vercel.app';

-- Update the Dr. Polina practice to also recognize healthpractice.vercel.app
UPDATE practices 
SET domain = 'healthpractice.vercel.app'
WHERE slug = 'dr-polina-aesthetics'
RETURNING *;