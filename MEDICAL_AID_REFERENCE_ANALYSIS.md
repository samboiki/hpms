# Medical Aid Reference Analysis

## Current Situation

Based on the file structure analysis, here's what I found:

### Available Logo Files in `/public/medical aids/`:
- **MAG1.png** 
- **NAMM.png**
- **NHPM.png** 
- **NMC1.png**
- **PROS.png**

### Sample Data References (from data files):
- **MAG1** - Likely Magnum Medical Aid or similar
- **MAG2** - Same provider, different scheme
- **NAMM** - Nammed Medical Aid Fund
- **NHPM** - Namibia Health Plan  
- **NMC1** - Namibia Medical Care
- **PROS** - Prosperity Health (likely Renaissance Health)

## Database Schema Issue

The current `medical_aid_providers` table does NOT have a `medical_aid_reference` column. The current structure includes:
- id
- name  
- short_name
- logo_url
- contact_number
- email
- website
- address
- created_at
- updated_at

## Recommended Solution

### 1. Add the missing column and update the data:

```sql
-- Add medical_aid_reference column
ALTER TABLE medical_aid_providers 
ADD COLUMN IF NOT EXISTS medical_aid_reference TEXT;

-- Update with reference codes based on logical mapping
UPDATE medical_aid_providers SET medical_aid_reference = 'NMC1' WHERE name = 'Namibia Medical Care';
UPDATE medical_aid_providers SET medical_aid_reference = 'NHPM' WHERE name = 'Namibia Health Plan';
UPDATE medical_aid_providers SET medical_aid_reference = 'NAMM' WHERE name = 'Nammed Medical Aid Fund';
UPDATE medical_aid_providers SET medical_aid_reference = 'MAG1' WHERE name = 'Gemhealth Medical Aid';
UPDATE medical_aid_providers SET medical_aid_reference = 'PROS' WHERE name = 'Renaissance Health Medical Aid Fund';

-- Update logo URLs to use the correct path with spaces
UPDATE medical_aid_providers 
SET logo_url = '/medical aids/' || medical_aid_reference || '.png' 
WHERE medical_aid_reference IS NOT NULL;

-- Verify the results
SELECT id, name, medical_aid_reference, logo_url 
FROM medical_aid_providers 
WHERE medical_aid_reference IS NOT NULL
ORDER BY medical_aid_reference;
```

### 2. Expected Results After Update:

| Name | Reference | Logo File |
|------|-----------|-----------|
| Gemhealth Medical Aid | MAG1 | /medical aids/MAG1.png |
| Nammed Medical Aid Fund | NAMM | /medical aids/NAMM.png |
| Namibia Health Plan | NHPM | /medical aids/NHPM.png |
| Namibia Medical Care | NMC1 | /medical aids/NMC1.png |
| Renaissance Health Medical Aid Fund | PROS | /medical aids/PROS.png |

## Key Points:

1. **Logo Path**: Use `/medical aids/` (with space) since that's where the files actually exist
2. **Reference Codes**: Match the 5 logo files you have: MAG1, NAMM, NHPM, NMC1, PROS
3. **Missing MAG2**: Only MAG1.png exists, not MAG2.png
4. **Provider Mapping**: Based on logical name matching between database providers and reference codes

## Frontend Usage:

Once updated, you can use the reference codes in your frontend:

```javascript
// Get logo URL using medical_aid_reference
const getLogoUrl = (medicalAidReference) => {
  return `/medical aids/${medicalAidReference}.png`;
};

// Example usage
const logoUrl = getLogoUrl('NMC1'); // Returns: "/medical aids/NMC1.png"
```