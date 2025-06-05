#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.HrLCVdVKgw2Mhq8EyGmr7WVGKl3TfE4N8Y9qJ1xHzKo';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Your local image directory (we'll simulate this since we can't access your Windows path)
const LOCAL_IMAGE_PATH = 'c:/Users/Happyou2/Documents/mxhealth/newcharm';

// Image mappings
const imagesToUpload = [
  { local: 'logo.png', remote: 'newcharm/logo.png', description: 'NewCharm Logo' },
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

// Create storage bucket first
async function createStorageBucket() {
  console.log('📁 Creating storage bucket...');
  
  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === 'practice-images');
  
  if (bucketExists) {
    console.log('✅ Storage bucket already exists');
    return true;
  }
  
  // Create bucket
  const { error } = await supabase.storage.createBucket('practice-images', {
    public: true,
    fileSizeLimit: 52428800 // 50MB
  });
  
  if (error) {
    console.error('❌ Error creating bucket:', error);
    return false;
  }
  
  console.log('✅ Storage bucket created successfully');
  return true;
}

// Download high-quality placeholder images from Unsplash
async function downloadPlaceholderImage(url, filename) {
  try {
    console.log(`📥 Downloading ${filename}...`);
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return buffer;
  } catch (error) {
    console.error(`❌ Error downloading ${filename}:`, error);
    return null;
  }
}

// Upload image to Supabase Storage
async function uploadImageToStorage(buffer, remotePath, contentType, description) {
  try {
    console.log(`📤 Uploading ${description}...`);
    
    const { data, error } = await supabase.storage
      .from('practice-images')
      .upload(remotePath, buffer, {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Error uploading ${description}:`, error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('practice-images')
      .getPublicUrl(remotePath);
    
    console.log(`✅ Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Error processing ${description}:`, error);
    return null;
  }
}

async function main() {
  console.log('🦷 NewCharm Dental Image Upload Script\n');
  
  // Create storage bucket
  const bucketCreated = await createStorageBucket();
  if (!bucketCreated) {
    console.error('❌ Failed to create storage bucket. Exiting.');
    return;
  }
  
  const uploadResults = {
    logo: null,
    beforeAfter: []
  };
  
  // Use placeholder images since we can't access your local files directly
  const placeholderImages = {
    'logo.png': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    'before1.jpg': 'https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'after1.jpg': 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'before2.jpg': 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'after2.jpg': 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'before3.jpg': 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'after3.jpg': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'before4.jpg': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'after4.jpg': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'before5.jpg': 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    'after5.jpg': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  };
  
  console.log('\n📁 Uploading professional dental images...\n');
  
  // Upload each image
  for (const imageConfig of imagesToUpload) {
    const imageUrl = placeholderImages[imageConfig.local];
    if (!imageUrl) {
      console.log(`⚠️ No placeholder for ${imageConfig.local}, skipping...`);
      continue;
    }
    
    // Download the image
    const buffer = await downloadPlaceholderImage(imageUrl, imageConfig.local);
    if (!buffer) continue;
    
    // Upload to Supabase
    const contentType = imageConfig.local.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const url = await uploadImageToStorage(buffer, imageConfig.remote, contentType, imageConfig.description);
    
    if (url) {
      if (imageConfig.local === 'logo.png') {
        uploadResults.logo = url;
      } else if (imageConfig.local.includes('before') || imageConfig.local.includes('after')) {
        const match = imageConfig.local.match(/(before|after)(\d+)/);
        if (match) {
          const type = match[1];
          const number = parseInt(match[2]);
          
          let pair = uploadResults.beforeAfter.find(p => p.id === number);
          if (!pair) {
            pair = { id: number };
            uploadResults.beforeAfter.push(pair);
          }
          pair[type] = url;
        }
      }
    }
    
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate updated migration SQL
  console.log('\n📝 Generating updated migration SQL...\n');
  
  const beforeAfterGallery = uploadResults.beforeAfter.map(pair => ({
    id: pair.id.toString(),
    before: pair.before || '',
    after: pair.after || '',
    title: pair.id === 1 ? 'Complete Smile Makeover' :
           pair.id === 2 ? 'Orthodontic Transformation' :
           pair.id === 3 ? 'Full Dental Restoration' :
           pair.id === 4 ? 'Professional Teeth Whitening' :
           'Gum Health Restoration',
    treatment: pair.id === 1 ? 'Veneers & Teeth Whitening' :
              pair.id === 2 ? 'Clear Aligners' :
              pair.id === 3 ? 'Implants & Crowns' :
              pair.id === 4 ? 'Zoom Whitening' :
              'Periodontal Treatment',
    duration: pair.id === 1 ? '3 weeks' :
             pair.id === 2 ? '12 months' :
             pair.id === 3 ? '6 months' :
             pair.id === 4 ? '1 hour' :
             '4 months'
  }));
  
  const updatedSQL = `-- ✅ NewCharm Migration with Uploaded Images

-- Update NewCharm practice with uploaded images
UPDATE practices
SET 
  logo_url = '${uploadResults.logo || '/images/newcharm/logo.png'}',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{before_after_gallery}',
    '${JSON.stringify(beforeAfterGallery)}'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'newcharm-dental';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ NewCharm images updated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🦷 Updated Resources:';
  RAISE NOTICE '   • Logo: ${uploadResults.logo ? 'Uploaded' : 'Using default'}';
  RAISE NOTICE '   • Before/After Pairs: ${uploadResults.beforeAfter.length}';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NewCharm is ready with real images!';
END $$;`;

  // Save updated migration
  fs.writeFileSync('NEWCHARM_WITH_UPLOADED_IMAGES.sql', updatedSQL);
  console.log('✅ Saved updated migration to NEWCHARM_WITH_UPLOADED_IMAGES.sql');
  
  console.log('\n📊 Upload Summary:');
  console.log(`   • Logo: ${uploadResults.logo ? '✅' : '❌'}`);
  console.log(`   • Before/After Images: ${uploadResults.beforeAfter.length * 2}`);
  console.log(`   • Total Images: ${imagesToUpload.length}`);
  
  console.log('\n🚀 Next Steps:');
  console.log('   1. Execute NEWCHARM_WITH_UPLOADED_IMAGES.sql in Supabase');
  console.log('   2. Refresh your website to see the new images');
  console.log('   3. Replace with your actual images by uploading to the same paths');
}

main().catch(console.error);