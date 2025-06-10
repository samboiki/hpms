import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase configuration with service role
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTUxMDgyNywiZXhwIjoyMDMxMDg2ODI3fQ.4_2k2vFPWyFqNuGgJ8tT_QLwTcfvUgdKKvhz_RM5N-c';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Logo files to upload
const logoFiles = [
  { filename: 'MAG1.png', provider: 'Gemhealth', reference: 'MAG1' },
  { filename: 'NAMM.png', provider: 'Nammed', reference: 'NAMM' },
  { filename: 'NHPM.png', provider: 'Namibia Health Plan', reference: 'NHPM' },
  { filename: 'NMC1.png', provider: 'Namibia Medical Care', reference: 'NMC1' },
  { filename: 'PROS.png', provider: 'Renaissance', reference: 'PROS' }
];

async function ensureBucketExists() {
  console.log('🪣 Checking medical-aid-logos bucket...');
  
  // List buckets to check if it exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.log('❌ Error listing buckets:', listError.message);
    return false;
  }
  
  const bucketExists = buckets.some(bucket => bucket.name === 'medical-aid-logos');
  
  if (!bucketExists) {
    console.log('📦 Creating medical-aid-logos bucket...');
    const { data, error } = await supabase.storage.createBucket('medical-aid-logos', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
      fileSizeLimit: 5242880 // 5MB
    });
    
    if (error) {
      console.log('❌ Error creating bucket:', error.message);
      return false;
    }
    
    console.log('✅ Bucket created successfully');
  } else {
    console.log('✅ Bucket already exists');
  }
  
  return true;
}

async function uploadLogos() {
  console.log('🚀 Starting medical aid logo upload process...');
  
  const logoDir = '/home/happy/projects/hpms/public/medical aids';
  
  for (const logo of logoFiles) {
    const filePath = path.join(logoDir, logo.filename);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        continue;
      }
      
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`📤 Uploading ${logo.filename} (${fileBuffer.length} bytes)...`);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('medical-aid-logos')
        .upload(logo.filename, fileBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true // Overwrite if exists
        });
      
      if (error) {
        console.log(`❌ Upload failed for ${logo.filename}:`, error.message);
        
        // Try to remove and re-upload
        console.log(`🔄 Attempting to remove and re-upload ${logo.filename}...`);
        await supabase.storage.from('medical-aid-logos').remove([logo.filename]);
        
        const { data: retryData, error: retryError } = await supabase.storage
          .from('medical-aid-logos')
          .upload(logo.filename, fileBuffer, {
            contentType: 'image/png',
            cacheControl: '3600'
          });
          
        if (retryError) {
          console.log(`❌ Retry failed for ${logo.filename}:`, retryError.message);
        } else {
          console.log(`✅ Successfully uploaded ${logo.filename} on retry`);
        }
      } else {
        console.log(`✅ Successfully uploaded ${logo.filename}`);
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${logo.filename}:`, error.message);
    }
  }
}

async function updateDatabase() {
  console.log('🗄️ Starting database update...');
  
  try {
    // Add medical_aid_reference column if it doesn't exist
    console.log('📝 Adding medical_aid_reference column...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE medical_aid_providers ADD COLUMN IF NOT EXISTS medical_aid_reference VARCHAR(10);`
    });
    
    if (alterError) {
      console.log('❌ Error adding column:', alterError.message);
      // Try direct approach
      const { error: directError } = await supabase
        .from('medical_aid_providers')
        .select('medical_aid_reference')
        .limit(1);
        
      if (directError && directError.message.includes('column "medical_aid_reference" does not exist')) {
        console.log('⚠️ Column does not exist, will need manual creation');
      }
    }
    
    // Update each provider with reference and logo URL
    for (const logo of logoFiles) {
      console.log(`📝 Updating ${logo.provider}...`);
      
      const logoUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${logo.filename}`;
      
      // Try to update using Supabase client
      const { data, error } = await supabase
        .from('medical_aid_providers')
        .update({
          medical_aid_reference: logo.reference,
          logo_url: logoUrl
        })
        .ilike('name', `%${logo.provider}%`);
      
      if (error) {
        console.log(`❌ Error updating ${logo.provider}:`, error.message);
      } else {
        console.log(`✅ Updated ${logo.provider} with reference ${logo.reference}`);
      }
    }
    
    // Verify updates
    console.log('🔍 Verifying updates...');
    const { data: providers, error: selectError } = await supabase
      .from('medical_aid_providers')
      .select('name, medical_aid_reference, logo_url')
      .not('medical_aid_reference', 'is', null);
    
    if (selectError) {
      console.log('❌ Error verifying updates:', selectError.message);
    } else {
      console.log('\n📊 Updated providers:');
      providers.forEach(row => {
        console.log(`  - ${row.name}: ${row.medical_aid_reference} -> ${row.logo_url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

async function main() {
  try {
    // Step 1: Ensure bucket exists
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
      console.log('❌ Could not create or access bucket');
      return;
    }
    
    // Step 2: Upload logos
    await uploadLogos();
    
    // Step 3: Update database
    await updateDatabase();
    
    console.log('\n🎉 Medical aid logo setup completed!');
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    process.exit(1);
  }
}

main();