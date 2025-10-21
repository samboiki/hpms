#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Client } = pg;

// Extract connection info from Supabase URL
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Parse the Supabase URL to get the project ID
const projectId = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];

if (!projectId || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Construct PostgreSQL connection string
const connectionString = `postgresql://postgres.${projectId}:${SUPABASE_SERVICE_KEY}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

async function addDepartmentIdColumn() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Check if hospital_wards table exists
    console.log('🔍 Checking if hospital_wards table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'hospital_wards'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;
    if (!tableExists) {
      console.log('❌ hospital_wards table does not exist');
      return;
    }

    console.log('✅ hospital_wards table exists');

    // Check if departments table exists
    console.log('🔍 Checking if departments table exists...');
    const deptCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'departments'
      );
    `);

    const deptExists = deptCheck.rows[0].exists;
    if (!deptExists) {
      console.log('❌ departments table does not exist - cannot create foreign key reference');
      return;
    }

    console.log('✅ departments table exists');

    // Get current schema of hospital_wards table
    console.log('🔍 Checking current schema of hospital_wards table...');
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'hospital_wards'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current hospital_wards table schema:');
    schemaResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Check if department_id column already exists
    const departmentIdExists = schemaResult.rows.some(col => col.column_name === 'department_id');

    if (departmentIdExists) {
      console.log('✅ department_id column already exists in hospital_wards table');
    } else {
      console.log('📝 Adding department_id column...');

      // Add the department_id column
      await client.query(`
        ALTER TABLE hospital_wards
        ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
      `);

      console.log('✅ Successfully added department_id column');
    }

    // Check if index exists
    console.log('🔍 Checking for index on department_id...');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'hospital_wards'
      AND indexname LIKE '%department_id%';
    `);

    if (indexResult.rows.length > 0) {
      console.log('✅ Index on department_id already exists:');
      indexResult.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
    } else {
      console.log('📝 Creating index on department_id...');

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id
        ON hospital_wards(department_id);
      `);

      console.log('✅ Successfully created index idx_hospital_wards_department_id');
    }

    // Final verification
    console.log('🔍 Final verification of hospital_wards table schema...');
    const finalResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'hospital_wards'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Final hospital_wards table schema:');
    finalResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Details:', error.detail);
    }
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
addDepartmentIdColumn();