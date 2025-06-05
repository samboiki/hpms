import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Local image directory
const LOCAL_IMAGE_PATH = 'c:/Users/Happyou2/Documents/mxhealth/newcharm';

// Image mappings
const imagesToUpload = [
  { local: 'logo.png', remote: 'newcharm/logo.png', description: 'NewCharm Dental Logo' },
  { local: 'before1.jpg', remote: 'newcharm/before-after/before1.jpg', description: 'Before Treatment 1' },
  { local: 'after1.jpg', remote: 'newcharm/before-after/after1.jpg', description: 'After Treatment 1' },
  { local: 'before2.jpg', remote: 'newcharm/before-after/before2.jpg', description: 'Before Treatment 2' },
  { local: 'after2.jpg', remote: 'newcharm/before-after/after2.jpg', description: 'After Treatment 2' },
  { local: 'before3.jpg', remote: 'newcharm/before-after/before3.jpg', description: 'Before Treatment 3' },
  { local: 'after3.jpg', remote: 'newcharm/before-after/after3.jpg', description: 'After Treatment 3' },
  { local: 'before4.jpg', remote: 'newcharm/before-after/before4.jpg', description: 'Before Treatment 4' },
  { local: 'after4.jpg', remote: 'newcharm/before-after/after4.jpg', description: 'After Treatment 4' },
  { local: 'before5.jpg', remote: 'newcharm/before-after/before5.jpg', description: 'Before Treatment 5' },
  { local: 'after5.jpg', remote: 'newcharm/before-after/after5.jpg', description: 'After Treatment 5' },
];

// Premium Unsplash dental images to download
const unsplashImages = [
  {
    url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
    remote: 'newcharm/hero-banner.jpg',
    description: 'Premium Dental Clinic Hero Banner'
  },
  {
    url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    remote: 'newcharm/modern-treatment-room.jpg',
    description: 'Modern Dental Treatment Room'
  },
  {
    url: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    remote: 'newcharm/consultation.jpg',
    description: 'Dental Consultation'
  }
];

async function ensureBucketExists() {
  console.log('🔍 Checking for practice-images bucket...');
  
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === 'practice-images');
  
  if (!bucketExists) {
    console.log('📁 Creating practice-images bucket...');
    const { error } = await supabase.storage.createBucket('practice-images', {
      public: true,
      fileSizeLimit: 52428800 // 50MB
    });
    
    if (error) {
      console.error('❌ Error creating bucket:', error);
      return false;
    }
    console.log('✅ Bucket created successfully');
  } else {
    console.log('✅ Bucket already exists');
  }
  
  return true;
}

