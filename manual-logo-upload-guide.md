# Manual Logo Upload Guide

## Files to Upload

Upload these files from `/home/happy/projects/hpms/public/medical aids/` to the `medical-aid-logos` bucket:

1. **MAG1.png** → Methealth Namibia
2. **NAMM.png** → Nammed Medical Aid Fund  
3. **NHPM.png** → Namibia Health Plan
4. **NMC1.png** → Namibia Medical Care
5. **PROS.png** → Prosperity Health

## Manual Upload Steps

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Storage > Buckets
3. Create bucket `medical-aid-logos` if it doesn't exist:
   - Name: `medical-aid-logos`
   - Public: ✅ Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/png,image/jpeg,image/jpg`

4. Upload each file:
   - Click "Upload file"
   - Select file from `/home/happy/projects/hpms/public/medical aids/`
   - Ensure filename matches exactly (case sensitive)

## Verification

After upload, verify the URLs work:
- https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/MAG1.png
- https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NAMM.png
- https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NHPM.png
- https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/NMC1.png
- https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/medical-aid-logos/PROS.png

## Database Status

✅ **COMPLETED** - All providers have been updated with:
- `medical_aid_reference` column added
- Reference codes assigned (MAG1, NAMM, NHPM, NMC1, PROS)
- Logo URLs pointing to the correct storage paths

Once the manual upload is complete, the medical aid system will display the correct logos for each provider.