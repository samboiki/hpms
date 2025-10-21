#!/usr/bin/env node

/**
 * DIRECT DATABASE INDEX CREATION
 * Uses PostgreSQL driver to create indexes directly
 * Project ID: jjxlfunlbyayxwvlpgwt
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Construct connection string from Supabase URL
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const projectRef = supabaseUrl.split('//')[1].split('.')[0];
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD environment variable is required');
  console.error('💡 Set it in your .env file');
  process.exit(1);
}

const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;

const indexes = [
  { name: 'idx_users_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_id ON users(practice_id);', table: 'users' },
  { name: 'idx_users_email', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);', table: 'users' },
  { name: 'idx_patients_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);', table: 'patients' },
  { name: 'idx_patients_last_name', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_last_name ON patients(last_name);', table: 'patients' },
  { name: 'idx_patients_first_name', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_first_name ON patients(first_name);', table: 'patients' },
  { name: 'idx_visits_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);', table: 'visits' },
  { name: 'idx_visits_patient_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);', table: 'visits' },
  { name: 'idx_visits_scheduled_date', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);', table: 'visits' },
  { name: 'idx_visits_doctor_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);', table: 'visits' },
  { name: 'idx_appointments_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_practice_id ON appointments(practice_id);', table: 'appointments' },
  { name: 'idx_appointments_patient_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);', table: 'appointments' },
  { name: 'idx_appointments_date', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_date ON appointments(date);', table: 'appointments' },
  { name: 'idx_practices_status', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practices_status ON practices(status);', table: 'practices' },
  { name: 'idx_branches_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_practice_id ON branches(practice_id);', table: 'branches' },
  { name: 'idx_practice_settings_practice_id_key', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practice_settings_practice_id_key ON practice_settings(practice_id, setting_key);', table: 'practice_settings' },
  { name: 'idx_invoices_practice_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_practice_id ON invoices_enhanced(practice_id);', table: 'invoices_enhanced' },
  { name: 'idx_invoices_payment_status', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_payment_status ON invoices_enhanced(payment_status);', table: 'invoices_enhanced' },
  { name: 'idx_invoices_created_at', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_created_at ON invoices_enhanced(created_at);', table: 'invoices_enhanced' },
  { name: 'idx_medical_aid_details_patient_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medical_aid_details_patient_id ON medical_aid_details(patient_id);', table: 'medical_aid_details' }
];

async function createIndexes() {
  const client = new Client({ connectionString });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('🚀 Performance Index Creation Starting...');
    console.log(`📊 Creating ${indexes.length} indexes to optimize query performance\n`);

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    const failures = [];

    for (const index of indexes) {
      try {
        console.log(`⚡ Creating index: ${index.name} on ${index.table}...`);

        // First check if index already exists
        const checkResult = await client.query(
          `SELECT 1 FROM pg_indexes WHERE indexname = $1`,
          [index.name]
        );

        if (checkResult.rows.length > 0) {
          console.log(`   ⏭️  ${index.name} already exists, skipping`);
          skippedCount++;
          continue;
        }

        // Create index with CONCURRENTLY to avoid locking
        await client.query(index.sql);

        console.log(`   ✅ ${index.name} created successfully`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Failed to create ${index.name}:`, error.message);
        failureCount++;
        failures.push({ index: index.name, table: index.table, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE INDEX CREATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Created: ${successCount}/${indexes.length}`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount}/${indexes.length}`);
    console.log(`❌ Failed: ${failureCount}/${indexes.length}`);

    if (failures.length > 0) {
      console.log('\n⚠️  Failed Indexes:');
      failures.forEach(f => {
        console.log(`   - ${f.index} (${f.table}): ${f.error}`);
      });
    }

    console.log('\n🎯 Expected Performance Improvement:');
    console.log('   ⚡ Query time: 2-4 seconds → <100ms (95%+ improvement)');
    console.log('   📊 Dashboard load: Significant speedup');
    console.log('   🔍 Patient search: Near-instant results');
    console.log('   📅 Visit queries: Optimized for scheduled_date lookups');
    console.log('   🏥 Practice isolation: Faster multi-tenant queries');

    if (successCount + skippedCount === indexes.length) {
      console.log('\n🎉 All indexes are now in place!');
      console.log('⚡ Your database is optimized for maximum performance.');
    } else {
      console.log('\n⚠️  Some indexes failed. Please check the errors above.');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed.');
  }
}

createIndexes().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
