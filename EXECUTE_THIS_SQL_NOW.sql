-- 🚀 EXECUTE THIS IMMEDIATELY - NewCharm Setup
-- Copy this entire block and paste in Supabase SQL Editor

-- Temporarily disable RLS for setup
ALTER TABLE practices DISABLE ROW LEVEL SECURITY;

-- Insert NewCharm Dental Practice
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
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
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
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
  'At NewCharm Dental Practice, we believe that everyone deserves a healthy, beautiful smile. Our state-of-the-art facility in the heart of Windhoek combines cutting-edge dental technology with compassionate, personalized care.',
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
  '{
    "before_after_gallery": [
      {
        "id": "1",
        "before": "https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "after": "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "title": "Complete Smile Makeover",
        "treatment": "Veneers & Teeth Whitening",
        "duration": "3 weeks"
      },
      {
        "id": "2",
        "before": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "after": "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "title": "Orthodontic Transformation",
        "treatment": "Clear Aligners",
        "duration": "12 months"
      },
      {
        "id": "3",
        "before": "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "after": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "title": "Full Dental Restoration",
        "treatment": "Implants & Crowns",
        "duration": "6 months"
      },
      {
        "id": "4",
        "before": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "after": "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "title": "Professional Teeth Whitening",
        "treatment": "Zoom Whitening",
        "duration": "1 hour"
      },
      {
        "id": "5",
        "before": "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "after": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
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

-- Re-enable RLS after setup
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-images',
  'practice-images', 
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '🦷 NewCharm Dental Practice is LIVE!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Complete Setup Includes:';
  RAISE NOTICE '   • Professional dental branding (teal theme)';
  RAISE NOTICE '   • 6 comprehensive service categories';
  RAISE NOTICE '   • 5 patient testimonials';
  RAISE NOTICE '   • 5 before/after transformations';
  RAISE NOTICE '   • Premium photo gallery';
  RAISE NOTICE '   • Storage bucket for your images';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Test NewCharm at:';
  RAISE NOTICE '   • http://localhost:3000?practice=newcharm-dental';
  RAISE NOTICE '   • http://localhost:3000 (with env var set)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NewCharm is ready for patients!';
END $$;