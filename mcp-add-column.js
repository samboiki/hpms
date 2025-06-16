import { createClient } from '@supabase/supabase-js';

// 🎯 MCP SQL Executor - Standard Database Operation Tool
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
  console.log(`🗂️  SQL: ${sql.substring(0, 100)}...`);
  
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

// 🎯 Add is_processed column to patient_documents table
async function addIsProcessedColumn() {
  console.log('🚀 Adding is_processed column to patient_documents table...\n');
  
  const sql = `ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;`;
  
  const result = await executeSql(sql, 'Adding is_processed column to patient_documents');
  
  if (result.success) {
    console.log('\n🎉 SUCCESS! Column added successfully!');
    console.log('✅ patient_documents.is_processed column is now available');
    
    // Verify the column
    console.log('\n🔍 Verifying column...');
    const verifyResult = await executeSql(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'patient_documents' 
        AND column_name = 'is_processed';
    `, 'Verifying is_processed column was created');
    
    if (verifyResult.success) {
      console.log('✅ Column verification successful!');
    }
    
    // Test the column with a count query
    console.log('\n🧪 Testing column access...');
    const testResult = await executeSql(`
      SELECT COUNT(*) as total_documents,
             COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_count,
             COUNT(CASE WHEN is_processed = false THEN 1 END) as unprocessed_count
      FROM patient_documents;
    `, 'Testing is_processed column access');
    
    if (testResult.success) {
      console.log('✅ Column test successful!');
      console.log('\n📋 Next steps:');
      console.log('   1. Restart your development server');
      console.log('   2. Try uploading documents again');
      console.log('   3. The is_processed column should now work in uploads');
    }
  } else {
    console.log('\n⚠️  Could not add column automatically');
    console.log('📋 Manual execution required in Supabase Dashboard → SQL Editor:');
    console.log('   ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;');
  }
  
  return result;
}

// Execute the column addition
addIsProcessedColumn();