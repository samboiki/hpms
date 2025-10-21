#!/usr/bin/env node

/**
 * Apply practices status constraint migration using direct PostgreSQL connection
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

// Supabase connection details
const connectionString = `postgresql://postgres.jjxlfunlbyayxwvlpgwt:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

async function applyMigration() {
  console.log('🚀 APPLYING PRACTICES STATUS CONSTRAINT MIGRATION');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationPath = './supabase/migrations/20250930_update_practices_status_constraint.sql';
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    console.log('📝 Migration SQL:');
    console.log('-'.repeat(70));
    console.log(sql);
    console.log('-'.repeat(70));
    console.log();

    // Execute migration
    console.log('⚡ Executing migration...');
    await client.query(sql);
    console.log('✅ Migration executed successfully!\n');

    // Verify the constraint exists
    console.log('🔍 Verifying constraint...');
    const verifyQuery = `
      SELECT
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'practices'
        AND con.conname = 'practices_status_check';
    `;

    const result = await client.query(verifyQuery);

    if (result.rows.length > 0) {
      console.log('✅ Constraint verified successfully!');
      console.log('\n📋 Constraint Details:');
      console.log(`   Name: ${result.rows[0].constraint_name}`);
      console.log(`   Definition: ${result.rows[0].definition}`);
    } else {
      console.log('⚠️  Warning: Could not verify constraint (but migration may have succeeded)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📋 New practices status values:');
    console.log('   ✓ lead        - Initial contact/interest');
    console.log('   ✓ contacted   - Practice has been reached out to');
    console.log('   ✓ qualified   - Practice meets criteria for onboarding');
    console.log('   ✓ onboarding  - Practice is in setup process');
    console.log('   ✓ active      - Practice is fully operational');
    console.log('   ✓ inactive    - Practice is not currently active');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERROR DURING MIGRATION:');
    console.error('='.repeat(70));
    console.error(error);
    console.error('='.repeat(70));
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyMigration();