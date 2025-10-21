const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStructure() {
  console.log('=== VERIFYING INPATIENT MODULE STRUCTURE ===\n');

  // Check wards table
  console.log('1. Checking wards table...');
  const { data: wards, error: wardsError, count: wardCount } = await supabase
    .from('wards')
    .select('*, departments(department_name)', { count: 'exact' });

  if (wardsError) {
    console.error('   ✗ Error:', wardsError.message);
  } else {
    console.log(`   ✓ Wards table exists with ${wardCount} records`);
    if (wards && wards.length > 0) {
      console.log('   Sample ward:');
      console.log(`     - ID: ${wards[0].id}`);
      console.log(`     - Name: ${wards[0].ward_name}`);
      console.log(`     - Department: ${wards[0].departments?.department_name || 'N/A'}`);
      console.log(`     - Type: ${wards[0].ward_type}`);
    }
  }

  // Check rooms table
  console.log('\n2. Checking rooms table...');
  const { data: rooms, error: roomsError, count: roomCount } = await supabase
    .from('rooms')
    .select('*, wards(ward_name)', { count: 'exact' });

  if (roomsError) {
    console.error('   ✗ Error:', roomsError.message);
  } else {
    console.log(`   ✓ Rooms table exists with ${roomCount} records`);
    if (rooms && rooms.length > 0) {
      console.log('   Sample room:');
      console.log(`     - ID: ${rooms[0].id}`);
      console.log(`     - Number: ${rooms[0].room_number}`);
      console.log(`     - Ward: ${rooms[0].wards?.ward_name || 'N/A'}`);
    }
  }

  // Check beds table
  console.log('\n3. Checking beds table...');
  const { data: beds, error: bedsError, count: bedCount } = await supabase
    .from('beds')
    .select('*, rooms(room_number), wards(ward_name)', { count: 'exact' });

  if (bedsError) {
    console.error('   ✗ Error:', bedsError.message);
  } else {
    console.log(`   ✓ Beds table exists with ${bedCount} records`);
    if (beds && beds.length > 0) {
      console.log('   Sample bed:');
      console.log(`     - ID: ${beds[0].id}`);
      console.log(`     - Number: ${beds[0].bed_number}`);
      console.log(`     - Room: ${beds[0].rooms?.room_number || 'N/A'}`);
      console.log(`     - Ward: ${beds[0].wards?.ward_name || 'N/A'}`);
      console.log(`     - Status: ${beds[0].status}`);
    }
  }

  // Check departments table to see if it has the necessary columns
  console.log('\n4. Checking departments table...');
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('*')
    .limit(1);

  if (deptError) {
    console.error('   ✗ Error:', deptError.message);
  } else {
    console.log('   ✓ Departments table exists');
    if (departments && departments.length > 0) {
      console.log('   Sample department columns:', Object.keys(departments[0]).join(', '));
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`✓ Database Structure: departments → wards → rooms → beds`);
  console.log(`✓ Total Wards: ${wardCount || 0}`);
  console.log(`✓ Total Rooms: ${roomCount || 0}`);
  console.log(`✓ Total Beds: ${bedCount || 0}`);

  if (wardCount > 0 && roomCount === 0 && bedCount === 0) {
    console.log('\n⚠️  NOTE: Wards exist but no rooms/beds yet. Need to create rooms and beds.');
  }

  // List all wards
  if (wards && wards.length > 0) {
    console.log('\n=== ALL WARDS ===');
    wards.forEach((ward, idx) => {
      console.log(`${idx + 1}. ${ward.ward_name} (${ward.ward_code})`);
      console.log(`   - Type: ${ward.ward_type}`);
      console.log(`   - Department: ${ward.departments?.department_name || 'N/A'}`);
      console.log(`   - Capacity: ${ward.capacity}`);
      console.log(`   - Active: ${ward.is_active ? 'Yes' : 'No'}`);
    });
  }
}

verifyStructure().catch(console.error);