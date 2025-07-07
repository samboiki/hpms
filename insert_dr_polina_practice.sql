-- Add Dr. Polina Aesthetics practice
INSERT INTO practices (
  slug,
  name,
  domain,
  primary_color,
  secondary_color,
  logo_url,
  hero_image,
  hero_title,
  hero_subtitle,
  services,
  about_text,
  contact_email,
  contact_phone,
  address,
  city,
  country,
  postal_code,
  business_hours,
  social_links,
  features,
  certifications,
  testimonials
) VALUES (
  'dr-polina-aesthetics',
  'Dr. Polina Aesthetics',
  'drpolina.vercel.app',
  '#E91E63', -- Elegant pink/rose color for aesthetics
  '#9C27B0', -- Purple as secondary
  '/images/dr-polina-logo.png',
  '/images/dr-polina-hero.jpg',
  'Reveal Your Natural Beauty',
  'Premier medical aesthetic center specializing in personalized skin, hair, and body treatments',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'skin-analysis',
      'name', 'Advanced Skin Analysis',
      'description', 'Comprehensive skin evaluation using cutting-edge diagnostic technology',
      'icon', 'Microscope'
    ),
    jsonb_build_object(
      'id', 'acne-treatment',
      'name', 'Acne Treatment Program',
      'description', 'Medical-grade solutions for acne and acne scarring',
      'icon', 'Sparkles'
    ),
    jsonb_build_object(
      'id', 'chemical-peels',
      'name', 'Chemical Peels',
      'description', 'Professional peels for skin rejuvenation and pigmentation',
      'icon', 'Droplets'
    )
  ),
  'Dr. Polina Aesthetics is Namibia''s premier medical aesthetic center, founded by Dr. Teopolina N. Tileinge.',
  'info@drpolinaaesthetics.com',
  '+264 81 435 8844',
  'Feld Street 4, Ausspannplatz',
  'Windhoek',
  'Namibia',
  '10001',
  jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'thursday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'friday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'saturday', jsonb_build_object('open', '09:00', 'close', '14:00'),
    'sunday', jsonb_build_object('closed', true)
  ),
  jsonb_build_object(
    'facebook', 'https://facebook.com/drpolinaaesthetics',
    'instagram', 'https://instagram.com/drpolinaaesthetics',
    'whatsapp', '+26481435844'
  ),
  jsonb_build_array(
    'Advanced Skin Analysis Technology',
    'Medical-Grade Products',
    'Personalized Treatment Plans',
    'Experienced Medical Team'
  ),
  jsonb_build_array(
    'Medical Board Certified',
    'International Aesthetic Training',
    'Advanced Cosmetology Certification'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'author', 'Maria Shikongo',
      'rating', 5,
      'text', 'Dr. Polina transformed my skin! After struggling with acne for years, her treatment plan gave me the clear, glowing skin I''ve always wanted.',
      'date', '2024-11-15'
    )
  )
)
ON CONFLICT (slug) 
DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  services = EXCLUDED.services,
  about_text = EXCLUDED.about_text,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  features = EXCLUDED.features,
  certifications = EXCLUDED.certifications,
  testimonials = EXCLUDED.testimonials,
  updated_at = NOW();