#!/usr/bin/env node

import pg from 'pg';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function getMedicalAidReferences() {
  console.log('🏥 Getting Medical Aid Provider References...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    const result = await client.query(`
      SELECT id, name, medical_aid_reference, logo_url 
      FROM medical_aid_providers 
      ORDER BY medical_aid_reference;
    `);
    
    console.log('📋 Medical Aid Providers from Database:');
    console.log('=======================================');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   Reference: ${row.medical_aid_reference}`);
      console.log(`   Logo URL: ${row.logo_url || 'NULL'}`);
      console.log('');
    });
    
    console.log(`Total providers found: ${result.rows.length}\n`);
    
    // Show the available logo files in the public folder
    console.log('🖼️  Available logo files in /public/images/medical-aids/:');
    console.log('=======================================================');
    const logoFiles = ['MAG1.png', 'NAMM.png', 'NHPM.png', 'NMC1.png', 'PROS.png'];
    logoFiles.forEach(file => {
      console.log(`- ${file}`);
    });
    
    console.log('\n🔍 Reference to Logo Mapping Analysis:');
    console.log('=====================================');
    const referenceCodes = ['MAG1', 'NAMM', 'NHPM', 'NMC1', 'PROS'];
    
    result.rows.forEach(row => {
      const ref = row.medical_aid_reference;
      const hasMatchingLogo = referenceCodes.includes(ref);
      const logoFile = hasMatchingLogo ? `${ref}.png` : 'NOT FOUND';
      console.log(`${row.name}:`);
      console.log(`  DB Reference: ${ref}`);
      console.log(`  Logo File: ${logoFile} ${hasMatchingLogo ? '✅' : '❌'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.log('\n💡 Possible issues:');
    console.log('   1. Database connection issue');
    console.log('   2. Table "medical_aid_providers" does not exist');
    console.log('   3. Network connectivity problem');
  } finally {
    await client.end();
  }
}

// Execute the query
getMedicalAidReferences().catch(console.error);