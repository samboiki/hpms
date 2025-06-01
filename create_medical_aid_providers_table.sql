-- Create medical aid providers table with schemes and services
CREATE TABLE IF NOT EXISTS medical_aid_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  logo_url TEXT,
  contact_number TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create medical aid schemes table
CREATE TABLE IF NOT EXISTS medical_aid_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES medical_aid_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  hospital_cover_percentage DECIMAL(5,2),
  specialist_cover_percentage DECIMAL(5,2),
  gp_cover_percentage DECIMAL(5,2),
  medication_annual_limit DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create medical aid services and prices table
CREATE TABLE IF NOT EXISTS medical_aid_service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES medical_aid_providers(id) ON DELETE CASCADE,
  scheme_id UUID REFERENCES medical_aid_schemes(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_code TEXT,
  category TEXT, -- consultation, procedure, medication, lab_test, imaging
  base_price DECIMAL(10,2),
  covered_amount DECIMAL(10,2),
  patient_copay_percentage DECIMAL(5,2),
  requires_preauth BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert Namibian medical aid providers
INSERT INTO medical_aid_providers (name, short_name, contact_number, email, website, address) VALUES
('Namibia Medical Care', 'NMC', '+264 61 285 5400', 'info@nmc.com.na', 'www.nmc.com.na', 'Windhoek, Namibia'),
('Namibia Health Plan', 'NHP', '+264 61 285 5600', 'info@nhp.com.na', 'www.nhp.com.na', 'Windhoek, Namibia'),
('Nammed Medical Aid Fund', 'Nammed', '+264 61 270 9300', 'info@nammed.com.na', 'www.nammed.com.na', 'Windhoek, Namibia'),
('Gemhealth Medical Aid', 'Gemhealth', '+264 61 270 4700', 'info@gemhealth.com.na', 'www.gemhealth.com.na', 'Windhoek, Namibia'),
('Renaissance Health Medical Aid Fund', 'Renaissance', '+264 61 287 5400', 'info@renaissance.com.na', 'www.renaissancehealth.com.na', 'Windhoek, Namibia'),
('Napotel Medical Aid', 'Napotel', '+264 61 309 3000', 'info@napotel.com.na', 'www.napotel.com.na', 'Windhoek, Namibia'),
('Bankmed Namibia', 'Bankmed', '+264 61 299 1300', 'info@bankmed.com.na', 'www.bankmed.com.na', 'Windhoek, Namibia'),
('Methealth Namibia', 'Methealth', '+264 61 222 3300', 'info@methealth.com.na', 'www.methealth.com.na', 'Windhoek, Namibia');

-- Insert schemes for each provider
-- NMC Schemes
INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Diamond', 'Premium comprehensive cover', 100, 100, 100, 50000
FROM medical_aid_providers WHERE short_name = 'NMC';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Platinum', 'High-level comprehensive cover', 100, 90, 100, 40000
FROM medical_aid_providers WHERE short_name = 'NMC';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Gold', 'Standard comprehensive cover', 100, 80, 90, 30000
FROM medical_aid_providers WHERE short_name = 'NMC';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Silver', 'Essential cover', 100, 70, 80, 20000
FROM medical_aid_providers WHERE short_name = 'NMC';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Bronze', 'Basic hospital cover', 100, 60, 70, 15000
FROM medical_aid_providers WHERE short_name = 'NMC';

-- NHP Schemes
INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Executive', 'Executive comprehensive cover', 100, 100, 100, 60000
FROM medical_aid_providers WHERE short_name = 'NHP';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Comprehensive', 'Full medical cover', 100, 90, 100, 45000
FROM medical_aid_providers WHERE short_name = 'NHP';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Standard', 'Standard medical cover', 100, 80, 90, 30000
FROM medical_aid_providers WHERE short_name = 'NHP';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Essential', 'Essential medical cover', 100, 70, 80, 20000
FROM medical_aid_providers WHERE short_name = 'NHP';

-- Insert common medical services and pricing
-- GP Consultations
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage)
SELECT p.id, s.id, 'GP Consultation', 'GP001', 'consultation', 850.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 850.00
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 765.00
    WHEN s.name IN ('Gold', 'Standard') THEN 680.00
    ELSE 595.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 10
    WHEN s.name IN ('Gold', 'Standard') THEN 20
    ELSE 30
  END
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- Specialist Consultations
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage)
SELECT p.id, s.id, 'Specialist Consultation', 'SP001', 'consultation', 1500.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 1500.00
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 1350.00
    WHEN s.name IN ('Gold', 'Standard') THEN 1200.00
    ELSE 1050.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 10
    WHEN s.name IN ('Gold', 'Standard') THEN 20
    ELSE 30
  END
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- Blood Tests
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage)
SELECT p.id, s.id, 'Full Blood Count', 'LAB001', 'lab_test', 350.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive', 'Platinum', 'Comprehensive') THEN 350.00
    WHEN s.name IN ('Gold', 'Standard') THEN 315.00
    ELSE 280.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    ELSE 10
  END
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- X-Ray
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage, requires_preauth)
SELECT p.id, s.id, 'Chest X-Ray', 'IMG001', 'imaging', 650.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive', 'Platinum', 'Comprehensive') THEN 650.00
    WHEN s.name IN ('Gold', 'Standard') THEN 585.00
    ELSE 520.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 10
    ELSE 20
  END,
  false
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- CT Scan (requires pre-authorization)
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage, requires_preauth)
SELECT p.id, s.id, 'CT Scan - Head', 'IMG005', 'imaging', 8500.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 8500.00
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 7650.00
    WHEN s.name IN ('Gold', 'Standard') THEN 6800.00
    ELSE 5950.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 10
    WHEN s.name IN ('Gold', 'Standard') THEN 20
    ELSE 30
  END,
  true
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- Common Procedures
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage)
SELECT p.id, s.id, 'Minor Surgery - Suturing', 'PRO001', 'procedure', 2500.00, 
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 2500.00
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 2250.00
    WHEN s.name IN ('Gold', 'Standard') THEN 2000.00
    ELSE 1750.00
  END,
  CASE 
    WHEN s.name IN ('Diamond', 'Executive') THEN 0
    WHEN s.name IN ('Platinum', 'Comprehensive') THEN 10
    ELSE 20
  END
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- Create indexes for performance
CREATE INDEX idx_schemes_provider ON medical_aid_schemes(provider_id);
CREATE INDEX idx_prices_provider ON medical_aid_service_prices(provider_id);
CREATE INDEX idx_prices_scheme ON medical_aid_service_prices(scheme_id);
CREATE INDEX idx_prices_service ON medical_aid_service_prices(service_name);

-- Add RLS policies
ALTER TABLE medical_aid_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_service_prices ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "read_providers" ON medical_aid_providers FOR SELECT USING (true);
CREATE POLICY "read_schemes" ON medical_aid_schemes FOR SELECT USING (true);
CREATE POLICY "read_prices" ON medical_aid_service_prices FOR SELECT USING (true);