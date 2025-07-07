-- Update NewCharm domain to match the actual website domain
UPDATE practices 
SET domain = 'www.newcharmdentalpractice.com',
    updated_at = NOW()
WHERE slug = 'newcharm-dental';

-- Also add the non-www version for safety
INSERT INTO practices (
  id,
  slug,
  name,
  domain,
  logo_url,
  primary_color,
  secondary_color,
  contact_email,
  contact_phone,
  address,
  city,
  country,
  postal_code,
  business_hours,
  features,
  settings,
  hero_title,
  hero_subtitle,
  hero_image_url,
  about_text,
  services,
  social_links,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  slug || '-nowww',
  name,
  'newcharmdentalpractice.com',
  logo_url,
  primary_color,
  secondary_color,
  contact_email,
  contact_phone,
  address,
  city,
  country,
  postal_code,
  business_hours,
  features,
  settings,
  hero_title,
  hero_subtitle,
  hero_image_url,
  about_text,
  services,
  social_links,
  NOW(),
  NOW()
FROM practices 
WHERE slug = 'newcharm-dental'
ON CONFLICT (domain) DO UPDATE SET
  updated_at = NOW();

-- Check the result
SELECT slug, domain FROM practices WHERE slug LIKE '%newcharm%';