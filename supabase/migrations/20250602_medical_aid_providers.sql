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

-- Insert schemes for NMC
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

-- Insert schemes for NHP
INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Executive', 'Executive comprehensive cover', 100, 100, 100, 60000
FROM medical_aid_providers WHERE short_name = 'NHP';

INSERT INTO medical_aid_schemes (provider_id, name, description, hospital_cover_percentage, specialist_cover_percentage, gp_cover_percentage, medication_annual_limit)
SELECT id, 'Comprehensive', 'Full medical cover', 100, 90, 100, 45000
FROM medical_aid_providers WHERE short_name = 'NHP';

-- Insert common services
INSERT INTO medical_aid_service_prices (provider_id, scheme_id, service_name, service_code, category, base_price, covered_amount, patient_copay_percentage)
SELECT p.id, s.id, 'GP Consultation', 'GP001', 'consultation', 850.00, 
  CASE WHEN s.name IN ('Diamond', 'Executive') THEN 850.00 ELSE 680.00 END,
  CASE WHEN s.name IN ('Diamond', 'Executive') THEN 0 ELSE 20 END
FROM medical_aid_providers p
JOIN medical_aid_schemes s ON s.provider_id = p.id
WHERE p.short_name IN ('NMC', 'NHP');

-- Create indexes
CREATE INDEX idx_schemes_provider ON medical_aid_schemes(provider_id);
CREATE INDEX idx_prices_provider ON medical_aid_service_prices(provider_id);
CREATE INDEX idx_prices_scheme ON medical_aid_service_prices(scheme_id);

-- Enable RLS
ALTER TABLE medical_aid_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_service_prices ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "read_providers" ON medical_aid_providers FOR SELECT USING (true);
CREATE POLICY "read_schemes" ON medical_aid_schemes FOR SELECT USING (true);
CREATE POLICY "read_prices" ON medical_aid_service_prices FOR SELECT USING (true);