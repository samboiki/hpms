import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Direct PostgreSQL connection (bolt.new style)
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

// Supabase config for storage (we'll try with anon key for storage)
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU1MTA4MjcsImV4cCI6MjAzMTA4NjgyN30.O6rGtqCxvEinNL1qKkUwEOBU3ynJdwGUMAyvIBLZ6Ks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Logo files information
const logoFiles = [
  { filename: 'MAG1.png', provider: 'Gemhealth', reference: 'MAG1' },
  { filename: 'NAMM.png', provider: 'Nammed', reference: 'NAMM' },
  { filename: 'NHPM.png', provider: 'Namibia Health Plan', reference: 'NHPM' },
  { filename: 'NMC1.png', provider: 'Namibia Medical Care', reference: 'NMC1' },
  { filename: 'PROS.png', provider: 'Renaissance', reference: 'PROS' }
];

async function executeDatabaseUpdates() {
  console.log('🗄️ Starting database operations with direct PostgreSQL connection...');
  
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database via direct PostgreSQL');
    
    // Step 1: Add medical_aid_reference column
    console.log('📝 Adding medical_aid_reference column...');
    await client.query(`
      ALTER TABLE medical_aid_providers 
      ADD COLUMN IF NOT EXISTS medical_aid_reference VARCHAR(10);
    `);
    console.log('✅ Column added/verified');
    
    // Step 2: Update each provider
    for (const logo of logoFiles) {
      console.log(`📝 Updating ${logo.provider}...`);
      
      const logoUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${logo.filename}`;
      
      const result = await client.query(`
        UPDATE medical_aid_providers 
        SET 
          medical_aid_reference = $1,
          logo_url = $2
        WHERE name ILIKE $3
      `, [logo.reference, logoUrl, `%${logo.provider}%`]);
      
      if (result.rowCount > 0) {
        console.log(`✅ Updated ${logo.provider} (${result.rowCount} rows)`);
      } else {
        console.log(`⚠️ No provider found matching "${logo.provider}"`);
      }
    }
    
    // Step 3: Verify updates
    console.log('🔍 Verifying database updates...');
    const result = await client.query(`
      SELECT name, medical_aid_reference, logo_url 
      FROM medical_aid_providers 
      WHERE medical_aid_reference IS NOT NULL
      ORDER BY name
    `);
    
    console.log('\n📊 Updated providers:');
    result.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.medical_aid_reference}`);
      console.log(`    Logo: ${row.logo_url}`);
    });
    
    console.log(`\n✅ Database updates completed (${result.rows.length} providers updated)`);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

async function tryStorageUpload() {
  console.log('📤 Attempting to upload logos to storage...');
  
  const logoDir = '/home/happy/projects/hpms/public/medical aids';
  let uploadSuccess = false;
  
  for (const logo of logoFiles) {
    const filePath = path.join(logoDir, logo.filename);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`📤 Attempting upload: ${logo.filename} (${fileBuffer.length} bytes)`);
      
      const { data, error } = await supabase.storage
        .from('medical-aid-logos')
        .upload(logo.filename, fileBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.log(`⚠️ Storage upload failed for ${logo.filename}: ${error.message}`);
      } else {
        console.log(`✅ Successfully uploaded ${logo.filename}`);
        uploadSuccess = true;
      }
      
    } catch (error) {
      console.log(`❌ Error with ${logo.filename}: ${error.message}`);
    }
  }
  
  return uploadSuccess;
}

async function listExistingFiles() {
  console.log('📋 Checking existing files in medical-aid-logos bucket...');
  
  try {
    const { data, error } = await supabase.storage
      .from('medical-aid-logos')
      .list();
    
    if (error) {
      console.log('❌ Error listing files:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('📁 Existing files in bucket:');
      data.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
      });
      return true;
    } else {
      console.log('📭 No files found in bucket');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error checking files:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Medical Aid Logo and Reference Setup');
    console.log('=====================================\n');
    
    // Step 1: Execute database updates (this will work with direct connection)
    await executeDatabaseUpdates();
    
    // Step 2: Check existing files in storage
    const hasExistingFiles = await listExistingFiles();
    
    // Step 3: Try to upload files (might fail due to permissions)
    const uploadWorked = await tryStorageUpload();
    
    if (!uploadWorked && !hasExistingFiles) {
      console.log('\n⚠️ Storage upload failed. Manual upload required:');
      console.log('1. Go to Supabase Dashboard > Storage > medical-aid-logos');
      console.log('2. Upload these files from /home/happy/projects/hpms/public/medical aids/:');
      logoFiles.forEach(logo => {
        console.log(`   - ${logo.filename}`);
      });
      console.log('\n📝 Database has been updated with the correct logo URLs');
      console.log('💡 Once files are uploaded manually, the system will work correctly');
    }
    
    console.log('\n🎉 Setup process completed!');
    console.log('\nNext steps:');
    console.log('1. Verify the medical aid logos are accessible');
    console.log('2. Test the medical aid form to ensure logos display correctly');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();