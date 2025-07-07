-- Add NewCharm Dental Practice to the database
-- This creates a modern dental practice with comprehensive services

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
  'newcharm-dental',
  'NewCharm Dental Practice',
  'newcharm.vercel.app',
  '/images/newcharm/newcharm-logo.png',
  '#00BCD4', -- Modern teal for dental trust
  '#0097A7', -- Darker teal for accents
  'info@newcharmdental.na',
  '+264 61 234 567',
  '123 Independence Avenue',
  'Windhoek',
  'Namibia',
  '10001',
  '{
    "monday": {"open": "08:00", "close": "17:00"},
    "tuesday": {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday": {"open": "08:00", "close": "16:00"},
    "saturday": {"open": "09:00", "close": "13:00"},
    "sunday": {"closed": true}
  }',
  '{
    "online_booking": true,
    "telemedicine": true,
    "lab_results": false,
    "online_payments": true,
    "emergency_care": true,
    "digital_xrays": true,
    "laser_dentistry": true
  }',
  '{
    "appointment_duration": 60,
    "advance_booking_days": 30,
    "cancellation_hours": 24,
    "payment_methods": ["cash", "card", "medical_aid"],
    "languages": ["English", "Afrikaans", "German"],
    "specializations": ["General Dentistry", "Cosmetic Dentistry", "Orthodontics", "Oral Surgery"],
    "insurance_accepted": ["Discovery", "Old Mutual", "Bonitas", "Momentum"]
  }',
  'Your Smile, Our Passion',
  'Modern dental care with a personal touch. Experience comfort, quality, and the latest in dental technology at NewCharm Dental Practice.',
  '/images/newcharm/hero-dental-clinic.jpg',
  'At NewCharm Dental Practice, we believe that everyone deserves a healthy, beautiful smile. Our state-of-the-art facility in the heart of Windhoek combines cutting-edge dental technology with compassionate, personalized care. 

Our experienced team of dental professionals is committed to providing comprehensive oral healthcare for patients of all ages. From routine cleanings and preventive care to advanced cosmetic and restorative procedures, we offer a full range of dental services under one roof.

We understand that visiting the dentist can be anxiety-provoking for some patients. That''s why we''ve created a warm, welcoming environment where comfort is our priority. Our modern treatment rooms are equipped with the latest technology, including digital X-rays and laser dentistry, ensuring precise diagnoses and minimally invasive treatments.

Whether you need a routine checkup, cosmetic enhancement, or emergency care, NewCharm Dental Practice is here to help you achieve optimal oral health and the confident smile you deserve.',
  '[
    {
      "id": "general-dentistry",
      "name": "General Dentistry",
      "description": "Comprehensive dental care for your entire family",
      "icon": "Shield"
    },
    {
      "id": "cosmetic-dentistry", 
      "name": "Cosmetic Dentistry",
      "description": "Enhance your smile with our advanced cosmetic procedures",
      "icon": "Sparkles"
    },
    {
      "id": "orthodontics",
      "name": "Orthodontics", 
      "description": "Straighten your teeth with modern orthodontic solutions",
      "icon": "Smile"
    },
    {
      "id": "oral-surgery",
      "name": "Oral Surgery",
      "description": "Specialized surgical procedures for complex dental needs", 
      "icon": "Activity"
    },
    {
      "id": "emergency-care",
      "name": "Emergency Dental Care",
      "description": "Immediate dental care when you need it most",
      "icon": "AlertTriangle"
    },
    {
      "id": "preventive-care",
      "name": "Preventive Care",
      "description": "Proactive care to maintain optimal oral health",
      "icon": "Heart"
    }
  ]',
  '{
    "facebook": "https://facebook.com/newcharmdental",
    "instagram": "https://instagram.com/newcharmdental", 
    "twitter": "https://twitter.com/newcharmdental",
    "linkedin": "https://linkedin.com/company/newcharm-dental"
  }',
  NOW(),
  NOW()
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  updated_at = NOW();

-- Create sample testimonials for NewCharm
INSERT INTO testimonials (
  id,
  practice_id,
  name,
  content,
  rating,
  treatment_type,
  image_url,
  created_at
) VALUES 
(
  gen_random_uuid(),
  (SELECT id FROM practices WHERE slug = 'newcharm-dental'),
  'Sarah Williams',
  'I had my teeth whitened at NewCharm and the results were amazing! The staff was so professional and made me feel comfortable throughout the entire process. My smile has never looked better!',
  5,
  'Teeth Whitening',
  '/images/newcharm/testimonial-sarah.jpg',
  NOW()
),
(
  gen_random_uuid(),
  (SELECT id FROM practices WHERE slug = 'newcharm-dental'),
  'Michael Johnson',
  'Dr. Smith and the team at NewCharm saved my tooth with an excellent root canal treatment. What I expected to be painful was actually quite comfortable. Their technology and skill are impressive.',
  5,
  'Root Canal Treatment',
  '/images/newcharm/testimonial-michael.jpg', 
  NOW()
),
(
  gen_random_uuid(),
  (SELECT id FROM practices WHERE slug = 'newcharm-dental'),
  'Emma van der Merwe',
  'My daughter got her braces at NewCharm and we couldn''t be happier with the results. The orthodontist explained everything clearly and the staff was wonderful with kids. Highly recommended!',
  5,
  'Orthodontics',
  '/images/newcharm/testimonial-emma.jpg',
  NOW()
),
(
  gen_random_uuid(),
  (SELECT id FROM practices WHERE slug = 'newcharm-dental'),
  'David Nakamhela',
  'I had a dental emergency on a Saturday and NewCharm fit me in immediately. They relieved my pain and fixed my broken tooth beautifully. Their emergency care is exceptional.',
  5,
  'Emergency Care',
  '/images/newcharm/testimonial-david.jpg',
  NOW()
),
(
  gen_random_uuid(),
  (SELECT id FROM practices WHERE slug = 'newcharm-dental'),
  'Lisa Thompson',
  'The complete smile makeover I received at NewCharm has changed my life. I finally have the confidence to smile freely. The results exceeded all my expectations!',
  5,
  'Smile Makeover',
  '/images/newcharm/testimonial-lisa.jpg',
  NOW()
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ NewCharm Dental Practice successfully added to database!';
  RAISE NOTICE '';
  RAISE NOTICE '🦷 Practice Details:';
  RAISE NOTICE '   • Name: NewCharm Dental Practice';
  RAISE NOTICE '   • Domain: newcharm.vercel.app';
  RAISE NOTICE '   • Location: Windhoek, Namibia';
  RAISE NOTICE '   • Services: 6 comprehensive dental categories';
  RAISE NOTICE '   • Testimonials: 5 patient reviews added';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Next Steps:';
  RAISE NOTICE '   1. Update domain mapping in tenants.ts';
  RAISE NOTICE '   2. Add NewCharm images to /public/images/newcharm/';
  RAISE NOTICE '   3. Deploy to Vercel with custom domain';
  RAISE NOTICE '   4. Test the landing page';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for deployment!';
END $$;