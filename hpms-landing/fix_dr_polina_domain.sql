-- Fix MedCenter domain for multi-tenant deployment
UPDATE practices 
SET domain = 'medcenter.vercel.app'
WHERE slug = 'medcenter-aesthetics';

-- Verify the update
SELECT slug, name, domain FROM practices WHERE slug = 'medcenter-aesthetics';