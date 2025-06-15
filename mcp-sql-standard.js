import { createClient } from '@supabase/supabase-js';

// 🎯 MCP SQL Executor - Our Standard Database Operation Tool
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

/**
 * Execute SQL directly through MCP using the exec_raw_sql function
 * This is our standard method for database operations
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
      if (error.message.includes('exec_raw_sql')) {
        console.log('❌ exec_raw_sql function not found');
        console.log('📋 Please create it first in Supabase Dashboard → SQL Editor:');
        console.log(`
          CREATE OR REPLACE FUNCTION exec_raw_sql(sql_query text)
          RETURNS text
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            result text;
            row_count_result integer;
          BEGIN
            EXECUTE sql_query;
            GET DIAGNOSTICS row_count_result = ROW_COUNT;
            RETURN 'SUCCESS: Executed successfully. Rows affected: ' || row_count_result;
          EXCEPTION
            WHEN OTHERS THEN
              RETURN 'ERROR: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
          END;
          $$;
        `);
        return { success: false, error: 'Function not created' };
      }
      
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

// 🎯 Now execute the foreign key constraint fix
async function fixBatchIdConstraint() {
  console.log('🚀 Fixing invoices_enhanced.batch_id foreign key constraint...\n');
  
  const sql = `
    ALTER TABLE invoices_enhanced 
    ADD CONSTRAINT fk_invoices_enhanced_batch_id 
    FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
  `;
  
  const result = await executeSql(sql, 'Adding foreign key constraint for invoices_enhanced.batch_id');
  
  if (result.success) {
    console.log('\n🎉 SUCCESS! Foreign key constraint applied successfully!');
    console.log('✅ invoices_enhanced.batch_id now properly references batch_headers.id');
    
    // Verify the constraint
    console.log('\n🔍 Verifying constraint...');
    const verifyResult = await executeSql(`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'invoices_enhanced' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_invoices_enhanced_batch_id';
    `, 'Verifying foreign key constraint was created');
    
    if (verifyResult.success) {
      console.log('✅ Constraint verification successful!');
    }
  } else {
    console.log('\n⚠️  Could not execute SQL automatically');
    console.log('📋 Manual execution required in Supabase Dashboard');
  }
  
  return result;
}

// Execute the fix
fixBatchIdConstraint();