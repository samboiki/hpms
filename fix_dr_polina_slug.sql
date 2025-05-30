-- Fix Dr. Polina practice slug to match what the landing page expects
UPDATE practices 
SET slug = 'dr-polina-aesthetics'
WHERE slug = 'medcenter-aesthetics';

-- Verify the update
SELECT id, slug, name, domain FROM practices WHERE slug = 'dr-polina-aesthetics';

-- Update any appointments that were created with NULL practice_id
-- These are likely from failed booking attempts
UPDATE appointments 
SET practice_id = (SELECT id FROM practices WHERE slug = 'dr-polina-aesthetics')
WHERE practice_id IS NULL 
   AND (notes LIKE '%Service:%' OR notes LIKE '%Location:%')
RETURNING id, patient_id, date, time, practice_id, notes;

-- Count appointments by practice
SELECT 
    p.name as practice_name,
    p.slug,
    COUNT(a.id) as appointment_count
FROM practices p
LEFT JOIN appointments a ON a.practice_id = p.id
GROUP BY p.id, p.name, p.slug
ORDER BY appointment_count DESC;