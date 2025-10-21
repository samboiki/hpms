import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUsersSchema() {
  console.log('📊 Fetching users table schema...\n');
  
  // Get column information
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Users table columns:');
    console.log(Object.keys(data[0]).join(', '));
    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️ No data found in users table');
  }
  
  // Also try to get schema information from information_schema
  const { data: schemaData, error: schemaError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `
  });
  
  if (!schemaError && schemaData) {
    console.log('\n📐 Detailed schema:');
    console.table(schemaData);
  }
}

getUsersSchema().catch(console.error);
