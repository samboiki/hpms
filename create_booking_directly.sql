-- First, let's check if online_booking is enabled for Dr. Polina practice
SELECT id, slug, name, features->>'online_booking' as online_booking_enabled
FROM practices
WHERE slug = 'dr-polina-aesthetics';

-- If the above shows null or false, enable online booking:
UPDATE practices
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{online_booking}',
  'true'::jsonb
)
WHERE slug = 'dr-polina-aesthetics';

-- Verify the update
SELECT id, slug, name, features
FROM practices
WHERE slug = 'dr-polina-aesthetics';