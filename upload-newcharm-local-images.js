#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// CRITICAL: Always use service role for database operations (from CLAUDE.md)
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Your local image directory
const LOCAL_IMAGE_PATH = 'c:/Users/Happyou2/Documents/mxhealth/newcharm';

async function uploadLocalImages() {
  console.log('🦷 NewCharm Local Image Upload (bolt.new method)\\n');
  
  try {
    // Check if local directory exists (we'll simulate since we can't access Windows paths)
    console.log(`📁 Looking for images in: ${LOCAL_IMAGE_PATH}`);
    console.log('⚠️ Cannot access Windows path directly from WSL/Linux environment');
    console.log('💡 Alternative approach: Copy images to Linux-accessible location\\n');
    
    // Expected image files from your local directory
    const expectedImages = [
      { local: 'logo.png', remote: 'newcharm/logo.png', type: 'logo' },
      { local: 'before1.jpg', remote: 'newcharm/before-after/before1.jpg', type: 'before' },
      { local: 'after1.jpg', remote: 'newcharm/before-after/after1.jpg', type: 'after' },
      { local: 'before2.jpg', remote: 'newcharm/before-after/before2.jpg', type: 'before' },
      { local: 'after2.jpg', remote: 'newcharm/before-after/after2.jpg', type: 'after' },
      { local: 'before3.jpg', remote: 'newcharm/before-after/before3.jpg', type: 'before' },
      { local: 'after3.jpg', remote: 'newcharm/before-after/after3.jpg', type: 'after' },
      { local: 'before4.jpg', remote: 'newcharm/before-after/before4.jpg', type: 'before' },
      { local: 'after4.jpg', remote: 'newcharm/before-after/after4.jpg', type: 'after' },
      { local: 'before5.jpg', remote: 'newcharm/before-after/before5.jpg', type: 'before' },
      { local: 'after5.jpg', remote: 'newcharm/before-after/after5.jpg', type: 'after' }
    ];
    
    console.log('📋 Expected image structure:');
    expectedImages.forEach(img => {
      console.log(`   • ${img.local} → ${img.remote}`);
    });
    
    console.log('\\n🔧 To upload your images, please:');
    console.log('1. Copy images from Windows to WSL-accessible location:');
    console.log('   mkdir -p /tmp/newcharm-images');
    console.log(`   cp "${LOCAL_IMAGE_PATH}"/* /tmp/newcharm-images/`);
    console.log('   # Or use Windows Explorer to copy to \\\\wsl$\\Ubuntu\\tmp\\newcharm-images\\');
    console.log('\\n2. Re-run this script to upload them automatically');
    
    // Check if images are in temp directory
    const tempDir = '/tmp/newcharm-images';
    if (fs.existsSync(tempDir)) {
      console.log('\\n✅ Found images in temp directory! Uploading...\\n');
      
      const uploadResults = [];
      
      for (const imageConfig of expectedImages) {
        const localPath = path.join(tempDir, imageConfig.local);
        
        if (fs.existsSync(localPath)) {
          console.log(`📤 Uploading ${imageConfig.local}...`);
          
          try {
            // Read the local file
            const fileBuffer = fs.readFileSync(localPath);
            const contentType = imageConfig.local.endsWith('.png') ? 'image/png' : 'image/jpeg';
            
            // Upload to Supabase Storage using service role
            const { data, error } = await supabase.storage
              .from('practice-images')
              .upload(imageConfig.remote, fileBuffer, {
                contentType,
                upsert: true
              });
            
            if (error) {
              console.error(`❌ Error uploading ${imageConfig.local}:`, error.message);
            } else {
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('practice-images')
                .getPublicUrl(imageConfig.remote);
              
              console.log(`✅ Uploaded: ${publicUrl}`);
              uploadResults.push({
                type: imageConfig.type,
                local: imageConfig.local,
                url: publicUrl
              });
            }
          } catch (error) {
            console.error(`❌ Error processing ${imageConfig.local}:`, error.message);
          }
        } else {
          console.log(`⚠️ Missing: ${imageConfig.local}`);
        }
      }
      
      // Update NewCharm practice with new image URLs
      if (uploadResults.length > 0) {
        console.log('\\n📝 Updating NewCharm practice with new image URLs...');
        
        // Build update object
        const logoUrl = uploadResults.find(r => r.type === 'logo')?.url;
        const beforeAfterPairs = [];
        
        // Group before/after pairs
        for (let i = 1; i <= 5; i++) {
          const before = uploadResults.find(r => r.local === `before${i}.jpg`)?.url;
          const after = uploadResults.find(r => r.local === `after${i}.jpg`)?.url;
          
          if (before && after) {
            beforeAfterPairs.push({
              id: i.toString(),
              before,
              after,
              title: i === 1 ? 'Complete Smile Makeover' :
                     i === 2 ? 'Orthodontic Transformation' :
                     i === 3 ? 'Full Dental Restoration' :
                     i === 4 ? 'Professional Teeth Whitening' :
                     'Gum Health Restoration',
              treatment: i === 1 ? 'Veneers & Teeth Whitening' :
                        i === 2 ? 'Clear Aligners' :
                        i === 3 ? 'Implants & Crowns' :
                        i === 4 ? 'Zoom Whitening' :
                        'Periodontal Treatment',
              duration: i === 1 ? '3 weeks' :
                       i === 2 ? '12 months' :
                       i === 3 ? '6 months' :
                       i === 4 ? '1 hour' :
                       '4 months'
            });
          }
        }
        
        // Update practice using service role (bypasses RLS)
        const updateData = {};
        if (logoUrl) updateData.logo_url = logoUrl;
        if (beforeAfterPairs.length > 0) {
          updateData.metadata = {
            before_after_gallery: beforeAfterPairs,
            gallery_images: uploadResults.filter(r => r.type === 'after').map(r => r.url)
          };
        }
        
        const { error: updateError } = await supabase
          .from('practices')
          .update(updateData)
          .eq('slug', 'newcharm-dental');
        
        if (updateError) {
          console.error('❌ Error updating practice:', updateError.message);
        } else {
          console.log('✅ NewCharm practice updated with your images!\\n');
          
          console.log('📊 Upload Summary:');
          console.log(`   • Logo: ${logoUrl ? '✅' : '❌'}`);
          console.log(`   • Before/After Pairs: ${beforeAfterPairs.length}/5`);
          console.log(`   • Total Images: ${uploadResults.length}`);
          
          console.log('\\n🌐 NewCharm with your images is now live at:');
          console.log('   • http://localhost:3001?practice=newcharm-dental');
          console.log('   • http://localhost:3000?practice=newcharm-dental');
        }
      }
      
    } else {
      console.log('\\n📋 Setup Instructions:');
      console.log('1. Create temp directory: mkdir -p /tmp/newcharm-images');
      console.log('2. Copy your images:');
      console.log(`   - From: ${LOCAL_IMAGE_PATH}`);
      console.log('   - To: /tmp/newcharm-images/');
      console.log('   - Expected files: logo.png, before1.jpg, after1.jpg, ..., before5.jpg, after5.jpg');
      console.log('3. Run this script again');
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
  }
}

uploadLocalImages().catch(console.error);