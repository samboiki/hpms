-- ============================================
-- URGENT: Execute this in Supabase Dashboard > SQL Editor
-- Fixes 400 error in patient registration
-- Uses your existing medical_aid_providers table
-- ============================================

-- STEP 1: Add foreign key column
ALTER TABLE public.medical_aid_details
ADD COLUMN IF NOT EXISTS medical_aid_provider_id UUID;

-- STEP 2: Add foreign key constraint
ALTER TABLE public.medical_aid_details
ADD CONSTRAINT IF NOT EXISTS medical_aid_details_provider_id_fkey
FOREIGN KEY (medical_aid_provider_id) REFERENCES public.medical_aid_providers(id);

-- STEP 3: Create function for frontend
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

-- STEP 4: Test the function
SELECT * FROM get_medical_aid_providers();

-- SUCCESS MESSAGE
SELECT 'Medical aid fix completed - now test patient registration' AS status;