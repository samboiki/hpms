#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndAddDepartmentIdColumn() {
  try {
    console.log('🔍 Checking current schema of hospital_wards table...');

    // First, check if the hospital_wards table exists and get its schema
    const { data: columns, error: schemaError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT column_name, data_type, is_nullable
                  FROM information_schema.columns
                  WHERE table_name = 'hospital_wards'
                  AND table_schema = 'public'
                  ORDER BY ordinal_position;`
    });

    if (schemaError) {
      console.error('❌ Error checking table schema:', schemaError);
      return;
    }

    console.log('📄 Raw response:', JSON.stringify(columns, null, 2));

    if (!columns || (Array.isArray(columns) && columns.length === 0)) {
      console.error('❌ hospital_wards table does not exist');
      return;
    }

    // Handle different response formats
    let columnsArray;
    if (Array.isArray(columns)) {
      columnsArray = columns;
    } else if (columns.data && Array.isArray(columns.data)) {
      columnsArray = columns.data;
    } else if (columns.rows && Array.isArray(columns.rows)) {
      columnsArray = columns.rows;
    } else {
      console.error('❌ Unexpected response format:', columns);
      return;
    }

    console.log('✅ Found hospital_wards table with columns:');
    columnsArray.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Check if department_id column already exists
    const departmentIdExists = columnsArray.some(col => col.column_name === 'department_id');

    if (departmentIdExists) {
      console.log('✅ department_id column already exists in hospital_wards table');
    } else {
      console.log('📝 department_id column does not exist. Adding it...');

      // Add the department_id column
      const { error: addColumnError } = await supabase.rpc('exec_raw_sql', {
        sql_query: `ALTER TABLE hospital_wards
                    ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;`
      });

      if (addColumnError) {
        console.error('❌ Error adding department_id column:', addColumnError);
        return;
      }

      console.log('✅ Successfully added department_id column to hospital_wards table');
    }

    // Check if index exists
    console.log('🔍 Checking if index on department_id exists...');

    const { data: indexes, error: indexError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT indexname, indexdef
                  FROM pg_indexes
                  WHERE tablename = 'hospital_wards'
                  AND indexname LIKE '%department_id%';`
    });

    if (indexError) {
      console.error('❌ Error checking indexes:', indexError);
      return;
    }

    const indexExists = indexes && indexes.length > 0;

    if (indexExists) {
      console.log('✅ Index on department_id already exists:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
      });
    } else {
      console.log('📝 Creating index on department_id...');

      const { error: createIndexError } = await supabase.rpc('exec_raw_sql', {
        sql_query: `CREATE INDEX IF NOT EXISTS idx_hospital_wards_department_id
                    ON hospital_wards(department_id);`
      });

      if (createIndexError) {
        console.error('❌ Error creating index:', createIndexError);
        return;
      }

      console.log('✅ Successfully created index idx_hospital_wards_department_id');
    }

    // Final verification - check the updated schema
    console.log('🔍 Final verification of hospital_wards table schema...');

    const { data: finalColumns, error: finalError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT column_name, data_type, is_nullable
                  FROM information_schema.columns
                  WHERE table_name = 'hospital_wards'
                  AND table_schema = 'public'
                  ORDER BY ordinal_position;`
    });

    if (finalError) {
      console.error('❌ Error in final verification:', finalError);
      return;
    }

    console.log('✅ Final hospital_wards table schema:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the migration
checkAndAddDepartmentIdColumn();