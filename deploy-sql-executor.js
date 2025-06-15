import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function deployAndTestSqlExecutor() {
  console.log('🚀 Setting up SQL Executor Edge Function...');
  
  // Step 1: Create the exec_raw_sql database function first
  console.log('📝 Creating exec_raw_sql database function...');
  
  try {
    // We'll use the Edge Function to create the database function
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_raw_sql(sql_query text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result text;
        row_count_result integer;
      BEGIN
        -- Execute the SQL query
        EXECUTE sql_query;
        
        -- Get the number of affected rows
        GET DIAGNOSTICS row_count_result = ROW_COUNT;
        
        -- Return success message
        RETURN 'SUCCESS: Executed successfully. Rows affected: ' || row_count_result;
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Return error details
          RETURN 'ERROR: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
      END;
      $$;
    `;
    
    console.log('🔧 SQL function to create:');
    console.log(createFunctionSql);
    
    // For now, let's test calling the edge function after deployment
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy the Edge Function:');
    console.log('   npx supabase functions deploy execute-sql');
    console.log('');
    console.log('2. Create the exec_raw_sql function in Supabase Dashboard:');
    console.log('   Dashboard → SQL Editor → Execute the function above');
    console.log('');
    console.log('3. Test the foreign key constraint fix');
    
    // Test the edge function call structure
    const testSqlRequest = {
      sql: `
        ALTER TABLE invoices_enhanced 
        ADD CONSTRAINT fk_invoices_enhanced_batch_id 
        FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
      `,
      operation_type: 'DDL',
      description: 'Add foreign key constraint for invoices_enhanced.batch_id'
    };
    
    console.log('\n🧪 Test Edge Function Call:');
    console.log('URL: https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/execute-sql');
    console.log('Method: POST');
    console.log('Headers:');
    console.log('  Authorization: Bearer [service_role_key]');
    console.log('  Content-Type: application/json');
    console.log('Body:', JSON.stringify(testSqlRequest, null, 2));
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

deployAndTestSqlExecutor();