import { createClient } from '@supabase/supabase-js';

// 🎯 MCP SQL Executor - Database Analysis Tool
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

/**
 * Execute SQL directly through MCP using the exec_raw_sql function
 */
async function executeSql(sql, description = '') {
  console.log('🔗 MCP SQL Executor');
  console.log(`📝 ${description || 'Executing SQL operation'}`);
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.log('❌ SQL execution failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    
    return { success: true, result: data };
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return { success: false, error: error.message };
  }
}

// Analyze current database structure
async function analyzeDatabase() {
  console.log('🚀 Analyzing current database structure...\n');
  
  // Get all tables
  console.log('📋 Getting all tables...');
  const tablesResult = await executeSql(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `, 'Getting all database tables');
  
  if (!tablesResult.success) {
    console.log('❌ Could not retrieve tables');
    return;
  }
  
  // Get table structures for key tables
  console.log('\n📋 Getting table structures...');
  const structureResult = await executeSql(`
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `, 'Getting table column information');
  
  // Get foreign key relationships
  console.log('\n🔗 Getting foreign key relationships...');
  const fkResult = await executeSql(`
    SELECT
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
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `, 'Getting foreign key relationships');
  
  // Check for existing practice/tenant related tables
  console.log('\n🏥 Checking for existing practice/tenant tables...');
  const practiceTablesResult = await executeSql(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND (tablename LIKE '%practice%' 
           OR tablename LIKE '%tenant%' 
           OR tablename LIKE '%organization%'
           OR tablename LIKE '%clinic%'
           OR tablename LIKE '%hospital%')
    ORDER BY tablename;
  `, 'Checking for practice-related tables');
}

// Execute the analysis
analyzeDatabase();