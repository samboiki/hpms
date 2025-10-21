const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
  // Query information_schema to get actual column names
  const { data, error } = await supabase
    .rpc('execute_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'hospital_wards'
        ORDER BY ordinal_position;
      `
    });

  if (error) {
    console.error('Error:', error);

    // Try direct query
    console.log('\nTrying direct query...');
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .limit(1);

    if (wardsError) {
      console.error('Ward query error:', wardsError);
    } else {
      console.log('\nSample ward record:');
      console.log(JSON.stringify(wards[0], null, 2));
    }
  } else {
    console.log('hospital_wards schema:');
    console.log(data);
  }
}

getSchema();