-- Add medical_aid_reference column to medical_aid_providers table
-- Execute this SQL in your Supabase Dashboard

-- Step 1: Add the medical_aid_reference column
ALTER TABLE medical_aid_providers 
ADD COLUMN IF NOT EXISTS medical_aid_reference TEXT;

-- Step 2: Update existing providers with reference codes
-- Based on the logo files available: MAG1.png, NAMM.png, NHPM.png, NMC1.png, PROS.png

UPDATE medical_aid_providers 
SET medical_aid_reference = 'NMC1' 
WHERE name = 'Namibia Medical Care';

UPDATE medical_aid_providers 
SET medical_aid_reference = 'NHPM' 
WHERE name = 'Namibia Health Plan';

UPDATE medical_aid_providers 
SET medical_aid_reference = 'NAMM' 
WHERE name = 'Nammed Medical Aid Fund';

UPDATE medical_aid_providers 
SET medical_aid_reference = 'MAG1' 
WHERE name = 'Gemhealth Medical Aid';

UPDATE medical_aid_providers 
SET medical_aid_reference = 'PROS' 
WHERE name = 'Renaissance Health Medical Aid Fund';

-- Step 3: Update logo URLs to use the correct path
-- Note: Using '/medical aids/' path since that's where the PNG files are located

UPDATE medical_aid_providers 
SET logo_url = '/medical aids/' || medical_aid_reference || '.png' 
WHERE medical_aid_reference IS NOT NULL;

-- Step 4: Verify the results
SELECT 
    id, 
    name, 
    short_name,
    medical_aid_reference, 
    logo_url 
FROM medical_aid_providers 
WHERE medical_aid_reference IS NOT NULL
ORDER BY medical_aid_reference;

-- Expected results:
-- Gemhealth Medical Aid    | MAG1 | /medical aids/MAG1.png
-- Nammed Medical Aid Fund  | NAMM | /medical aids/NAMM.png  
-- Namibia Health Plan      | NHPM | /medical aids/NHPM.png
-- Namibia Medical Care     | NMC1 | /medical aids/NMC1.png
-- Renaissance Health...    | PROS | /medical aids/PROS.png