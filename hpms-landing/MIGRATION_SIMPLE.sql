-- HPMS Multi-Tenant Migration
-- Run this in Supabase SQL Editor

-- 1. Create practices table
CREATE TABLE IF NOT EXISTS practices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#01b9d5',
  secondary_color VARCHAR(7) DEFAULT '#0196be',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Namibia',
  postal_code VARCHAR(20),
  business_hours JSONB DEFAULT '{
    "monday": {"open": "08:00", "close": "17:00"},
    "tuesday": {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday": {"open": "08:00", "close": "17:00"},
    "saturday": {"open": "08:00", "close": "13:00"},
    "sunday": {"closed": true}
  }'::jsonb,
  features JSONB DEFAULT '{
    "online_booking": true,
    "telemedicine": false,
    "lab_results": true,
    "online_payments": true
  }'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  about_text TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert test practices
INSERT INTO practices (slug, name, domain, contact_email, contact_phone, address, city, hero_title, hero_subtitle, about_text, services) VALUES
(
  'cityclinic',
  'City Clinic Windhoek',
  'cityclinic.vercel.app',
  'info@cityclinic.com',
  '+264 61 123 4567',
  '123 Independence Avenue',
  'Windhoek',
  'Your Health, Our Priority',
  'Modern healthcare facility in the heart of Windhoek',
  'City Clinic has been serving the Windhoek community for over 20 years. We pride ourselves on providing comprehensive healthcare services with a personal touch.',
  '[
    {"id": "1", "name": "General Consultation", "description": "Comprehensive health checkups and consultations", "icon": "stethoscope"},
    {"id": "2", "name": "Laboratory Services", "description": "Full range of diagnostic tests", "icon": "microscope"},
    {"id": "3", "name": "Pediatric Care", "description": "Specialized care for children", "icon": "baby"},
    {"id": "4", "name": "Emergency Services", "description": "24/7 emergency medical care", "icon": "ambulance"}
  ]'::jsonb
),
(
  'coastalmed',
  'Coastal Medical Center',
  'coastalmed.vercel.app',
  'hello@coastalmed.com',
  '+264 64 987 6543',
  '45 Beach Road',
  'Swakopmund',
  'Excellence in Healthcare by the Sea',
  'Where compassionate care meets medical excellence',
  'Coastal Medical Center is Swakopmund''s premier healthcare facility, offering state-of-the-art medical services in a serene coastal setting.',
  '[
    {"id": "1", "name": "Family Medicine", "description": "Comprehensive care for the whole family", "icon": "users"},
    {"id": "2", "name": "Specialist Consultations", "description": "Access to various medical specialists", "icon": "user-md"},
    {"id": "3", "name": "Wellness Programs", "description": "Preventive health and wellness services", "icon": "heart"},
    {"id": "4", "name": "Travel Medicine", "description": "Vaccinations and travel health advice", "icon": "plane"}
  ]'::jsonb
);

-- 3. Verify it worked
SELECT name, domain, city FROM practices;