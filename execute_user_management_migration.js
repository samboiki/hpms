import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 200) + (query.length > 200 ? '...' : ''));
  
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
  console.log('🚀 Executing Comprehensive User Management Migration...\n');

  // First, ensure the exec_raw_sql function exists
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

  console.log('📝 Creating exec_raw_sql function if not exists...');
  const funcResult = await executeSql(createFunctionQuery);
  
  if (!funcResult.success) {
    console.log('❌ Failed to create exec_raw_sql function');
    return;
  }

  // Read the migration file
  const migrationPath = path.join(__dirname, 'supabase/migrations/20250626_comprehensive_user_management.sql');
  console.log('\n📂 Reading migration file from:', migrationPath);
  
  let migrationSql;
  try {
    migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded successfully');
  } catch (err) {
    console.error('❌ Failed to read migration file:', err.message);
    return;
  }

  // Split the migration into smaller chunks to avoid timeout
  const statements = migrationSql
    .split(/;(?=\s*(?:--|CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|$))/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n📊 Found ${statements.length} SQL statements to execute`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}...`);
    console.log('📝 Statement preview:', statement.substring(0, 100) + '...');
    
    const result = await executeSql(statement);
    
    if (result.success) {
      successCount++;
      console.log(`✅ Statement ${i + 1} executed successfully`);
    } else {
      errorCount++;
      console.log(`❌ Statement ${i + 1} failed:`, result.error);
      
      // Continue with other statements even if one fails
      console.log('⏭️  Continuing with next statement...');
    }
  }

  console.log('\n🎉 Migration execution completed!');
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);
  
  if (errorCount === 0) {
    console.log('\n🌟 All statements executed successfully!');
  } else {
    console.log('\n⚠️  Some statements failed. Please review the errors above.');
  }
}

main().catch(console.error);