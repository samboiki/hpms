#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for schema inspection
const supabaseUrl = 'https://dszjkjplqbmghzgsmumf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzempranBscWJtZ2h6Z3NtdW1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM5MzY3NCwiZXhwIjoyMDQ5OTY5Njc0fQ.Kt3kqGhWdYObhqGlKOTr75hYMlgLJPJfGZOEGnQQBj8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigateVisitsSchema() {
  console.log('🔍 Investigating visits table schema and relationships...\n');

  try {
    // 1. Get visits table structure
    console.log('📋 1. Visits table structure:');
    const { data: visitsColumns, error: visitsError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'visits' 
          ORDER BY ordinal_position;
        `
      });

    if (visitsError) {
      console.error('❌ Error fetching visits columns:', visitsError);
    } else {
      console.log('✅ Visits columns:', visitsColumns);
    }

    // 2. Get foreign key constraints on visits table
    console.log('\n🔗 2. Foreign key constraints on visits table:');
    const { data: fkConstraints, error: fkError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
          WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'visits';
        `
      });

    if (fkError) {
      console.error('❌ Error fetching FK constraints:', fkError);
    } else {
      console.log('✅ Foreign key constraints:', fkConstraints);
    }

    // 3. Check for any duplicate constraints or relationships
    console.log('\n🔍 3. Checking for duplicate relationships to patients:');
    const { data: patientRelations, error: relationError } = await supabase
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

    if (relationError) {
      console.error('❌ Error checking patient relations:', relationError);
    } else {
      console.log('✅ Patient relationships:', patientRelations);
    }

    // 4. Check visits table indexes
    console.log('\n📊 4. Visits table indexes:');
    const { data: indexes, error: indexError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE tablename = 'visits'
          ORDER BY indexname;
        `
      });

    if (indexError) {
      console.error('❌ Error fetching indexes:', indexError);
    } else {
      console.log('✅ Visits indexes:', indexes);
    }

    // 5. Sample visits data to understand structure
    console.log('\n📝 5. Sample visits data (first 3 rows):');
    const { data: sampleVisits, error: sampleError } = await supabase
      .from('visits')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('❌ Error fetching sample visits:', sampleError);
    } else {
      console.log('✅ Sample visits:', JSON.stringify(sampleVisits, null, 2));
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the investigation
investigateVisitsSchema();