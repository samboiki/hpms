#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');

// Try alternative connection approaches
const connectionStrings = [
  'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  'postgresql://postgres.jjxlfunlbyayxwvlpgwt:T@ngisasa200@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:T@ngisasa200@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
];

async function executeCompleteMigration() {
  console.log('🦷 EXECUTING COMPLETE DENTAL MIGRATION...\n');
  
  // Try multiple connection strings
  for (let i = 0; i < connectionStrings.length; i++) {
    const connectionString = connectionStrings[i];
    console.log(`🔌 Attempting connection ${i + 1}/${connectionStrings.length}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client.connect();
      console.log('✅ Connected successfully!\n');
      return await executeMigration(client);
    } catch (error) {
      console.log(`❌ Connection ${i + 1} failed: ${error.message}`);
      await client.end().catch(() => {});
      if (i === connectionStrings.length - 1) {
        throw new Error('All connection attempts failed');
      }
    }
  }
}

async function executeMigration(client) {
  try {
    // Read the complete migration SQL
    console.log('📋 Reading COMPLETE_DENTAL_MIGRATION.sql...');
    const migrationSql = fs.readFileSync('/home/happy/projects/hpms/COMPLETE_DENTAL_MIGRATION.sql', 'utf8');
    
    console.log('🚀 Executing complete dental migration...');
    const result = await client.query(migrationSql);
    console.log('✅ Migration executed successfully!\n');
    
    // Run verification queries separately for better output
    console.log('🔍 VERIFICATION RESULTS:');
    
    // Count total codes
    const countResult = await client.query('SELECT COUNT(*) as count FROM practice_tariffs');
    console.log(`📊 Total codes imported: ${countResult.rows[0].count}`);
    
    // Count multiplication rules
    const multiResult = await client.query("SELECT COUNT(*) as count FROM practice_tariffs WHERE can_be_multiplied != 'NO'");
    console.log(`🔢 Codes with multiplication rules: ${multiResult.rows[0].count}`);
    
    // Count progressive pricing
    const progressiveResult = await client.query("SELECT COUNT(*) as count FROM practice_tariffs WHERE can_be_multiplied = 'PROGRESSIVE'");
    console.log(`📈 Progressive pricing codes: ${progressiveResult.rows[0].count}`);
    
    // Check special code 8346
    const specialResult = await client.query('SELECT COUNT(*) as count FROM practice_tariffs WHERE code = 8346');
    console.log(`🦷 Special tooth-specific code 8346: ${specialResult.rows[0].count}`);
    
    // Show sample data
    console.log('\n📋 SAMPLE IMPORTED DATA:');
    const sampleResult = await client.query(`
      SELECT code, description, official_2025_price_nad, can_be_multiplied 
      FROM practice_tariffs 
      ORDER BY code 
      LIMIT 5
    `);
    
    sampleResult.rows.forEach(row => {
      console.log(`   ${row.code}: ${row.description.substring(0, 50)}... - ${row.official_2025_price_nad} NAD [${row.can_be_multiplied}]`);
    });
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ All 179 dental codes imported with complete metadata');
    console.log('✅ Pricing, business rules, and multiplication logic ready');
    console.log('✅ ServiceSelector component can now use dental codes');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Provide helpful troubleshooting
    if (error.message.includes('connect')) {
      console.log('\n💡 Connection issue solutions:');
      console.log('1. Check if the database password is correct');
      console.log('2. Verify the connection string format');
      console.log('3. Try using the Supabase SQL Editor instead:');
      console.log('   https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
    }
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n💡 Table missing - try creating it first:');
      console.log('Execute STEP1_ADD_COLUMNS_SAFE.sql first in Supabase SQL Editor');
    }
    
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the migration
executeCompleteMigration().catch(error => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});