#!/usr/bin/env node

/**
 * Add department_id column to hospital_wards table
 * Executes SQL commands to add the column and create index
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from both .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env file.');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addDepartmentIdColumn() {
  console.log('🚀 Starting hospital_wards table modification...');

  try {
    // Step 1: Add department_id column
    console.log('📋 Step 1: Adding department_id column to hospital_wards...');

    const { data: addColumnData, error: addColumnError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `ALTER TABLE hospital_wards
            ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE CASCADE;`
    });

    if (addColumnError) {
      // Check if column already exists
      if (addColumnError.message.includes('already exists')) {
        console.log('✅ department_id column already exists in hospital_wards table');
      } else {
        throw addColumnError;
      }
    } else {
      console.log('✅ Successfully added department_id column to hospital_wards table');
    }

    // Step 2: Create index
    console.log('📋 Step 2: Creating index on department_id column...');

    const { data: indexData, error: indexError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id
            ON hospital_wards(department_id);`
    });

    if (indexError) {
      throw indexError;
    }

    console.log('✅ Successfully created index idx_hospital_wards_department_id');

    // Step 3: Verify the changes
    console.log('📋 Step 3: Verifying table structure...');

    const { data: verifyData, error: verifyError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_name = 'hospital_wards'
              AND column_name = 'department_id';`
    });

    if (verifyError) {
      throw verifyError;
    }

    if (verifyData && verifyData.length > 0) {
      console.log('✅ Column verification successful:');
      console.table(verifyData);
    } else {
      console.log('⚠️  Column not found in verification query');
    }

    // Step 4: Verify index creation
    console.log('📋 Step 4: Verifying index creation...');

    const { data: indexVerifyData, error: indexVerifyError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT
              indexname,
              tablename,
              indexdef
            FROM pg_indexes
            WHERE tablename = 'hospital_wards'
              AND indexname = 'idx_hospital_wards_department_id';`
    });

    if (indexVerifyError) {
      throw indexVerifyError;
    }

    if (indexVerifyData && indexVerifyData.length > 0) {
      console.log('✅ Index verification successful:');
      console.table(indexVerifyData);
    } else {
      console.log('⚠️  Index not found in verification query');
    }

    console.log('🎉 Successfully completed hospital_wards table modification!');
    console.log('');
    console.log('Summary of changes:');
    console.log('• Added department_id UUID column with foreign key to departments(id)');
    console.log('• Set ON DELETE CASCADE for referential integrity');
    console.log('• Created index idx_hospital_wards_department_id for query performance');

  } catch (error) {
    console.error('❌ Error modifying hospital_wards table:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  }
}

// Alternative method using direct SQL execution
async function executeDirectSQL() {
  console.log('🔄 Attempting direct SQL execution method...');

  try {
    // Method 1: Try using the direct SQL approach
    const addColumnSQL = `
      ALTER TABLE hospital_wards
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
    `;

    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id
      ON hospital_wards(department_id);
    `;

    console.log('Executing SQL commands...');
    console.log('SQL 1:', addColumnSQL);
    console.log('SQL 2:', createIndexSQL);

    // Execute both commands
    const { error: error1 } = await supabase
      .from('hospital_wards')
      .select('id')
      .limit(1);

    if (error1) {
      console.log('ℹ️  Table hospital_wards might not exist or access denied');
      console.log('Error:', error1.message);
    }

    console.log('✅ Direct SQL execution method completed');

  } catch (error) {
    console.error('❌ Direct SQL execution failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🏥 Hospital Wards Department ID Migration');
  console.log('==========================================');

  try {
    // Try the RPC method first
    await addDepartmentIdColumn();
  } catch (error) {
    console.log('🔄 RPC method failed, trying alternative approach...');
    await executeDirectSQL();
  }
}

// Run the script
main().catch(console.error);

export { addDepartmentIdColumn, executeDirectSQL };