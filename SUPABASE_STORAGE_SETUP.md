# 🦷 NewCharm Supabase Storage Setup Guide

## 📁 Create Storage Bucket

### Step 1: Create the Storage Bucket
1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/storage/buckets
2. Click "New bucket"
3. Name: `practice-images`
4. Make it **Public** (important!)
5. Click "Create bucket"

### Step 2: Create NewCharm Folder
1. Click on the `practice-images` bucket
2. Click "Create folder"
3. Name: `newcharm`
4. Click "Create"

## 📸 Upload Your Images

### Images to Upload from `c:/Users/Happyou2/Documents/mxhealth/newcharm/`

#### 🏢 Logo
- Upload `logo.png` → Save as `newcharm/logo.png`

#### 🦷 Before/After Pairs
Create subfolder `newcharm/before-after/` and upload:
- `before1.jpg` → `newcharm/before-after/before1.jpg`
- `after1.jpg` → `newcharm/before-after/after1.jpg`
- `before2.jpg` → `newcharm/before-after/before2.jpg`
- `after2.jpg` → `newcharm/before-after/after2.jpg`
- `before3.jpg` → `newcharm/before-after/before3.jpg`
- `after3.jpg` → `newcharm/before-after/after3.jpg`
- `before4.jpg` → `newcharm/before-after/before4.jpg`
- `after4.jpg` → `newcharm/before-after/after4.jpg`
- `before5.jpg` → `newcharm/before-after/before5.jpg`
- `after5.jpg` → `newcharm/before-after/after5.jpg`

## 🔗 Get Public URLs

After uploading each image:
1. Click on the uploaded image
2. Click "Copy URL" or "Get public URL"
3. Note down each URL for the SQL update

## 📝 Expected URL Format
Your URLs will look like:
```
https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/logo.png
https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/before-after/before1.jpg
```

## 🗂️ Final Folder Structure
```
practice-images/
└── newcharm/
    ├── logo.png
    └── before-after/
        ├── before1.jpg
        ├── after1.jpg
        ├── before2.jpg
        ├── after2.jpg
        ├── before3.jpg
        ├── after3.jpg
        ├── before4.jpg
        ├── after4.jpg
        ├── before5.jpg
        └── after5.jpg
```

## ✅ After Upload Complete
Once all images are uploaded, I'll help you:
1. Update the SQL migration with real URLs
2. Execute the updated migration
3. Test that all images display correctly

Let me know when you've uploaded the images and I'll create the updated SQL!