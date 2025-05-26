-- Fix Dr. Polina domain for multi-tenant deployment
UPDATE practices 
SET domain = 'drpolina.vercel.app'
WHERE slug = 'dr-polina-aesthetics';

-- Verify the update
SELECT slug, name, domain FROM practices WHERE slug = 'dr-polina-aesthetics';