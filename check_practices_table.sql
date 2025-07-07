-- Check if practices table exists and has data
SELECT * FROM practices;

-- Check specifically for Dr. Polina practice
SELECT * FROM practices WHERE slug = 'dr-polina-aesthetics';

-- Check RLS policies on practices table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'practices';