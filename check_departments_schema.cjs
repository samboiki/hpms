const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 DEPARTMENTS TABLE SCHEMA CHECK\n');

  // Get a sample department
  const { data: depts, error } = await supabase
    .from('departments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
  } else if (depts && depts.length > 0) {
    console.log('✅ Sample Department Record:');
    console.log(JSON.stringify(depts[0], null, 2));
    console.log('\n📋 Available Columns:');
    Object.keys(depts[0]).forEach((key, idx) => {
      console.log(`   ${idx + 1}. ${key}: ${typeof depts[0][key]}`);
    });
  }

  // Try simple ward query
  console.log('\n\n🔍 WARDS TABLE QUERY (Simple):');
  const { data: wards, error: wardsError } = await supabase
    .from('wards')
    .select('id, ward_name, department_id')
    .limit(5);

  if (wardsError) {
    console.error('❌ Error:', wardsError);
  } else {
    console.log('✅ Wards:');
    console.table(wards);
  }

  // Try joining wards with departments (basic columns only)
  console.log('\n\n🔍 WARDS WITH DEPARTMENTS (Basic Join):');
  const { data: wardsWithDepts, error: joinError } = await supabase
    .from('wards')
    .select(`
      id,
      ward_name,
      department_id,
      departments (
        id,
        name
      )
    `)
    .limit(5);

  if (joinError) {
    console.error('❌ Error:', joinError);
  } else {
    console.log('✅ Wards with Departments:');
    console.log(JSON.stringify(wardsWithDepts, null, 2));
  }
}

checkSchema().catch(console.error);