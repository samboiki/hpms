#!/usr/bin/env node

/**
 * Performance Optimization: Create Database Indexes
 *
 * This script creates indexes on the most commonly queried columns
 * to improve query performance across the HPMS application.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const indexCreationSQL = `
-- ====================================================================
-- PERFORMANCE OPTIMIZATION: DATABASE INDEXES
-- ====================================================================
-- Created: ${new Date().toISOString()}
-- Purpose: Improve query performance on commonly queried columns
-- ====================================================================

-- Index on users table
CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on patients table
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS idx_patients_first_name ON patients(first_name);

-- Index on visits table (CRITICAL - visits is the primary table for appointments and medical encounters)
CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);

-- Index on appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_practice_id ON appointments(practice_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

-- Index on practices table
CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status);

-- Index on branches table
CREATE INDEX IF NOT EXISTS idx_branches_practice_id ON branches(practice_id);

-- Index on practice_settings table (composite index for key lookups)
CREATE INDEX IF NOT EXISTS idx_practice_settings_practice_id_key ON practice_settings(practice_id, setting_key);

-- Index on invoices_enhanced table
CREATE INDEX IF NOT EXISTS idx_invoices_practice_id ON invoices_enhanced(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices_enhanced(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices_enhanced(created_at);

-- Index on medical_aid_details
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_patient_id ON medical_aid_details(patient_id);
`;

async function createPerformanceIndexes() {
  console.log('🚀 Starting Performance Index Creation...\n');
  console.log('📊 Creating indexes on commonly queried columns...\n');

  try {
    // Execute the index creation SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: indexCreationSQL
    });

    if (error) {
      // If exec_sql RPC doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql RPC not found, attempting direct execution...\n');

      // Split into individual statements and execute
      const statements = indexCreationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      let successCount = 0;
      let failureCount = 0;
      const failures = [];

      for (const statement of statements) {
        try {
          const { error: execError } = await supabase.rpc('execute', {
            query: statement
          });

          if (execError) {
            console.log(`❌ Failed: ${statement.substring(0, 80)}...`);
            console.log(`   Error: ${execError.message}\n`);
            failureCount++;
            failures.push({ statement, error: execError.message });
          } else {
            console.log(`✅ Created: ${statement.substring(0, 80)}...`);
            successCount++;
          }
        } catch (e) {
          console.log(`❌ Exception: ${statement.substring(0, 80)}...`);
          console.log(`   Error: ${e.message}\n`);
          failureCount++;
          failures.push({ statement, error: e.message });
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('📊 EXECUTION SUMMARY');
      console.log('='.repeat(70));
      console.log(`✅ Successful: ${successCount} indexes`);
      console.log(`❌ Failed: ${failureCount} indexes`);

      if (failures.length > 0) {
        console.log('\n⚠️  FAILURES DETAIL:');
        failures.forEach((f, i) => {
          console.log(`\n${i + 1}. ${f.statement.substring(0, 100)}...`);
          console.log(`   Error: ${f.error}`);
        });
      }

      console.log('\n' + '='.repeat(70));

      if (failureCount === 0) {
        console.log('\n🎉 All indexes created successfully!');
        console.log('⚡ Query performance should be significantly improved.');
      } else {
        console.log('\n⚠️  Some indexes could not be created.');
        console.log('💡 This is usually OK if indexes already exist or table schema differs.');
      }

    } else {
      console.log('✅ All indexes created successfully!');
      console.log('📊 Data:', data);
    }

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Execute
createPerformanceIndexes()
  .then(() => {
    console.log('\n✨ Index creation process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
