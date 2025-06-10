-- Medical Aid Reference and Logo Setup Script
-- This script adds the medical_aid_reference column and updates providers with reference codes and logo URLs

-- Step 1: Add medical_aid_reference column if it doesn't exist
ALTER TABLE medical_aid_providers 
ADD COLUMN IF NOT EXISTS medical_aid_reference VARCHAR(10);

-- Step 2: Update each provider with reference code and logo URL
-- MAG1 - Gemhealth
UPDATE medical_aid_providers 
SET 
  medical_aid_reference = 'MAG1',
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/MAG1.png'
WHERE name ILIKE '%Gemhealth%';

-- NAMM - Nammed
UPDATE medical_aid_providers 
SET 
  medical_aid_reference = 'NAMM',
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NAMM.png'
WHERE name ILIKE '%Nammed%';

-- NHPM - Namibia Health Plan
UPDATE medical_aid_providers 
SET 
  medical_aid_reference = 'NHPM',
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NHPM.png'
WHERE name ILIKE '%Namibia Health Plan%';

-- NMC1 - Namibia Medical Care
UPDATE medical_aid_providers 
SET 
  medical_aid_reference = 'NMC1',
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NMC1.png'
WHERE name ILIKE '%Namibia Medical Care%';

-- PROS - Renaissance
UPDATE medical_aid_providers 
SET 
  medical_aid_reference = 'PROS',
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/PROS.png'
WHERE name ILIKE '%Renaissance%';

-- Verification query
SELECT 
  name, 
  medical_aid_reference, 
  logo_url 
FROM medical_aid_providers 
WHERE medical_aid_reference IS NOT NULL
ORDER BY name;