-- Execute this SQL directly in the Supabase SQL Editor
-- Copy and paste this entire script into the Supabase Dashboard > SQL Editor

-- Step 1: Create storage bucket for medical aid logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
  'medical-aid-logos',
  'medical-aid-logos', 
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = NOW();

-- Step 2: Create storage policies for the medical-aid-logos bucket
-- Allow public access to view logos
CREATE POLICY IF NOT EXISTS "Public can view medical aid logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'medical-aid-logos');

-- Allow authenticated users to upload logos (for admin use)
CREATE POLICY IF NOT EXISTS "Authenticated can upload medical aid logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'medical-aid-logos' AND auth.role() = 'authenticated');

-- Allow authenticated users to update logos
CREATE POLICY IF NOT EXISTS "Authenticated can update medical aid logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'medical-aid-logos' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete logos
CREATE POLICY IF NOT EXISTS "Authenticated can delete medical aid logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'medical-aid-logos' AND auth.role() = 'authenticated');

-- Step 3: Update medical_aid_providers table with logo URLs
-- Map provider short names to their respective logo files in Supabase storage

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/nmc-logo.png',
  updated_at = NOW()
WHERE short_name = 'NMC' OR name ILIKE '%namibia medical care%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/nhp-logo.png',
  updated_at = NOW()
WHERE short_name = 'NHP' OR name ILIKE '%namibia health plan%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/nammed-logo.png',
  updated_at = NOW()
WHERE short_name = 'NAMMED' OR name ILIKE '%nammed%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/gemhealth-logo.png',
  updated_at = NOW()
WHERE short_name = 'GEMHEALTH' OR name ILIKE '%gemhealth%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/bonitas-logo.png',
  updated_at = NOW()
WHERE short_name = 'BONITAS' OR name ILIKE '%bonitas%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/discovery-logo.png',
  updated_at = NOW()
WHERE short_name = 'DISCOVERY' OR name ILIKE '%discovery%';

UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/old-mutual-logo.png',
  updated_at = NOW()
WHERE short_name = 'OLD_MUTUAL' OR name ILIKE '%old mutual%';

-- Step 4: Set default logo for any providers without specific logos
UPDATE medical_aid_providers 
SET 
  logo_url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/default-medical-aid.svg',
  updated_at = NOW()
WHERE logo_url IS NULL OR logo_url = '' OR logo_url = '/images/medical-aids/default-medical-aid.svg';

-- Step 5: Verify the results
SELECT 
  id,
  name,
  short_name,
  logo_url,
  updated_at
FROM medical_aid_providers 
ORDER BY name;

-- Step 6: Create a function to get medical aid logo URL by provider name (for frontend use)
CREATE OR REPLACE FUNCTION get_medical_aid_logo(provider_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      logo_url, 
      'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/default-medical-aid.svg'
    )
    FROM medical_aid_providers 
    WHERE name ILIKE '%' || provider_name || '%' 
       OR short_name ILIKE '%' || provider_name || '%'
    LIMIT 1
  );
END;
$$;

-- Test the function
SELECT 
  'Discovery' as provider,
  get_medical_aid_logo('Discovery') as logo_url
UNION ALL
SELECT 
  'NMC' as provider,
  get_medical_aid_logo('NMC') as logo_url
UNION ALL
SELECT 
  'Unknown Provider' as provider,
  get_medical_aid_logo('Unknown Provider') as logo_url;

-- Success message
SELECT 'Medical aid bucket and provider logos setup completed successfully!' as status;