# 🦷 NewCharm Dental - Image Setup Guide

## 📸 Manual Image Upload to Supabase Storage

### Step 1: Access Supabase Storage
1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/storage/buckets
2. Click on `practice-images` bucket (or create it if it doesn't exist)
3. Create a folder called `newcharm`

### Step 2: Upload Your Local Images

From `c:/Users/Happyou2/Documents/mxhealth/newcharm/`, upload:

#### 🏢 Logo & Branding
- [ ] Upload `logo.png` → Save as `newcharm/logo.png`

#### 🦷 Before/After Transformations
Create a subfolder `newcharm/before-after/` and upload:
- [ ] `before1.jpg` → `newcharm/before-after/before1.jpg`
- [ ] `after1.jpg` → `newcharm/before-after/after1.jpg`
- [ ] `before2.jpg` → `newcharm/before-after/before2.jpg`
- [ ] `after2.jpg` → `newcharm/before-after/after2.jpg`
- [ ] `before3.jpg` → `newcharm/before-after/before3.jpg`
- [ ] `after3.jpg` → `newcharm/before-after/after3.jpg`
- [ ] `before4.jpg` → `newcharm/before-after/before4.jpg`
- [ ] `after4.jpg` → `newcharm/before-after/after4.jpg`
- [ ] `before5.jpg` → `newcharm/before-after/before5.jpg`
- [ ] `after5.jpg` → `newcharm/before-after/after5.jpg`

### Step 3: Get Public URLs

After uploading, get the public URLs for each image:
1. Click on each uploaded image
2. Copy the public URL
3. Note it down for the SQL update

### Step 4: Execute This SQL in Supabase

```sql
-- ✅ Update NewCharm with Supabase Storage Image URLs

-- Update logo and hero image
UPDATE practices
SET 
  logo_url = 'YOUR_LOGO_PUBLIC_URL_HERE',
  hero_image_url = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
  updated_at = NOW()
WHERE slug = 'newcharm-dental';

-- Add before/after gallery to metadata
UPDATE practices
SET 
  metadata = jsonb_build_object(
    'before_after_gallery', '[
      {
        "id": "1",
        "before": "YOUR_BEFORE1_URL_HERE",
        "after": "YOUR_AFTER1_URL_HERE",
        "title": "Complete Smile Makeover",
        "treatment": "Veneers & Teeth Whitening",
        "duration": "3 weeks"
      },
      {
        "id": "2", 
        "before": "YOUR_BEFORE2_URL_HERE",
        "after": "YOUR_AFTER2_URL_HERE",
        "title": "Orthodontic Transformation",
        "treatment": "Clear Aligners",
        "duration": "12 months"
      },
      {
        "id": "3",
        "before": "YOUR_BEFORE3_URL_HERE",
        "after": "YOUR_AFTER3_URL_HERE",
        "title": "Full Dental Restoration",
        "treatment": "Implants & Crowns",
        "duration": "6 months"
      },
      {
        "id": "4",
        "before": "YOUR_BEFORE4_URL_HERE",
        "after": "YOUR_AFTER4_URL_HERE",
        "title": "Teeth Whitening Excellence",
        "treatment": "Professional Whitening",
        "duration": "1 hour"
      },
      {
        "id": "5",
        "before": "YOUR_BEFORE5_URL_HERE",
        "after": "YOUR_AFTER5_URL_HERE",
        "title": "Gum Restoration",
        "treatment": "Periodontal Treatment",
        "duration": "4 months"
      }
    ]'::jsonb,
    'gallery_images', '[
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
    ]'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'newcharm-dental';
```

### Step 5: Alternative - Direct Base64 Upload

If you prefer, you can convert your images to base64 and I can help create an upload script:

1. Use an online tool like https://base64.guru/converter/encode/image
2. Convert each image to base64
3. Share the base64 strings and I'll create an upload script

---

## 🎨 Premium Dental Banner from Unsplash

I've already included a premium dental clinic banner in the SQL above:
- **Hero Banner**: Modern dental office reception area
- **Gallery Images**: Professional dental treatment rooms

## 🚀 Quick Setup Option

If you want me to create a complete setup script, please:
1. Upload your images to a cloud service (Google Drive, Dropbox, etc.)
2. Share the public links
3. I'll create a script to automatically upload them to Supabase

---

**Need help?** Let me know which option works best for you!