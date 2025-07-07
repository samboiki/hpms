-- ✅ NewCharm Dental Practice - Complete Setup with Local Images
-- Replace the placeholder URLs with your actual Supabase Storage URLs after uploading

-- Step 1: Add testimonials column if it doesn't exist
ALTER TABLE practices ADD COLUMN IF NOT EXISTS testimonials JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add metadata column if it doesn't exist
ALTER TABLE practices ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Step 3: Insert/Update NewCharm Dental Practice
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
  testimonials,
  social_links,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'newcharm-dental',
  'NewCharm Dental Practice',
  'newcharm.vercel.app',
  -- REPLACE WITH YOUR LOGO URL FROM SUPABASE STORAGE
  'REPLACE_WITH_LOGO_URL', -- Upload logo.png from c:/Users/Happyou2/Documents/mxhealth/newcharm/
  '#00BCD4',
  '#0097A7',
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
  -- Premium dental banner from Unsplash
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
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
  '[
    {
      "author": "Sarah Williams",
      "rating": 5,
      "text": "I had my teeth whitened at NewCharm and the results were amazing! The staff was so professional and made me feel comfortable throughout the entire process. My smile has never looked better!",
      "date": "2024-12-01",
      "treatment": "Teeth Whitening"
    },
    {
      "author": "Michael Johnson",
      "rating": 5,
      "text": "Dr. Smith and the team at NewCharm saved my tooth with an excellent root canal treatment. What I expected to be painful was actually quite comfortable. Their technology and skill are impressive.",
      "date": "2024-11-28",
      "treatment": "Root Canal Treatment"
    },
    {
      "author": "Emma van der Merwe",
      "rating": 5,
      "text": "My daughter got her braces at NewCharm and we could not be happier with the results. The orthodontist explained everything clearly and the staff was wonderful with kids. Highly recommended!",
      "date": "2024-11-25",
      "treatment": "Orthodontics"
    },
    {
      "author": "David Nakamhela",
      "rating": 5,
      "text": "I had a dental emergency on a Saturday and NewCharm fit me in immediately. They relieved my pain and fixed my broken tooth beautifully. Their emergency care is exceptional.",
      "date": "2024-11-20",
      "treatment": "Emergency Care"
    },
    {
      "author": "Lisa Thompson",
      "rating": 5,
      "text": "The complete smile makeover I received at NewCharm has changed my life. I finally have the confidence to smile freely. The results exceeded all my expectations!",
      "date": "2024-11-15",
      "treatment": "Smile Makeover"
    }
  ]',
  '{
    "facebook": "https://facebook.com/newcharmdental",
    "instagram": "https://instagram.com/newcharmdental", 
    "twitter": "https://twitter.com/newcharmdental",
    "linkedin": "https://linkedin.com/company/newcharm-dental"
  }',
  -- Metadata with before/after gallery - REPLACE URLs after uploading to Supabase Storage
  '{
    "before_after_gallery": [
      {
        "id": "1",
        "before": "REPLACE_WITH_BEFORE1_URL",
        "after": "REPLACE_WITH_AFTER1_URL",
        "title": "Complete Smile Makeover",
        "treatment": "Veneers & Teeth Whitening",
        "duration": "3 weeks"
      },
      {
        "id": "2",
        "before": "REPLACE_WITH_BEFORE2_URL",
        "after": "REPLACE_WITH_AFTER2_URL",
        "title": "Orthodontic Transformation",
        "treatment": "Clear Aligners",
        "duration": "12 months"
      },
      {
        "id": "3",
        "before": "REPLACE_WITH_BEFORE3_URL",
        "after": "REPLACE_WITH_AFTER3_URL",
        "title": "Full Dental Restoration",
        "treatment": "Implants & Crowns",
        "duration": "6 months"
      },
      {
        "id": "4",
        "before": "REPLACE_WITH_BEFORE4_URL",
        "after": "REPLACE_WITH_AFTER4_URL",
        "title": "Professional Teeth Whitening",
        "treatment": "Zoom Whitening",
        "duration": "1 hour"
      },
      {
        "id": "5",
        "before": "REPLACE_WITH_BEFORE5_URL",
        "after": "REPLACE_WITH_AFTER5_URL",
        "title": "Gum Health Restoration",
        "treatment": "Periodontal Treatment",
        "duration": "4 months"
      }
    ],
    "gallery_images": [
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
    ],
    "certifications": [
      "American Dental Association Member",
      "Namibian Dental Association Certified",
      "International Congress of Oral Implantologists"
    ],
    "awards": [
      "Best Dental Practice Windhoek 2023",
      "Excellence in Patient Care Award 2022",
      "Top Cosmetic Dentistry Provider 2021"
    ]
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  logo_url = EXCLUDED.logo_url,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  hero_image_url = EXCLUDED.hero_image_url,
  testimonials = EXCLUDED.testimonials,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ NewCharm Dental Practice setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Replace these placeholders with your actual URLs:';
  RAISE NOTICE '   • REPLACE_WITH_LOGO_URL - Upload logo.png';
  RAISE NOTICE '   • REPLACE_WITH_BEFORE1_URL - Upload before1.jpg';
  RAISE NOTICE '   • REPLACE_WITH_AFTER1_URL - Upload after1.jpg';
  RAISE NOTICE '   • (Continue for all before/after pairs...)';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Upload images to Supabase Storage:';
  RAISE NOTICE '   1. Go to Storage → practice-images bucket';
  RAISE NOTICE '   2. Create folder: newcharm/';
  RAISE NOTICE '   3. Upload all images from your local folder';
  RAISE NOTICE '   4. Get public URLs and update this SQL';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NewCharm is ready once images are uploaded!';
END $$;