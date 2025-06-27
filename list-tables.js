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
  console.log('📋 Listing all tables in the database...\n');

  // Query to list all tables
  const listTablesQuery = `
    SELECT 
      table_name,
      table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  console.log('📝 Executing query...');
  const result = await executeSql(listTablesQuery);
  
  if (!result.success) {
    console.log('❌ Failed to list tables');
    console.error('Error:', result.error);
    return;
  }

  console.log('\n📊 Tables in your database:');
  console.log('========================');
  
  // Parse the result if it's a string
  try {
    const tables = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    if (Array.isArray(tables)) {
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name}`);
      });
      console.log(`\nTotal tables: ${tables.length}`);
    } else {
      console.log(result.data);
    }
  } catch (e) {
    console.log(result.data);
  }
}

main().catch(console.error);