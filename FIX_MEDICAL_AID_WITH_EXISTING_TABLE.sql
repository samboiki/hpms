-- ============================================
-- TARGETED FIX: Medical Aid Foreign Key (Using Existing Table)
-- Your medical_aid_providers table already exists with correct data
-- This fixes the 400 error by adding proper foreign key relationships
-- ============================================

-- STEP 1: Add the foreign key column to medical_aid_details
ALTER TABLE public.medical_aid_details
ADD COLUMN IF NOT EXISTS medical_aid_provider_id UUID;

-- STEP 2: Update existing medical_aid_details records to use your existing provider IDs
-- Match by name to link with your existing providers
UPDATE public.medical_aid_details mad
SET medical_aid_provider_id = map.id
FROM public.medical_aid_providers map
WHERE mad.medical_aid_provider_id IS NULL
  AND (
    (mad.provider ILIKE '%methealth%' AND map.id = '2d172f06-a899-48f9-88d0-1d10792fdea4') OR
    (mad.provider ILIKE '%namibia health plan%' AND map.id = '472cf1b4-cce0-47bb-b674-5874e01c1eb9') OR
    (mad.provider ILIKE '%nhp%' AND map.id = '472cf1b4-cce0-47bb-b674-5874e01c1eb9') OR
    (mad.provider ILIKE '%namibia medical care%' AND map.id = '794b73d7-18c9-4752-93af-f239835c7702') OR
    (mad.provider ILIKE '%nmc%' AND map.id = '794b73d7-18c9-4752-93af-f239835c7702') OR
    (mad.provider ILIKE '%prosperity%' AND map.id = '80c1c8ec-448e-4190-b373-177ffbfe82fd') OR
    (mad.provider ILIKE '%nammed%' AND map.id = 'b763f347-bc31-4992-ab12-cd4a49a48789')
  );

-- STEP 3: Add the foreign key constraint
ALTER TABLE public.medical_aid_details
ADD CONSTRAINT IF NOT EXISTS medical_aid_details_provider_id_fkey
FOREIGN KEY (medical_aid_provider_id) REFERENCES public.medical_aid_providers(id);

-- STEP 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_provider_id 
ON public.medical_aid_details(medical_aid_provider_id);

-- STEP 5: Create function to get your existing medical aid providers
CREATE OR REPLACE FUNCTION get_medical_aid_providers()
RETURNS TABLE(
  id UUID,
  name TEXT,
  short_name TEXT,
  logo_url TEXT,
  medical_aid_reference TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    map.id,
    map.name,
    map.short_name,
    map.logo_url,
    map.medical_aid_reference
  FROM medical_aid_providers map
  ORDER BY map.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_medical_aid_providers() TO authenticated;

-- STEP 6: Update RLS policies for medical_aid_details
DROP POLICY IF EXISTS "Users can view medical aid details for their practice patients" ON medical_aid_details;
DROP POLICY IF EXISTS "Users can insert medical aid details for their practice patients" ON medical_aid_details;
DROP POLICY IF EXISTS "Users can update medical aid details for their practice patients" ON medical_aid_details;

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

-- STEP 7: Create a view for easier frontend access with your existing data
CREATE OR REPLACE VIEW medical_aid_details_with_provider AS
SELECT 
  mad.*,
  map.name as provider_name,
  map.short_name as provider_short_name,
  map.logo_url as provider_logo_url,
  map.medical_aid_reference
FROM medical_aid_details mad
LEFT JOIN medical_aid_providers map ON mad.medical_aid_provider_id = map.id;

GRANT SELECT ON medical_aid_details_with_provider TO authenticated;

-- STEP 8: Verification - Check your existing providers
SELECT 
  id,
  name,
  short_name,
  medical_aid_reference,
  CASE 
    WHEN logo_url IS NOT NULL THEN 'Has Logo'
    ELSE 'No Logo'
  END as logo_status
FROM medical_aid_providers
ORDER BY name;

-- STEP 9: Check if any medical_aid_details records need manual linking
SELECT 
  COUNT(*) as total_records,
  COUNT(medical_aid_provider_id) as records_with_provider_id,
  COUNT(*) - COUNT(medical_aid_provider_id) as missing_provider_ids
FROM medical_aid_details;

-- List any records that still don't have provider IDs (for manual fixing)
SELECT 
  id, 
  provider, 
  scheme_name,
  'Needs manual linking' as status
FROM medical_aid_details 
WHERE medical_aid_provider_id IS NULL;

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE '✅ TARGETED FIX COMPLETE using your existing medical_aid_providers table';
  RAISE NOTICE 'Your 5 medical aid providers:';
  RAISE NOTICE '- Methealth Namibia (MAG1)';
  RAISE NOTICE '- Namibia Health Plan (NHPM)'; 
  RAISE NOTICE '- Namibia Medical Care (NMC1)';
  RAISE NOTICE '- Prosperity Health (PROS)';
  RAISE NOTICE '- Nammed Medical Aid Fund (NAMM)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update frontend to use medical_aid_provider_id field';
  RAISE NOTICE '2. Use get_medical_aid_providers() function for dropdowns';
  RAISE NOTICE '3. Test patient registration';
END $$;