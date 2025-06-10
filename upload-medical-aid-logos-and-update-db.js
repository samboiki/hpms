import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTUxMDgyNywiZXhwIjoyMDMxMDg2ODI3fQ.4_2k2vFPWyFqNuGgJ8tT_QLwTcfvUgdKKvhz_RM5N-c';

// Direct PostgreSQL connection
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

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
      
      // Upload to Supabase storage
      console.log(`📤 Uploading ${logo.filename}...`);
      
      const { data, error } = await supabase.storage
        .from('medical-aid-logos')
        .upload(logo.filename, fileBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true // Overwrite if exists
        });
      
      if (error) {
        console.log(`❌ Upload failed for ${logo.filename}:`, error.message);
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
  
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Add medical_aid_reference column if it doesn't exist
    console.log('📝 Adding medical_aid_reference column...');
    await client.query(`
      ALTER TABLE medical_aid_providers 
      ADD COLUMN IF NOT EXISTS medical_aid_reference VARCHAR(10);
    `);
    
    // Update each provider with reference and logo URL
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
        console.log(`✅ Updated ${logo.provider} with reference ${logo.reference}`);
      } else {
        console.log(`⚠️ No provider found matching ${logo.provider}`);
      }
    }
    
    // Verify updates
    console.log('🔍 Verifying updates...');
    const result = await client.query(`
      SELECT name, medical_aid_reference, logo_url 
      FROM medical_aid_providers 
      WHERE medical_aid_reference IS NOT NULL
      ORDER BY name
    `);
    
    console.log('\n📊 Updated providers:');
    result.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.medical_aid_reference} -> ${row.logo_url}`);
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

async function main() {
  try {
    // Step 1: Upload logos
    await uploadLogos();
    
    // Step 2: Update database
    await updateDatabase();
    
    console.log('\n🎉 Medical aid logo setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    process.exit(1);
  }
}

main();