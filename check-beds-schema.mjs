import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBedsSchema() {
  console.log('🔍 Fetching beds table schema...\n');

  const { data: sampleData, error: sampleError } = await supabase
    .from('beds')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.error('❌ Error fetching sample data:', sampleError);
  } else if (sampleData && sampleData.length > 0) {
    console.log('📋 BEDS TABLE COLUMNS (from sample record):');
    console.log('='.repeat(60));
    Object.keys(sampleData[0]).forEach((col, idx) => {
      const value = sampleData[0][col];
      const type = typeof value;
      console.log(`${idx + 1}. ${col} (${type}): ${value !== null ? value : 'NULL'}`);
    });
    console.log('='.repeat(60));
    console.log('\n📝 Complete Column List:');
    console.log(Object.keys(sampleData[0]).join(', '));
  } else {
    console.log('⚠️ No beds found in table');
  }

  const { data: allBeds, error: allError, count } = await supabase
    .from('beds')
    .select('*', { count: 'exact' });

  if (allError) {
    console.error('\n❌ Error fetching all beds:', allError);
  } else {
    console.log(`\n📊 Total beds in database: ${count || allBeds?.length || 0}`);
  }
}

checkBedsSchema().catch(console.error);
