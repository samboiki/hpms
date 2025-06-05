// 🚀 Automated NewCharm Image Upload Script
// This script will upload your local images to Supabase Storage

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY_HERE'; // You'll need to add this

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Your local image directory
const LOCAL_IMAGE_PATH = 'c:/Users/Happyou2/Documents/mxhealth/newcharm';

// Image files to upload
const imagesToUpload = [
  // Logo
  { local: 'logo.png', remote: 'newcharm/logo.png', type: 'logo' },
  
  // Before/After pairs
  { local: 'before1.jpg', remote: 'newcharm/before-after/before1.jpg', type: 'before', pair: 1 },
  { local: 'after1.jpg', remote: 'newcharm/before-after/after1.jpg', type: 'after', pair: 1 },
  { local: 'before2.jpg', remote: 'newcharm/before-after/before2.jpg', type: 'before', pair: 2 },
  { local: 'after2.jpg', remote: 'newcharm/before-after/after2.jpg', type: 'after', pair: 2 },
  { local: 'before3.jpg', remote: 'newcharm/before-after/before3.jpg', type: 'before', pair: 3 },
  { local: 'after3.jpg', remote: 'newcharm/before-after/after3.jpg', type: 'after', pair: 3 },
  { local: 'before4.jpg', remote: 'newcharm/before-after/before4.jpg', type: 'before', pair: 4 },
  { local: 'after4.jpg', remote: 'newcharm/before-after/after4.jpg', type: 'after', pair: 4 },
  { local: 'before5.jpg', remote: 'newcharm/before-after/before5.jpg', type: 'before', pair: 5 },
  { local: 'after5.jpg', remote: 'newcharm/before-after/after5.jpg', type: 'after', pair: 5 },
];

async function uploadImage(imageConfig) {
  try {
    const fullPath = path.join(LOCAL_IMAGE_PATH, imageConfig.local);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${imageConfig.local} - file not found`);
      return null;
    }
    
    // Read file
    const fileBuffer = fs.readFileSync(fullPath);
    const contentType = imageConfig.local.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    console.log(`📤 Uploading ${imageConfig.local}...`);
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('practice-images')
      .upload(imageConfig.remote, fileBuffer, {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Error uploading ${imageConfig.local}:`, error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('practice-images')
      .getPublicUrl(imageConfig.remote);
    
    console.log(`✅ Uploaded: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    console.error(`❌ Error processing ${imageConfig.local}:`, error);
    return null;
  }
}

async function main() {
  console.log('🦷 NewCharm Image Upload Script Starting...\n');
  
  const uploadResults = {
    logo: null,
    beforeAfter: []
  };
  
  // Upload all images
  for (const imageConfig of imagesToUpload) {
    const url = await uploadImage(imageConfig);
    
    if (url) {
      if (imageConfig.type === 'logo') {
        uploadResults.logo = url;
      } else if (imageConfig.type === 'before' || imageConfig.type === 'after') {
        let pair = uploadResults.beforeAfter.find(p => p.id === imageConfig.pair);
        if (!pair) {
          pair = { id: imageConfig.pair };
          uploadResults.beforeAfter.push(pair);
        }
        pair[imageConfig.type] = url;
      }
    }
    
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Generate updated SQL
  console.log('\n📝 Generating updated SQL migration...\n');
  
  const beforeAfterJson = uploadResults.beforeAfter.map(pair => ({
    id: pair.id.toString(),
    before: pair.before || 'PLACEHOLDER_BEFORE_URL',
    after: pair.after || 'PLACEHOLDER_AFTER_URL',
    title: `Dental Transformation ${pair.id}`,
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
  
  const updatedSQL = `
-- ✅ NewCharm Migration with Real Supabase Storage URLs

-- Update logo and before/after images
UPDATE practices
SET 
  logo_url = '${uploadResults.logo || 'PLACEHOLDER_LOGO_URL'}',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{before_after_gallery}',
    '${JSON.stringify(beforeAfterJson)}'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'newcharm-dental';
`;
  
  // Save updated SQL
  fs.writeFileSync('NEWCHARM_UPDATED_MIGRATION.sql', updatedSQL);
  console.log('✅ Saved updated migration to NEWCHARM_UPDATED_MIGRATION.sql');
  
  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(`   • Logo: ${uploadResults.logo ? '✅' : '❌'}`);
  console.log(`   • Before/After Pairs: ${uploadResults.beforeAfter.length}`);
  console.log('\n🚀 Next Steps:');
  console.log('   1. Execute NEWCHARM_UPDATED_MIGRATION.sql in Supabase');
  console.log('   2. Refresh your website to see the new images');
}

// Instructions for manual setup
console.log(`
🔧 SETUP INSTRUCTIONS:

1. Get your Supabase Service Role Key:
   - Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/settings/api
   - Copy the "service_role" key (NOT the anon key)
   - Replace 'YOUR_SERVICE_ROLE_KEY_HERE' in this script

2. Install dependencies:
   npm install @supabase/supabase-js

3. Run this script:
   node upload-images-script.js

OR upload manually using the Storage Dashboard UI:
   - Follow the guide in SUPABASE_STORAGE_SETUP.md
`);

// Only run if service key is provided
if (supabaseServiceKey !== 'YOUR_SERVICE_ROLE_KEY_HERE') {
  main().catch(console.error);
} else {
  console.log('⚠️  Please update the service key before running the script!');
}