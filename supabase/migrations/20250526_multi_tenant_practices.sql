-- Create practices table for multi-tenant support
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

-- Add practice_id to existing tables
ALTER TABLE patients ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);
ALTER TABLE lab_requests ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);
ALTER TABLE media_requests ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_practice ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_appointments_practice ON appointments(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_practice ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_practice ON visits(practice_id);

-- Create practice_staff junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS practice_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practice_id, user_id)
);

-- Insert two test practices
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

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for practices table
CREATE TRIGGER update_practices_updated_at BEFORE UPDATE ON practices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some test data associations (optional)
-- This will associate the first practice with some existing data
UPDATE patients SET practice_id = (SELECT id FROM practices WHERE slug = 'cityclinic') WHERE id IN (SELECT id FROM patients LIMIT 3);
UPDATE appointments SET practice_id = (SELECT id FROM practices WHERE slug = 'cityclinic') WHERE id IN (SELECT id FROM appointments LIMIT 3);

-- Associate remaining data with the second practice
UPDATE patients SET practice_id = (SELECT id FROM practices WHERE slug = 'coastalmed') WHERE practice_id IS NULL;
UPDATE appointments SET practice_id = (SELECT id FROM practices WHERE slug = 'coastalmed') WHERE practice_id IS NULL;