async function uploadLocalImage(localPath, remotePath, description) {
  try {
    const fullPath = path.join(LOCAL_IMAGE_PATH, localPath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${localPath} - file not found`);
      return null;
    }
    
    // Read file
    const fileBuffer = fs.readFileSync(fullPath);
    const contentType = localPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Upload to Supabase
    console.log(`📤 Uploading ${description}...`);
    const { data, error } = await supabase.storage
      .from('practice-images')
      .upload(remotePath, fileBuffer, {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Error uploading ${localPath}:`, error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('practice-images')
      .getPublicUrl(remotePath);
    
    console.log(`✅ Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Error processing ${localPath}:`, error);
    return null;
  }
}

async function downloadAndUploadUnsplashImage(imageConfig) {
  try {
    console.log(`📥 Downloading ${imageConfig.description}...`);
    
    const response = await fetch(imageConfig.url);
    const buffer = await response.arrayBuffer();
    
    console.log(`📤 Uploading to Supabase...`);
    const { data, error } = await supabase.storage
      .from('practice-images')
      .upload(imageConfig.remote, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Error uploading:`, error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('practice-images')
      .getPublicUrl(imageConfig.remote);
    
    console.log(`✅ Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Error processing Unsplash image:`, error);
    return null;
  }
}

async function main() {
  console.log('🦷 NewCharm Dental Image Upload Script\n');
  
  // Ensure bucket exists
  if (!await ensureBucketExists()) {
    return;
  }
  
  const uploadedUrls = {
    logo: null,
    heroBanner: null,
    beforeAfter: [],
    gallery: []
  };
  
  // Upload local images
  console.log('\n📁 Uploading local NewCharm images...\n');
  for (const image of imagesToUpload) {
    const url = await uploadLocalImage(image.local, image.remote, image.description);
    
    if (url) {
      if (image.local === 'logo.png') {
        uploadedUrls.logo = url;
      } else if (image.local.includes('before') || image.local.includes('after')) {
        uploadedUrls.beforeAfter.push({
          type: image.local.includes('before') ? 'before' : 'after',
          number: parseInt(image.local.match(/\d+/)[0]),
          url
        });
      }
    }
  }
  
  // Download and upload Unsplash images
  console.log('\n🌐 Downloading premium dental images from Unsplash...\n');
  for (const image of unsplashImages) {
    const url = await downloadAndUploadUnsplashImage(image);
    
    if (url) {
      if (image.remote.includes('hero-banner')) {
        uploadedUrls.heroBanner = url;
      } else {
        uploadedUrls.gallery.push(url);
      }
    }
  }
  
  // Generate updated migration SQL
  console.log('\n📝 Generating updated migration SQL...\n');
  
  const updatedMigration = `
-- ✅ UPDATED NewCharm Migration with Supabase Storage URLs

-- Step 1: Add testimonials column if it doesn't exist
ALTER TABLE practices ADD COLUMN IF NOT EXISTS testimonials JSONB DEFAULT '[]'::jsonb;

-- Step 2: Update NewCharm with real images from Supabase Storage
UPDATE practices
SET 
  logo_url = '${uploadedUrls.logo || '/images/newcharm/logo.png'}',
  hero_image_url = '${uploadedUrls.heroBanner || '/images/newcharm/hero-banner.jpg'}',
  updated_at = NOW()
WHERE slug = 'newcharm-dental';

-- Step 3: Add before/after transformations to metadata
UPDATE practices
SET 
  metadata = jsonb_build_object(
    'before_after_gallery', '[
      ${uploadedUrls.beforeAfter
        .filter(img => img.type === 'before')
        .map(before => {
          const after = uploadedUrls.beforeAfter.find(a => a.type === 'after' && a.number === before.number);
          return `{
        "id": "${before.number}",
        "before": "${before.url}",
        "after": "${after?.url || ''}",
        "title": "Dental Transformation ${before.number}",
        "treatment": "Comprehensive Dental Care"
      }`;
        }).join(',\n      ')}
    ]'::jsonb,
    'gallery_images', '${JSON.stringify(uploadedUrls.gallery)}'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'newcharm-dental';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ NewCharm images updated with Supabase Storage URLs!';
  RAISE NOTICE '';
  RAISE NOTICE '🦷 Updated Resources:';
  RAISE NOTICE '   • Logo: ${uploadedUrls.logo ? 'Uploaded' : 'Using default'}';
  RAISE NOTICE '   • Hero Banner: ${uploadedUrls.heroBanner ? 'Uploaded' : 'Using default'}';
  RAISE NOTICE '   • Before/After Pairs: ${Math.floor(uploadedUrls.beforeAfter.length / 2)}';
  RAISE NOTICE '   • Gallery Images: ${uploadedUrls.gallery.length}';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NewCharm is ready with real images!';
END $$;
`;

  // Save updated migration
  fs.writeFileSync('NEWCHARM_STORAGE_UPDATE.sql', updatedMigration);
  console.log('✅ Saved updated migration to NEWCHARM_STORAGE_UPDATE.sql');
  
  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(`   • Logo: ${uploadedUrls.logo ? '✅' : '❌'}`);
  console.log(`   • Hero Banner: ${uploadedUrls.heroBanner ? '✅' : '❌'}`);
  console.log(`   • Before/After Images: ${uploadedUrls.beforeAfter.length}`);
  console.log(`   • Gallery Images: ${uploadedUrls.gallery.length}`);
  console.log('\n✨ All done! Execute NEWCHARM_STORAGE_UPDATE.sql in Supabase to update the database.');
}

// Run the script
main().catch(console.error);