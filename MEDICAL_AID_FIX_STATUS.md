# Medical Aid System Fix Status

## Problem
- Patient registration was failing with 400 error when medical aid details were included
- Issue was caused by missing foreign key relationship between `medical_aid_details` and `medical_aid_providers` tables

## Current Status: ✅ FRONTEND FIXED, DATABASE PENDING

### ✅ Completed
1. **Frontend Code Fixed**: Updated `PatientRegistrationForm.tsx` to use correct field mappings
2. **Field Mappings Corrected**:
   - `provider_id` → `medical_aid_provider_id` 
   - `membership_number` → `member_number`
   - `relationship_to_main` → `relationship_to_main_member`
3. **Removed Non-existent Dependencies**: Eliminated `medical_aid_schemes` table dependency
4. **Fallback Provider Fetching**: Added graceful fallback for provider data fetching
5. **Simplified Scheme Selection**: Changed from dropdown to text input

### 🔧 Pending Database Fix
**Execute this SQL in Supabase Dashboard > SQL Editor**:

```sql
-- Add foreign key column
ALTER TABLE public.medical_aid_details
ADD COLUMN IF NOT EXISTS medical_aid_provider_id UUID;

-- Add foreign key constraint  
ALTER TABLE public.medical_aid_details
ADD CONSTRAINT IF NOT EXISTS medical_aid_details_provider_id_fkey
FOREIGN KEY (medical_aid_provider_id) REFERENCES public.medical_aid_providers(id);

-- Create function for frontend
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
```

## Your Existing Medical Aid Providers
- Methealth Namibia (ID: 2d172f06-a899-48f9-88d0-1d10792fdea4)
- Namibia Health Plan (ID: 472cf1b4-cce0-47bb-b674-5874e01c1eb9)  
- Namibia Medical Care (ID: 794b73d7-18c9-4752-93af-f239835c7702)
- Nammed Medical Aid Fund (ID: b763f347-bc31-4992-ab12-cd4a49a48789)
- Prosperity Health (ID: 80c1c8ec-448e-4190-b373-177ffbfe82fd)

## Next Steps
1. **Execute SQL Fix**: Copy the SQL above into Supabase Dashboard > SQL Editor and run it
2. **Test Registration**: Try registering a new patient with medical aid details
3. **Verify Success**: Confirm no more 400 errors occur

## Files Modified
- `src/components/forms/PatientRegistrationForm.tsx` - Fixed field mappings and provider fetching
- `URGENT_MEDICAL_AID_FIX_MANUAL.sql` - Database fix script
- `src/components/forms/FixedMedicalAidForm.tsx` - Alternative fixed form component

## Expected Result
After executing the database fix, patient registration with medical aid details should work without 400 errors.