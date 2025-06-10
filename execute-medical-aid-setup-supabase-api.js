import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Use the correct anon key from environment
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false
  }
});

const logoFiles = [
  { filename: 'MAG1.png', provider: 'Methealth', reference: 'MAG1' },
  { filename: 'NAMM.png', provider: 'Nammed', reference: 'NAMM' },
  { filename: 'NHPM.png', provider: 'Namibia Health Plan', reference: 'NHPM' },
  { filename: 'NMC1.png', provider: 'Namibia Medical Care', reference: 'NMC1' },
  { filename: 'PROS.png', provider: 'Prosperity', reference: 'PROS' }
];

async function checkCurrentProviders() {
  console.log('🔍 Checking existing medical aid providers...');
  
  const { data, error } = await supabase
    .from('medical_aid_providers')
    .select('id, name, logo_url')
    .order('name');
    
  if (error) {
    console.log('❌ Error checking providers:', error.message);
    return [];
  }
  
  console.log(`✅ Found ${data.length} providers:`);
  data.forEach(provider => {
    console.log(`  - ${provider.name} (ID: ${provider.id})`);
  });
  
  return data;
}

async function addMedicalAidReferenceColumn() {
  console.log('📝 Adding medical_aid_reference column...');
  
  // Since we can't do DDL directly, let's check if the column exists by trying to select it
  const { data, error } = await supabase
    .from('medical_aid_providers')
    .select('medical_aid_reference')
    .limit(1);
    
  if (error && error.message.includes('column "medical_aid_reference" does not exist')) {
    console.log('⚠️ Column does not exist - needs manual creation in Supabase dashboard');
    console.log('SQL to run in Supabase SQL Editor:');
    console.log('ALTER TABLE medical_aid_providers ADD COLUMN medical_aid_reference VARCHAR(10);');
    return false;
  } else if (error) {
    console.log('❌ Unexpected error:', error.message);
    return false;
  } else {
    console.log('✅ Column already exists or accessible');
    return true;
  }
}

async function updateProvidersWithReferences() {
  console.log('📝 Updating providers with reference codes and logo URLs...');
  
  let updatedCount = 0;
  
  for (const logo of logoFiles) {
    console.log(`\n🔄 Processing ${logo.provider}...`);
    
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${logo.filename}`;
    
    // First, find the provider
    const { data: providers, error: findError } = await supabase
      .from('medical_aid_providers')
      .select('id, name')
      .ilike('name', `%${logo.provider}%`);
      
    if (findError) {
      console.log(`❌ Error finding ${logo.provider}:`, findError.message);
      continue;
    }
    
    if (!providers || providers.length === 0) {
      console.log(`⚠️ No provider found matching "${logo.provider}"`);
      continue;
    }
    
    if (providers.length > 1) {
      console.log(`⚠️ Multiple providers found for "${logo.provider}":`);
      providers.forEach(p => console.log(`  - ${p.name}`));
    }
    
    // Update the first matching provider
    const provider = providers[0];
    console.log(`✅ Found provider: ${provider.name}`);
    
    const updateData = {
      logo_url: logoUrl
    };
    
    // Try to add reference if column exists
    const { error: testError } = await supabase
      .from('medical_aid_providers')
      .select('medical_aid_reference')
      .eq('id', provider.id)
      .limit(1);
      
    if (!testError) {
      updateData.medical_aid_reference = logo.reference;
    }
    
    const { data, error: updateError } = await supabase
      .from('medical_aid_providers')
      .update(updateData)
      .eq('id', provider.id)
      .select();
      
    if (updateError) {
      console.log(`❌ Error updating ${provider.name}:`, updateError.message);
    } else {
      console.log(`✅ Updated ${provider.name} with reference ${logo.reference}`);
      updatedCount++;
    }
  }
  
  return updatedCount;
}

async function uploadLogosToStorage() {
  console.log('\n📤 Attempting to upload logo files...');
  
  const logoDir = '/home/happy/projects/hpms/public/medical aids';
  let uploadedCount = 0;
  
  // First check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.log('❌ Cannot access storage buckets:', listError.message);
    return 0;
  }
  
  const bucketExists = buckets.some(b => b.name === 'medical-aid-logos');
  console.log(`📁 Bucket medical-aid-logos ${bucketExists ? 'exists' : 'does not exist'}`);
  
  if (!bucketExists) {
    console.log('📦 Creating medical-aid-logos bucket...');
    const { error: createError } = await supabase.storage.createBucket('medical-aid-logos', {
      public: true
    });
    
    if (createError) {
      console.log('❌ Cannot create bucket:', createError.message);
      return 0;
    }
    console.log('✅ Bucket created');
  }
  
  // Upload files
  for (const logo of logoFiles) {
    const filePath = path.join(logoDir, logo.filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      continue;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📤 Uploading ${logo.filename} (${fileBuffer.length} bytes)...`);
    
    const { data, error } = await supabase.storage
      .from('medical-aid-logos')
      .upload(logo.filename, fileBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) {
      console.log(`❌ Upload failed for ${logo.filename}:`, error.message);
    } else {
      console.log(`✅ Uploaded ${logo.filename}`);
      uploadedCount++;
    }
  }
  
  return uploadedCount;
}

async function verifySetup() {
  console.log('\n🔍 Verifying final setup...');
  
  const { data, error } = await supabase
    .from('medical_aid_providers')
    .select('name, medical_aid_reference, logo_url')
    .not('logo_url', 'is', null)
    .order('name');
    
  if (error) {
    console.log('❌ Error verifying setup:', error.message);
    return;
  }
  
  console.log('\n📊 Providers with logo URLs:');
  data.forEach(provider => {
    const ref = provider.medical_aid_reference || 'N/A';
    console.log(`  - ${provider.name} [${ref}]`);
    console.log(`    Logo: ${provider.logo_url}`);
  });
  
  console.log(`\n✅ Total providers with logos: ${data.length}`);
}

async function main() {
  try {
    console.log('🚀 Medical Aid Reference and Logo Setup');
    console.log('=====================================\n');
    
    // Step 1: Check existing providers
    const providers = await checkCurrentProviders();
    if (providers.length === 0) {
      console.log('❌ No providers found - setup cannot continue');
      return;
    }
    
    // Step 2: Try to add reference column
    const columnExists = await addMedicalAidReferenceColumn();
    
    // Step 3: Upload logos to storage
    const uploadCount = await uploadLogosToStorage();
    console.log(`\n📊 Upload summary: ${uploadCount}/${logoFiles.length} files uploaded`);
    
    // Step 4: Update providers with references and logo URLs
    const updateCount = await updateProvidersWithReferences();
    console.log(`\n📊 Update summary: ${updateCount}/${logoFiles.length} providers updated`);
    
    // Step 5: Verify setup
    await verifySetup();
    
    if (!columnExists) {
      console.log('\n⚠️  MANUAL STEP REQUIRED:');
      console.log('Run this in Supabase SQL Editor:');
      console.log('ALTER TABLE medical_aid_providers ADD COLUMN medical_aid_reference VARCHAR(10);');
      console.log('Then re-run this script to add the reference codes.');
    }
    
    console.log('\n🎉 Setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();