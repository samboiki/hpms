import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🔄 Adding is_no_show column to visits table...\n');

  // Add is_no_show column to visits table with default value false
  const addColumnQuery = `
    ALTER TABLE visits 
    ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT false;
  `;

  console.log('📝 Executing ALTER TABLE command...');
  const result = await executeSql(addColumnQuery);
  
  if (!result.success) {
    console.log('❌ Failed to add is_no_show column');
    return;
  }

  console.log('✅ Column is_no_show added successfully!');
  
  // Verify the column was added
  console.log('\n🔍 Verifying column was added...');
  const verifyQuery = `
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'visits' 
    AND column_name = 'is_no_show';
  `;
  
  const verifyResult = await executeSql(verifyQuery);
  
  if (verifyResult.success) {
    console.log('📊 Column details:', verifyResult.data);
  }

  console.log('\n🎉 Operation completed!');
}

main().catch(console.error);