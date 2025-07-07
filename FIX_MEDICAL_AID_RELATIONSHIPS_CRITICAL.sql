-- ============================================
-- CRITICAL FIX: Medical Aid Foreign Key Relationships
-- This fixes the 400 error in patient registration
-- Status: EMERGENCY DATABASE STRUCTURE FIX
-- ============================================

-- STEP 1: Add the foreign key column to medical_aid_details
ALTER TABLE public.medical_aid_details
ADD COLUMN IF NOT EXISTS medical_aid_provider_id UUID;

-- STEP 2: Ensure medical_aid_providers table has proper data with IDs
-- First, let's make sure we have the providers with proper IDs
INSERT INTO public.medical_aid_providers (id, name, provider_code, is_active) VALUES 
(gen_random_uuid(), 'Nammed Medical Aid Fund', 'NAMM', true),
(gen_random_uuid(), 'Namibia Medical Care', 'NMC', true),
(gen_random_uuid(), 'Namibia Health Plan', 'NHP', true),
(gen_random_uuid(), 'Methealth Namibia', 'METH', true),
(gen_random_uuid(), 'Prosperity Health', 'PROS', true),
(gen_random_uuid(), 'Bonitas Medical Fund', 'BONITAS', true),
(gen_random_uuid(), 'Discovery Health', 'DISCOVERY', true),
(gen_random_uuid(), 'Gem Health Medical Scheme', 'GEM', true),
(gen_random_uuid(), 'Old Mutual Health', 'OLDMUTUAL', true)
ON CONFLICT (provider_code) DO UPDATE SET 
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- STEP 3: Update existing medical_aid_details records to use the foreign key
-- Match by name and populate the medical_aid_provider_id
UPDATE public.medical_aid_details mad
SET medical_aid_provider_id = map.id
FROM public.medical_aid_providers map
WHERE mad.provider ILIKE map.name
  AND mad.medical_aid_provider_id IS NULL;

-- Handle common name variations
UPDATE public.medical_aid_details mad
SET medical_aid_provider_id = map.id
FROM public.medical_aid_providers map
WHERE mad.medical_aid_provider_id IS NULL
  AND (
    (mad.provider ILIKE '%nammed%' AND map.provider_code = 'NAMM') OR
    (mad.provider ILIKE '%namibia medical care%' AND map.provider_code = 'NMC') OR
    (mad.provider ILIKE '%namibia health plan%' AND map.provider_code = 'NHP') OR
    (mad.provider ILIKE '%prosperity%' AND map.provider_code = 'PROS') OR
    (mad.provider ILIKE '%bonitas%' AND map.provider_code = 'BONITAS') OR
    (mad.provider ILIKE '%discovery%' AND map.provider_code = 'DISCOVERY') OR
    (mad.provider ILIKE '%gem%' AND map.provider_code = 'GEM') OR
    (mad.provider ILIKE '%old mutual%' AND map.provider_code = 'OLDMUTUAL')
  );

-- STEP 4: Add the foreign key constraint
ALTER TABLE public.medical_aid_details
ADD CONSTRAINT IF NOT EXISTS medical_aid_details_provider_id_fkey
FOREIGN KEY (medical_aid_provider_id) REFERENCES public.medical_aid_providers(id);

-- STEP 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_provider_id 
ON public.medical_aid_details(medical_aid_provider_id);

-- STEP 6: Update RLS policies to use the new relationship
-- Drop old policies that might conflict
DROP POLICY IF EXISTS "Users can view medical aid details for their practice patients" ON medical_aid_details;
DROP POLICY IF EXISTS "Users can insert medical aid details for their practice patients" ON medical_aid_details;
DROP POLICY IF EXISTS "Users can update medical aid details for their practice patients" ON medical_aid_details;

-- Create new policies using the foreign key relationship
CREATE POLICY "Users can view medical aid details for their practice patients" ON medical_aid_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patients p 
      WHERE p.id = medical_aid_details.patient_id 
        AND p.practice_id IN (
          SELECT practice_id FROM users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can insert medical aid details for their practice patients" ON medical_aid_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p 
      WHERE p.id = medical_aid_details.patient_id 
        AND p.practice_id IN (
          SELECT practice_id FROM users WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can update medical aid details for their practice patients" ON medical_aid_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patients p 
      WHERE p.id = medical_aid_details.patient_id 
        AND p.practice_id IN (
          SELECT practice_id FROM users WHERE id = auth.uid()
        )
    )
  );

-- STEP 7: Create a view for easier frontend access
CREATE OR REPLACE VIEW medical_aid_details_with_provider AS
SELECT 
  mad.*,
  map.name as provider_name,
  map.provider_code,
  map.logo_url as provider_logo_url
FROM medical_aid_details mad
LEFT JOIN medical_aid_providers map ON mad.medical_aid_provider_id = map.id;

-- Grant access to the view
GRANT SELECT ON medical_aid_details_with_provider TO authenticated;

-- STEP 8: Create function to get medical aid providers for frontend
CREATE OR REPLACE FUNCTION get_medical_aid_providers()
RETURNS TABLE(
  id UUID,
  name TEXT,
  provider_code TEXT,
  logo_url TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    map.id,
    map.name,
    map.provider_code,
    map.logo_url,
    map.is_active
  FROM medical_aid_providers map
  WHERE map.is_active = true
  ORDER BY map.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_medical_aid_providers() TO authenticated;

-- STEP 9: Verification queries (run these to check)
-- Check that all medical_aid_details have valid provider IDs
SELECT 
  COUNT(*) as total_records,
  COUNT(medical_aid_provider_id) as records_with_provider_id,
  COUNT(*) - COUNT(medical_aid_provider_id) as missing_provider_ids
FROM medical_aid_details;

-- List any records that still don't have provider IDs
SELECT id, provider, scheme_name 
FROM medical_aid_details 
WHERE medical_aid_provider_id IS NULL;

-- CRITICAL SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE 'CRITICAL FIX COMPLETE: Medical aid foreign key relationships established';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update frontend code to use medical_aid_provider_id instead of provider text';
  RAISE NOTICE '2. Use get_medical_aid_providers() function for dropdown lists';
  RAISE NOTICE '3. Test patient registration with medical aid selection';
END $$;