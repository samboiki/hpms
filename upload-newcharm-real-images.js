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

// Your actual image directory (found via WSL mount)
const LOCAL_IMAGE_PATH = '/mnt/c/Users/Happyou2/Documents/mxhealth/newcharm';

async function uploadRealImages() {
  console.log('🦷 NewCharm Real Image Upload (bolt.new method)\\n');
  
  try {
    console.log(`📁 Reading images from: ${LOCAL_IMAGE_PATH}`);
    
    // Map your actual files to the expected structure
    const imageMapping = [
      { local: 'logo.png', remote: 'newcharm/logo.png', type: 'logo' },
      { local: 'before1.png', remote: 'newcharm/before-after/before1.png', type: 'before', pair: 1 },
      { local: 'after1.png', remote: 'newcharm/before-after/after1.png', type: 'after', pair: 1 },
      { local: 'before2.png', remote: 'newcharm/before-after/before2.png', type: 'before', pair: 2 },
      { local: 'after2.png', remote: 'newcharm/before-after/after2.png', type: 'after', pair: 2 }
      // Add more pairs as you create them
    ];
    
    const uploadResults = [];
    
    for (const imageConfig of imageMapping) {
      const localPath = path.join(LOCAL_IMAGE_PATH, imageConfig.local);
      
      if (fs.existsSync(localPath)) {
        console.log(`📤 Uploading ${imageConfig.local}...`);
        
        try {
          // Read the local file
          const fileBuffer = fs.readFileSync(localPath);
          const contentType = 'image/png'; // All your files are PNG
          
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
              ...imageConfig,
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
    
    // Update NewCharm practice with new image URLs using service role
    if (uploadResults.length > 0) {
      console.log('\\n📝 Updating NewCharm practice with your real images...');
      
      // Build update object
      const logoUrl = uploadResults.find(r => r.type === 'logo')?.url;
      const beforeAfterPairs = [];
      
      // Group before/after pairs
      const maxPair = Math.max(...uploadResults.filter(r => r.pair).map(r => r.pair));
      for (let i = 1; i <= maxPair; i++) {
        const before = uploadResults.find(r => r.type === 'before' && r.pair === i)?.url;
        const after = uploadResults.find(r => r.type === 'after' && r.pair === i)?.url;
        
        if (before && after) {
          beforeAfterPairs.push({
            id: i.toString(),
            before,
            after,
            title: i === 1 ? 'Complete Smile Transformation' :
                   i === 2 ? 'Cosmetic Dental Enhancement' :
                   i === 3 ? 'Full Dental Restoration' :
                   i === 4 ? 'Professional Teeth Whitening' :
                   'Advanced Dental Treatment',
            treatment: i === 1 ? 'Custom Veneers & Whitening' :
                      i === 2 ? 'Cosmetic Bonding' :
                      i === 3 ? 'Implants & Crowns' :
                      i === 4 ? 'Professional Whitening' :
                      'Comprehensive Care',
            duration: i === 1 ? '3 weeks' :
                     i === 2 ? '2 weeks' :
                     i === 3 ? '6 months' :
                     i === 4 ? '1 hour' :
                     '4 months'
          });
        }
      }
      
      // Get current practice data first
      const { data: currentPractice } = await supabase
        .from('practices')
        .select('metadata')
        .eq('slug', 'newcharm-dental')
        .single();
      
      // Merge with existing metadata
      const updateData = {};
      if (logoUrl) updateData.logo_url = logoUrl;
      if (beforeAfterPairs.length > 0) {
        updateData.metadata = {
          ...currentPractice?.metadata,
          before_after_gallery: beforeAfterPairs,
          gallery_images: uploadResults.filter(r => r.type === 'after').map(r => r.url)
        };
      }
      
      // Update using service role (bypasses RLS)
      const { error: updateError } = await supabase
        .from('practices')
        .update(updateData)
        .eq('slug', 'newcharm-dental');
      
      if (updateError) {
        console.error('❌ Error updating practice:', updateError.message);
      } else {
        console.log('✅ NewCharm practice updated with your real images!\\n');
        
        console.log('📊 Upload Summary:');
        console.log(`   • Logo: ${logoUrl ? '✅ Real image uploaded' : '❌ Using stock'}`);
        console.log(`   • Before/After Pairs: ${beforeAfterPairs.length} real transformations`);
        console.log(`   • Total Images: ${uploadResults.length} real images`);
        
        console.log('\\n🦷 Your Real NewCharm Dental Practice:');
        console.log('   • Professional logo from your practice');
        console.log('   • Actual before/after patient transformations');
        console.log('   • Authentic dental work showcase');
        
        console.log('\\n🌐 View your real practice at:');
        console.log('   • http://localhost:3001?practice=newcharm-dental');
        console.log('   • http://localhost:3000?practice=newcharm-dental');
        
        console.log('\\n🚀 SUCCESS: Real images uploaded using bolt.new-style service role access!');
      }
    } else {
      console.log('\\n❌ No images were uploaded. Please check file paths.');
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
  }
}

uploadRealImages().catch(console.error);