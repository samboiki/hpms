#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = 'https://dszjkjplqbmghzgsmumf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzempranBscWJtZ2h6Z3NtdW1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM5MzY3NCwiZXhwIjoyMDQ5OTY5Njc0fQ.Kt3kqGhWdYObhqGlKOTr75hYMlgLJPJfGZOEGnQQBj8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigateRelationships() {
  console.log('🔍 Investigating visits table relationships and foreign keys...\n');

  try {
    // Check foreign key constraints on visits table
    console.log('🔗 Foreign key constraints on visits table:');
    const { data: fkResult, error: fkError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.match_option,
            rc.update_rule,
            rc.delete_rule
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
              AND tc.table_schema = rc.constraint_schema
          WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'visits'
          ORDER BY tc.constraint_name;
        `
      });

    if (fkError) {
      console.error('❌ Error fetching FK constraints:', fkError);
    } else {
      console.log('✅ Foreign key constraints result:', fkResult);
    }

    // Check for specific relationships to patients table
    console.log('\n🔍 Specific relationships to patients table:');
    const { data: patientsRel, error: patientsError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'visits'
            AND ccu.table_name = 'patients';
        `
      });

    if (patientsError) {
      console.error('❌ Error checking patients relationships:', patientsError);
    } else {
      console.log('✅ Patients relationships:', patientsRel);
    }

    // Check table structure to see if there are multiple patient_id columns
    console.log('\n📋 Visits table columns containing "patient":');
    const { data: columnsResult, error: columnsError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns 
          WHERE table_name = 'visits' 
            AND column_name ILIKE '%patient%'
          ORDER BY ordinal_position;
        `
      });

    if (columnsError) {
      console.error('❌ Error fetching columns:', columnsError);
    } else {
      console.log('✅ Patient-related columns:', columnsResult);
    }

    // Test a simple query that could cause the issue
    console.log('\n🧪 Testing visits query with patient relationship:');
    const { data: testQuery, error: testError } = await supabase
      .from('visits')
      .select(`
        id,
        patient_id,
        patient:patients(id, first_name, last_name)
      `)
      .limit(1);

    if (testError) {
      console.error('❌ Error in test query:', testError);
    } else {
      console.log('✅ Test query successful:', testQuery);
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the investigation
investigateRelationships();