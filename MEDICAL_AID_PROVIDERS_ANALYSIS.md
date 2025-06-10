# Medical Aid Providers Table Analysis

## Current Database Structure

Based on the migration file `/supabase/migrations/20250602_medical_aid_providers.sql`, the `medical_aid_providers` table has the following structure:

### Table Schema
```sql
CREATE TABLE medical_aid_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  logo_url TEXT,               -- This is where logos should be stored
  contact_number TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Important Note**: There is **NO** `medical_aid_reference` column in the table.

## Providers in Database (8 total)

1. **Namibia Medical Care** (NMC) → Has logo: `nmc-logo.png`
2. **Namibia Health Plan** (NHP) → Has logo: `nhp-logo.png`
3. **Nammed Medical Aid Fund** (Nammed) → Has logo: `nammed-logo.png`
4. **Gemhealth Medical Aid** (Gemhealth) → Has logo: `gemhealth-logo.png`
5. **Renaissance Health Medical Aid Fund** (Renaissance) → **No logo file**
6. **Napotel Medical Aid** (Napotel) → **No logo file**
7. **Bankmed Namibia** (Bankmed) → **No logo file**
8. **Methealth Namibia** (Methealth) → **No logo file**

## Available Logo Files (8 total)

Located in `/public/images/medical-aids/`:

### With Database Matches (4)
- `nmc-logo.png` → Namibia Medical Care
- `nhp-logo.png` → Namibia Health Plan
- `nammed-logo.png` → Nammed Medical Aid Fund
- `gemhealth-logo.png` → Gemhealth Medical Aid

### Without Database Matches (3)
- `bonitas-logo.png` → Not in database
- `discovery-logo.png` → Not in database
- `old-mutual-logo.png` → Not in database

### Fallback (1)
- `default-medical-aid.svg` → Generic fallback

## Solutions Implemented

### 1. Updated Logo Mapping (`src/utils/medicalAidLogos.ts`)
- ✅ Mapped all 8 database providers to appropriate logos
- ✅ Providers with logos get specific files
- ✅ Providers without logos get default fallback
- ✅ Updated schemes to match database migration data

### 2. Database Update SQL (`update-medical-aid-logos.sql`)
- ✅ Updates `logo_url` column for providers with available logos
- ✅ Sets fallback logo for providers without specific logos
- ✅ Ready to execute in Supabase dashboard

### 3. Logo File Recommendations

**Providers needing logo files:**
- Renaissance Health Medical Aid Fund
- Napotel Medical Aid  
- Bankmed Namibia
- Methealth Namibia

**Unused logo files that could be removed or kept for future use:**
- bonitas-logo.png
- discovery-logo.png  
- old-mutual-logo.png

## Medical Aid Schemes in Database

### NMC Schemes (4)
- Diamond (Premium - 100% cover)
- Platinum (High-level - 90% specialist)
- Gold (Standard - 80% specialist)
- Silver (Essential - 70% specialist)

### NHP Schemes (2)
- Executive (Premium - 100% cover, N$60k medication limit)
- Comprehensive (Full cover - 90% specialist, N$45k medication limit)

## Next Steps

1. **Execute database update**: Run `update-medical-aid-logos.sql` in Supabase
2. **Test logo display**: Verify logos appear correctly in patient details
3. **Optional**: Add missing logo files for complete coverage
4. **Optional**: Remove unused logo files to reduce bundle size

## Files Modified
- ✅ `src/utils/medicalAidLogos.ts` - Updated mappings
- ✅ `update-medical-aid-logos.sql` - Database update script
- ✅ This analysis document