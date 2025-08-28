-- Add Farmaris practice
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
) VALUES (
  gen_random_uuid(),
  'farmaris',
  'Aris Farm',
  'farmaris.vercel.app',
  '/images/farmaris-logo.png',
  '#4CAF50', -- Green primary color (farm theme)
  '#FFC107', -- Yellow secondary (harvest/sun theme)
  'hello@arisfarm.na',
  '+264 81 123 4567',
  'Aris Farm, Windhoek District',
  'Windhoek',
  'Namibia',
  '10000',
  jsonb_build_object(
    'monday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'tuesday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'wednesday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'thursday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'friday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'saturday', jsonb_build_object('open', '10:00', 'close', '18:00'),
    'sunday', jsonb_build_object('open', '12:00', 'close', '16:00')
  ),
  jsonb_build_object(
    'online_booking', true,
    'telemedicine', false,
    'lab_results', false,
    'online_payments', false
  ),
  jsonb_build_object(
    'theme', 'farm-event',
    'show_testimonials', false,
    'show_gallery', true,
    'show_team', false,
    'booking_enabled', true,
    'event_date', '2025-03-15T10:00:00',
    'event_type', 'grand_opening',
    'registration_enabled', true
  ),
  'Grand Opening of Aris Farm',
  'Growing Together in Namibia''s Heart - March 15, 2025',
  'https://images.pexels.com/photos/974314/pexels-photo-974314.jpeg',
  'Join us for a celebration of growth, community, and the rich agricultural heritage of Namibia. The Aris family invites you to witness the culmination of years of dedication and hard work as we officially open our farm to the community.',
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Farm Tours',
      'description', 'Guided walks through our sustainable farming operations',
      'icon', 'solar:leaf-bold-duotone',
      'price', 'Free'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Traditional Braai',
      'description', 'Authentic Namibian BBQ with local specialties',
      'icon', 'solar:fire-bold-duotone',
      'price', 'Included'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Cultural Performances',
      'description', 'Traditional music and dance performances',
      'icon', 'solar:music-note-2-bold-duotone',
      'price', 'Free'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Children Activities',
      'description', 'Farm animal encounters and games',
      'icon', 'solar:users-group-two-rounded-bold-duotone',
      'price', 'Free'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Opening Ceremony',
      'description', 'Welcome speeches and blessing of the farm',
      'icon', 'solar:cup-star-bold-duotone',
      'price', 'Free'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Community Celebration',
      'description', 'Music, dancing, and fellowship',
      'icon', 'solar:confetti-bold-duotone',
      'price', 'Free'
    )
  ),
  jsonb_build_object(
    'facebook', 'https://facebook.com/arisfarm',
    'instagram', 'https://instagram.com/arisfarm',
    'whatsapp', '+26481234567'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  hero_image_url = EXCLUDED.hero_image_url,
  about_text = EXCLUDED.about_text,
  services = EXCLUDED.services,
  business_hours = EXCLUDED.business_hours,
  features = EXCLUDED.features,
  settings = EXCLUDED.settings,
  social_links = EXCLUDED.social_links,
  updated_at = NOW();