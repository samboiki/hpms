#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function analyzeMedicalAids() {
  console.log('🏥 Medical Aid Reference Analysis');
  console.log('=================================\n');
  
  // Show available logo files
  console.log('📂 Available Logo Files in /public/medical aids/:');
  console.log('   - MAG1.png');
  console.log('   - NAMM.png');
  console.log('   - NHPM.png');
  console.log('   - NMC1.png');
  console.log('   - PROS.png\n');
  
  // Show sample data references
  console.log('📊 Sample Data References (from filename patterns):');
  console.log('   - MAG1 (Magnum Medical Aid)');
  console.log('   - MAG2 (Magnum Medical Aid - different scheme)');
  console.log('   - NAMM (Nammed Medical Aid)');
  console.log('   - NHPM (Namibia Health Plan)');
  console.log('   - NMC1 (Namibia Medical Care)');
  console.log('   - PROS (Prosperity Health - likely)\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check if medical_aid_reference column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      AND column_name = 'medical_aid_reference';
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('⚠️  Column "medical_aid_reference" does not exist in medical_aid_providers table');
      console.log('   Current table structure:');
      
      const tableStructure = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'medical_aid_providers' 
        ORDER BY ordinal_position;
      `);
      
      tableStructure.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      console.log('\n💡 Suggested Solution:');
      console.log('   1. Add medical_aid_reference column to medical_aid_providers table');
      console.log('   2. Update existing providers with reference codes');
      console.log('   3. Update logo_url to use reference-based filenames\n');
    }
    
    // Get current providers
    const providers = await client.query(`
      SELECT id, name, short_name, logo_url 
      FROM medical_aid_providers 
      ORDER BY name;
    `);
    
    console.log('📋 Current Medical Aid Providers in Database:');
    console.log('===========================================');
    providers.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   Short Name: ${row.short_name}`);
      console.log(`   Logo URL: ${row.logo_url || 'NULL'}`);
      console.log('');
    });
    
    // Suggest mapping
    console.log('🔄 Suggested Reference Code Mapping:');
    console.log('===================================');
    
    const suggestedMapping = [
      { name: 'Namibia Medical Care', short_name: 'NMC', reference: 'NMC1', logo: 'NMC1.png' },
      { name: 'Namibia Health Plan', short_name: 'NHP', reference: 'NHPM', logo: 'NHPM.png' },
      { name: 'Nammed Medical Aid Fund', short_name: 'Nammed', reference: 'NAMM', logo: 'NAMM.png' },
      { name: 'Gemhealth Medical Aid', short_name: 'Gemhealth', reference: 'MAG1', logo: 'MAG1.png' },
      { name: 'Renaissance Health Medical Aid Fund', short_name: 'Renaissance', reference: 'PROS', logo: 'PROS.png' }
    ];
    
    suggestedMapping.forEach(mapping => {
      console.log(`${mapping.name}:`);
      console.log(`  Reference Code: ${mapping.reference}`);
      console.log(`  Logo File: /public/medical aids/${mapping.logo}`);
      console.log('');
    });
    
    console.log('📝 SQL to Add Reference Column and Update Data:');
    console.log('===============================================');
    console.log(`
-- Add medical_aid_reference column
ALTER TABLE medical_aid_providers 
ADD COLUMN IF NOT EXISTS medical_aid_reference TEXT;

-- Update with reference codes
UPDATE medical_aid_providers SET medical_aid_reference = 'NMC1' WHERE short_name = 'NMC';
UPDATE medical_aid_providers SET medical_aid_reference = 'NHPM' WHERE short_name = 'NHP';
UPDATE medical_aid_providers SET medical_aid_reference = 'NAMM' WHERE short_name = 'Nammed';
UPDATE medical_aid_providers SET medical_aid_reference = 'MAG1' WHERE short_name = 'Gemhealth';
UPDATE medical_aid_providers SET medical_aid_reference = 'PROS' WHERE short_name = 'Renaissance';

-- Update logo URLs to use reference-based paths
UPDATE medical_aid_providers SET logo_url = '/images/medical-aids/' || medical_aid_reference || '.png' 
WHERE medical_aid_reference IS NOT NULL;

-- Verify the updates
SELECT name, short_name, medical_aid_reference, logo_url 
FROM medical_aid_providers 
ORDER BY medical_aid_reference;
    `);
    
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
  }
}

// Execute the analysis
analyzeMedicalAids().catch(console.error);