#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function executeDentalMigrationStep1() {
  console.log('🦷 Executing Dental Migration Step 1...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Read and execute Step 1: Add columns
    const step1Sql = fs.readFileSync('/home/happy/projects/hpms/STEP1_ADD_COLUMNS_SAFE.sql', 'utf8');
    console.log('📋 Executing Step 1: Adding required columns...');
    await client.query(step1Sql);
    console.log('✅ Step 1 completed - columns added!\n');
    
    // Verify table structure
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Updated practice_tariffs table structure:');
    rows.forEach(row => {
      console.log(`   • ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n✅ Step 1 completed successfully! Ready for Step 2.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('connect')) {
      console.log('\n💡 Connection issue - trying alternative approaches...');
    }
  } finally {
    await client.end();
  }
}

// Execute Step 1
try {
  await executeDentalMigrationStep1();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}