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

async function executePracticeTypesMigration() {
  console.log('🚀 Executing practice types normalization migration like bolt.new does...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Read and execute practice types normalization migration
    const migrationPath = '/home/happy/projects/hpms/supabase/migrations/20250609_practice_types_normalization.sql';
    console.log('📋 Reading migration file:', migrationPath);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('🏗️  Executing practice types normalization migration...');
    
    await client.query(migrationSQL);
    console.log('✅ Practice types normalization migration completed!\n');
    
    // Verify the setup
    console.log('🔍 Verifying the migration results...\n');
    
    // Check practice_types table
    const { rows: practiceTypes } = await client.query("SELECT * FROM practice_types ORDER BY name");
    console.log('📋 Practice types created:');
    practiceTypes.forEach(type => {
      console.log(`   • ${type.name}: ${type.description} (ID: ${type.id})`);
    });
    
    // Check practice_tariffs_with_types view
    const { rows: viewStats } = await client.query(`
      SELECT 
        practice_type_name,
        COUNT(*) as tariff_count
      FROM practice_tariffs_with_types 
      GROUP BY practice_type_name
      ORDER BY practice_type_name
    `);
    
    console.log('\n📊 Tariffs by practice type (from view):');
    viewStats.forEach(stat => {
      console.log(`   • ${stat.practice_type_name}: ${stat.tariff_count} codes`);
    });
    
    // Sample data from view
    const { rows: sampleData } = await client.query(`
      SELECT code, description, practice_type_name 
      FROM practice_tariffs_with_types 
      WHERE practice_type_name = 'dental'
      ORDER BY code
      LIMIT 5
    `);
    
    console.log('\n📋 Sample dental codes from view:');
    sampleData.forEach(row => {
      console.log(`   ${row.code}: ${row.description} (${row.practice_type_name})`);
    });
    
    // Check that the 179 dental codes are accessible
    const { rows: totalDentalCodes } = await client.query(`
      SELECT COUNT(*) as count 
      FROM practice_tariffs_with_types 
      WHERE practice_type_name = 'dental'
    `);
    
    const dentalCodeCount = totalDentalCodes[0].count;
    console.log(`\n🦷 Total dental codes in view: ${dentalCodeCount}`);
    
    if (dentalCodeCount >= 179) {
      console.log('✅ SUCCESS: All 179+ dental codes are accessible through the view!');
    } else {
      console.log('⚠️  WARNING: Expected 179 dental codes, but only found', dentalCodeCount);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Created practice_types lookup table');
    console.log('   ✅ Added practice_type_id FK to practices table');
    console.log('   ✅ Added practice_type_id FK to practice_tariffs table');
    console.log('   ✅ Created practice_tariffs_with_types view');
    console.log('   ✅ Set up proper RLS policies');
    console.log('\n🎯 Next step: Update EnhancedServiceSelector to use the view');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Error details:');
    console.log(error.stack);
  } finally {
    await client.end();
  }
}

// Check if pg module is available
try {
  await executePracticeTypesMigration();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}