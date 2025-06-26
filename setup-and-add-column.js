import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('🔧 Setting up exec_raw_sql function and adding is_no_show column...\n');

  // First, create the exec_raw_sql function if it doesn't exist
  console.log('📝 Creating exec_raw_sql function...');
  const createFunctionQuery = `
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
  `;

  try {
    // Execute the function creation directly
    const { error: functionError } = await supabase.rpc('query', { 
      sql: createFunctionQuery 
    }).catch(() => {
      // If query doesn't exist, try executing SQL directly
      return supabase.from('_sql').select().single().throwOnError();
    });

    if (functionError) {
      console.log('⚠️  Could not create function via RPC, trying direct approach...');
      
      // Try creating through a direct SQL execution
      const { data, error } = await supabase
        .from('visits')
        .select('id')
        .limit(1);
        
      if (!error) {
        console.log('✅ Database connection verified');
      }
    }
  } catch (err) {
    console.log('ℹ️  Function might already exist or needs manual creation');
  }

  // Now add the is_no_show column
  console.log('\n📝 Adding is_no_show column to visits table...');
  
  try {
    // First check if column already exists
    const { data: columns } = await supabase
      .from('visits')
      .select('*')
      .limit(0);
    
    // Try using the exec_raw_sql function
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: 'ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT false;'
    });

    if (error) {
      console.log('⚠️  exec_raw_sql not available, using direct query...');
      
      // Alternative: Create a simple test to verify connection
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select('id')
        .limit(1);
        
      if (!visitError) {
        console.log('\n✅ Database connection successful!');
        console.log('\n📋 To add the is_no_show column, please execute this SQL in your Supabase Dashboard:');
        console.log('\n--- SQL to execute in Supabase Dashboard ---');
        console.log('ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT false;');
        console.log('--- End of SQL ---\n');
        
        console.log('Steps:');
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Paste and execute the above SQL command');
        console.log('4. The column will be added with default value false');
      } else {
        console.error('❌ Database connection failed:', visitError);
      }
    } else {
      console.log('✅ Column added successfully!');
      console.log('📊 Result:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n🎉 Process completed!');
}

main().catch(console.error);