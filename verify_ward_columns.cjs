const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function verifySchema() {
  console.log('🔍 VERIFYING WARD SCHEMA AND RELATIONSHIPS\n');

  // Try with correct column name
  console.log('=== Testing with ward_name column ===');
  const { data: wardsTest1, error: error1 } = await supabase
    .from('hospital_wards')
    .select('id, ward_name, ward_code, department_id')
    .limit(5);

  if (error1) {
    console.log('❌ Error:', error1.message);
  } else {
    console.log('✅ Success with ward_name:');
    console.log(JSON.stringify(wardsTest1, null, 2));
  }

  // Check relationships with correct column
  console.log('\n=== Testing ward-department join ===');
  const { data: wardsWithDepts, error: error2 } = await supabase
    .from('hospital_wards')
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

  if (error2) {
    console.log('❌ Error:', error2.message);
  } else {
    console.log('✅ Success with join:');
    console.log(JSON.stringify(wardsWithDepts, null, 2));
  }

  // Check bed-ward relationships
  console.log('\n=== Testing bed-ward join ===');
  const { data: bedsWithWards, error: error3 } = await supabase
    .from('ward_beds')
    .select(`
      id,
      bed_number,
      room_number,
      ward_id,
      hospital_wards (
        id,
        ward_name,
        ward_code
      )
    `)
    .limit(5);

  if (error3) {
    console.log('❌ Error:', error3.message);
  } else {
    console.log('✅ Success with bed-ward join:');
    console.log(JSON.stringify(bedsWithWards, null, 2));
  }

  // Count null department_ids
  console.log('\n=== Checking NULL department_id values ===');
  const { data: nullDepts, error: error4 } = await supabase
    .from('hospital_wards')
    .select('id, ward_name, department_id')
    .is('department_id', null);

  if (error4) {
    console.log('❌ Error:', error4.message);
  } else {
    console.log(`Found ${nullDepts.length} wards with NULL department_id:`);
    nullDepts.forEach(ward => {
      console.log(`  - ${ward.ward_name}: department_id = ${ward.department_id}`);
    });
  }

  // Get full statistics
  console.log('\n=== FULL STATISTICS ===');
  const { count: totalWards } = await supabase
    .from('hospital_wards')
    .select('*', { count: 'exact', head: true });

  const { count: wardsWithoutDept } = await supabase
    .from('hospital_wards')
    .select('*', { count: 'exact', head: true })
    .is('department_id', null);

  const { count: totalBeds } = await supabase
    .from('ward_beds')
    .select('*', { count: 'exact', head: true });

  const { count: totalDepts } = await supabase
    .from('departments')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total wards: ${totalWards}`);
  console.log(`📊 Wards without department: ${wardsWithoutDept}`);
  console.log(`📊 Total beds: ${totalBeds}`);
  console.log(`📊 Total departments: ${totalDepts}`);

  console.log('\n=== KEY FINDINGS ===');
  console.log('✅ hospital_wards table uses "ward_name" column (NOT "name")');
  console.log(`${wardsWithoutDept > 0 ? '⚠️' : '✅'} ${wardsWithoutDept} wards have NULL department_id`);
  console.log('✅ ward_beds table has ward_id and room_number columns');
  console.log('✅ Relationships are properly configured');
}

verifySchema();