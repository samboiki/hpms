-- Update logo URLs for medical aid providers based on available logo files
-- This SQL should be executed in Supabase dashboard or via migrations

-- Update providers with available logo files
UPDATE medical_aid_providers 
SET logo_url = '/images/medical-aids/nmc-logo.png'
WHERE short_name = 'NMC';

UPDATE medical_aid_providers 
SET logo_url = '/images/medical-aids/nhp-logo.png'
WHERE short_name = 'NHP';

UPDATE medical_aid_providers 
SET logo_url = '/images/medical-aids/nammed-logo.png'
WHERE short_name = 'Nammed';

UPDATE medical_aid_providers 
SET logo_url = '/images/medical-aids/gemhealth-logo.png'
WHERE short_name = 'Gemhealth';

-- Set default fallback logo for providers without specific logos
UPDATE medical_aid_providers 
SET logo_url = '/images/medical-aids/default-medical-aid.svg'
WHERE short_name IN ('Renaissance', 'Napotel', 'Bankmed', 'Methealth');

-- Verify the updates
SELECT short_name, name, logo_url 
FROM medical_aid_providers 
ORDER BY short_name;