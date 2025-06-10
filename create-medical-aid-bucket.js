import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNjI5NzI4MSwiZXhwIjoyMDMxODczMjgxfQ.lYNRqYhPZ8vGcG0sDpQyPdkBFcQyLy3Bb5Q1cLN3i2o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMedicalAidBucket() {
  try {
    console.log('🚀 Creating medical aid bucket and uploading logos...');

    // Step 1: Create storage bucket for medical aid logos
    console.log('📦 Creating medical-aid-logos bucket...');
    
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('medical-aid-logos', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Error creating bucket:', bucketError);
      throw bucketError;
    }
    
    console.log('✅ Bucket created or already exists');

    // Step 2: Get list of logo files
    const logoDir = '/home/happy/projects/hpms/public/images/medical-aids';
    const logoFiles = fs.readdirSync(logoDir).filter(file => 
      file.endsWith('.png') || file.endsWith('.svg') || file.endsWith('.jpg') || file.endsWith('.jpeg')
    );

    console.log('📁 Found logo files:', logoFiles);

    // Step 3: Upload each logo file
    console.log('⬆️ Uploading logo files...');
    
    const uploadPromises = logoFiles.map(async (filename) => {
      const filePath = path.join(logoDir, filename);
      const fileContent = fs.readFileSync(filePath);
      
      const { data, error } = await supabase.storage
        .from('medical-aid-logos')
        .upload(filename, fileContent, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error(`❌ Error uploading ${filename}:`, error);
        return { filename, success: false, error };
      }
      
      console.log(`✅ Successfully uploaded ${filename}`);
      return { filename, success: true, data };
    });

    const uploadResults = await Promise.all(uploadPromises);
    const successfulUploads = uploadResults.filter(result => result.success);
    
    console.log(`📊 Upload Summary: ${successfulUploads.length}/${logoFiles.length} files uploaded successfully`);

    // Step 4: List uploaded files to verify
    console.log('🔍 Verifying uploaded files...');
    const { data: files, error: listError } = await supabase.storage
      .from('medical-aid-logos')
      .list();

    if (listError) {
      console.error('❌ Error listing files:', listError);
    } else {
      console.log('📋 Files in bucket:');
      files.forEach(file => {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${file.name}`;
        console.log(`  - ${file.name}: ${publicUrl}`);
      });
    }

    console.log('\n🎉 Medical aid bucket creation and logo upload completed successfully!');
    console.log('\n📝 Next Step: Update medical_aid_providers table with the new logo URLs');

  } catch (error) {
    console.error('💥 Error in medical aid bucket setup:', error);
    throw error;
  }
}

// Run the function
createMedicalAidBucket().catch(console.error);