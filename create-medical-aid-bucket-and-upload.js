import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNjI5NzI4MSwiZXhwIjoyMDMxODczMjgxfQ.lYNRqYhPZ8vGcG0sDpQyPdkBFcQyLy3Bb5Q1cLN3i2o';

// PostgreSQL connection for direct database access
const dbClient = new pg.Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMedicalAidBucketAndUpload() {
  try {
    console.log('🚀 Starting medical aid bucket creation and logo upload...');

    // Connect to database
    await dbClient.connect();
    console.log('✅ Connected to database');

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

    // Step 4: Update medical_aid_providers table with correct logo URLs
    console.log('🔄 Updating medical_aid_providers table...');

    // Mapping of provider short names to logo filenames
    const logoMapping = {
      'NMC': 'nmc-logo.png',
      'NHP': 'nhp-logo.png', 
      'NAMMED': 'nammed-logo.png',
      'GEMHEALTH': 'gemhealth-logo.png',
      'BONITAS': 'bonitas-logo.png',
      'DISCOVERY': 'discovery-logo.png',
      'OLD_MUTUAL': 'old-mutual-logo.png'
    };

    // Update each provider's logo_url
    for (const [shortName, logoFile] of Object.entries(logoMapping)) {
      const logoUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${logoFile}`;
      
      const updateQuery = `
        UPDATE medical_aid_providers 
        SET logo_url = $1, updated_at = NOW() 
        WHERE short_name = $2
      `;
      
      try {
        const result = await dbClient.query(updateQuery, [logoUrl, shortName]);
        console.log(`✅ Updated ${shortName} logo URL (${result.rowCount} rows affected)`);
      } catch (err) {
        console.error(`❌ Error updating ${shortName}:`, err.message);
      }
    }

    // Step 5: Set default logo for providers without specific logos
    const defaultLogoUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/default-medical-aid.svg`;
    
    const setDefaultQuery = `
      UPDATE medical_aid_providers 
      SET logo_url = $1, updated_at = NOW() 
      WHERE logo_url IS NULL OR logo_url = ''
    `;
    
    try {
      const result = await dbClient.query(setDefaultQuery, [defaultLogoUrl]);
      console.log(`✅ Set default logo for ${result.rowCount} providers`);
    } catch (err) {
      console.error('❌ Error setting default logos:', err.message);
    }

    // Step 6: Verify the results
    console.log('🔍 Verifying updated medical aid providers...');
    
    const verifyQuery = `
      SELECT id, name, short_name, logo_url 
      FROM medical_aid_providers 
      ORDER BY name
    `;
    
    const { rows: providers } = await dbClient.query(verifyQuery);
    
    console.log('📋 Updated Medical Aid Providers:');
    providers.forEach(provider => {
      console.log(`  - ${provider.name} (${provider.short_name}): ${provider.logo_url}`);
    });

    console.log('\n🎉 Medical aid bucket creation and logo upload completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`  - Created bucket: medical-aid-logos`);
    console.log(`  - Uploaded ${successfulUploads.length} logo files`);
    console.log(`  - Updated ${providers.length} medical aid providers`);
    console.log(`  - All providers now have logo URLs pointing to Supabase storage`);

  } catch (error) {
    console.error('💥 Error in medical aid bucket setup:', error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// Run the function
createMedicalAidBucketAndUpload().catch(console.error);