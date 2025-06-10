#!/usr/bin/env node

import pg from 'pg';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function checkMedicalAidProvidersTable() {
  console.log('🔍 Checking medical_aid_providers table structure...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Check if table exists
    console.log('🔍 Checking if medical_aid_providers table exists...');
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'medical_aid_providers'
      );
    `;
    const tableExists = await client.query(tableExistsQuery);
    console.log(`Table exists: ${tableExists.rows[0].exists}\n`);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Table medical_aid_providers does not exist');
      return;
    }

    // Check table structure
    console.log('📋 TABLE STRUCTURE:');
    const structureQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await client.query(structureQuery);
    console.table(structureResult.rows);

    // Check existing data
    console.log('\n📊 SAMPLE DATA:');
    const dataQuery = 'SELECT * FROM medical_aid_providers LIMIT 5;';
    const dataResult = await client.query(dataQuery);
    
    if (dataResult.rows.length > 0) {
      console.table(dataResult.rows);
    } else {
      console.log('No data found in table');
    }

    // Check total count
    const countQuery = 'SELECT COUNT(*) as total_records FROM medical_aid_providers;';
    const countResult = await client.query(countQuery);
    console.log(`\n📈 Total records: ${countResult.rows[0].total_records}`);

    // Check for any existing logo-related columns
    console.log('\n🔍 CHECKING FOR LOGO-RELATED COLUMNS:');
    const logoColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      AND (column_name ILIKE '%logo%' OR column_name ILIKE '%image%' OR column_name ILIKE '%reference%');
    `;
    const logoColumns = await client.query(logoColumnsQuery);
    
    if (logoColumns.rows.length > 0) {
      console.log('Found logo-related columns:');
      logoColumns.rows.forEach(row => console.log(`- ${row.column_name}`));
    } else {
      console.log('No logo-related columns found');
    }

    // Show all provider names for reference
    console.log('\n📋 ALL PROVIDER NAMES:');
    const providersQuery = 'SELECT DISTINCT name FROM medical_aid_providers ORDER BY name;';
    const providersResult = await client.query(providersQuery);
    providersResult.rows.forEach(row => console.log(`- ${row.name}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 To fix this:');
    console.log('   1. Check your database connection');
    console.log('   2. Verify the table exists');
    console.log('   3. Check database permissions');
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Check if pg module is available
try {
  await checkMedicalAidProvidersTable();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}