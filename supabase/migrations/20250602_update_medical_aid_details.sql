-- Add provider_id and scheme_id columns to medical_aid_details table
ALTER TABLE medical_aid_details 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES medical_aid_providers(id),
ADD COLUMN IF NOT EXISTS scheme_id UUID REFERENCES medical_aid_schemes(id),
ADD COLUMN IF NOT EXISTS scheme_name TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_provider_id ON medical_aid_details(provider_id);
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_scheme_id ON medical_aid_details(scheme_id);

-- Update existing records to use scheme_name instead of scheme
UPDATE medical_aid_details SET scheme_name = scheme WHERE scheme_name IS NULL;