const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log('🔍 ROOMS AND BEDS DIAGNOSTIC REPORT\n');
  console.log('=' .repeat(80));

  // 1. Count total rooms
  console.log('\n1️⃣ TOTAL ROOMS COUNT:');
  const { data: roomsCount, error: roomsCountError } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true });

  if (roomsCountError) {
    console.error('❌ Error counting rooms:', roomsCountError);
  } else {
    console.log(`✅ Total rooms: ${roomsCount}`);
  }

  // 2. Show sample rooms
  console.log('\n2️⃣ SAMPLE ROOMS (First 5):');
  const { data: sampleRooms, error: sampleRoomsError } = await supabase
    .from('rooms')
    .select('*')
    .limit(5);

  if (sampleRoomsError) {
    console.error('❌ Error fetching sample rooms:', sampleRoomsError);
  } else {
    console.table(sampleRooms);
  }

  // 3. Count total beds
  console.log('\n3️⃣ TOTAL BEDS COUNT:');
  const { data: bedsCount, error: bedsCountError } = await supabase
    .from('beds')
    .select('*', { count: 'exact', head: true });

  if (bedsCountError) {
    console.error('❌ Error counting beds:', bedsCountError);
  } else {
    console.log(`✅ Total beds: ${bedsCount}`);
  }

  // 4. Show sample beds
  console.log('\n4️⃣ SAMPLE BEDS (First 5):');
  const { data: sampleBeds, error: sampleBedsError } = await supabase
    .from('beds')
    .select('*')
    .limit(5);

  if (sampleBedsError) {
    console.error('❌ Error fetching sample beds:', sampleBedsError);
  } else {
    console.table(sampleBeds);
  }

  // 5. Check if rooms have ward_id populated
  console.log('\n5️⃣ ROOMS WITH WARD_ID (First 10):');
  const { data: roomsWithWard, error: roomsWithWardError } = await supabase
    .from('rooms')
    .select('id, room_number, ward_id')
    .limit(10);

  if (roomsWithWardError) {
    console.error('❌ Error fetching rooms with ward_id:', roomsWithWardError);
  } else {
    console.table(roomsWithWard);
    const roomsWithWardId = roomsWithWard?.filter(r => r.ward_id !== null).length || 0;
    console.log(`📊 Rooms with ward_id populated: ${roomsWithWardId}/${roomsWithWard?.length || 0}`);
  }

  // 6. Check if beds have room_id and ward_id populated
  console.log('\n6️⃣ BEDS WITH ROOM_ID AND WARD_ID (First 10):');
  const { data: bedsWithIds, error: bedsWithIdsError } = await supabase
    .from('beds')
    .select('id, bed_number, room_id, ward_id')
    .limit(10);

  if (bedsWithIdsError) {
    console.error('❌ Error fetching beds with IDs:', bedsWithIdsError);
  } else {
    console.table(bedsWithIds);
    const bedsWithRoomId = bedsWithIds?.filter(b => b.room_id !== null).length || 0;
    const bedsWithWardId = bedsWithIds?.filter(b => b.ward_id !== null).length || 0;
    console.log(`📊 Beds with room_id populated: ${bedsWithRoomId}/${bedsWithIds?.length || 0}`);
    console.log(`📊 Beds with ward_id populated: ${bedsWithWardId}/${bedsWithIds?.length || 0}`);
  }

  // 7. Check departments table
  console.log('\n7️⃣ DEPARTMENTS (First 5):');
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name')
    .limit(5);

  if (departmentsError) {
    console.error('❌ Error fetching departments:', departmentsError);
  } else {
    console.table(departments);
  }

  // 8. Check if wards have department_id linked
  console.log('\n8️⃣ WARDS WITH DEPARTMENT_ID (First 10):');
  const { data: wardsWithDept, error: wardsWithDeptError } = await supabase
    .from('wards')
    .select('id, ward_name, department_id')
    .limit(10);

  if (wardsWithDeptError) {
    console.error('❌ Error fetching wards with department_id:', wardsWithDeptError);
  } else {
    console.table(wardsWithDept);
    const wardsWithDeptId = wardsWithDept?.filter(w => w.department_id !== null).length || 0;
    console.log(`📊 Wards with department_id populated: ${wardsWithDeptId}/${wardsWithDept?.length || 0}`);
  }

  // 9. Comprehensive relationship analysis
  console.log('\n9️⃣ COMPREHENSIVE RELATIONSHIP ANALYSIS:');

  // Get all rooms
  const { data: allRooms } = await supabase.from('rooms').select('*');

  // Get all beds
  const { data: allBeds } = await supabase.from('beds').select('*');

  // Get all wards
  const { data: allWards } = await supabase.from('wards').select('*');

  // Get all departments
  const { data: allDepartments } = await supabase.from('departments').select('*');

  console.log(`📊 Total Rooms: ${allRooms?.length || 0}`);
  console.log(`📊 Total Beds: ${allBeds?.length || 0}`);
  console.log(`📊 Total Wards: ${allWards?.length || 0}`);
  console.log(`📊 Total Departments: ${allDepartments?.length || 0}`);

  if (allRooms && allBeds && allWards) {
    const roomsWithWardId = allRooms.filter(r => r.ward_id !== null).length;
    const bedsWithRoomId = allBeds.filter(b => b.room_id !== null).length;
    const bedsWithWardId = allBeds.filter(b => b.ward_id !== null).length;
    const wardsWithDeptId = allWards.filter(w => w.department_id !== null).length;

    console.log(`\n📈 RELATIONSHIP STATISTICS:`);
    console.log(`   Rooms linked to wards: ${roomsWithWardId}/${allRooms.length} (${((roomsWithWardId/allRooms.length)*100).toFixed(1)}%)`);
    console.log(`   Beds linked to rooms: ${bedsWithRoomId}/${allBeds.length} (${((bedsWithRoomId/allBeds.length)*100).toFixed(1)}%)`);
    console.log(`   Beds linked to wards: ${bedsWithWardId}/${allBeds.length} (${((bedsWithWardId/allBeds.length)*100).toFixed(1)}%)`);
    console.log(`   Wards linked to departments: ${wardsWithDeptId}/${allWards.length} (${((wardsWithDeptId/allWards.length)*100).toFixed(1)}%)`);
  }

  // 10. Ward-specific breakdown
  console.log('\n🔟 WARD-SPECIFIC BREAKDOWN:');
  if (allWards && allRooms && allBeds) {
    for (const ward of allWards.slice(0, 5)) {
      const roomsInWard = allRooms.filter(r => r.ward_id === ward.id);
      const bedsInWard = allBeds.filter(b => b.ward_id === ward.id);
      console.log(`\n   Ward: ${ward.ward_name} (ID: ${ward.id})`);
      console.log(`   - Department ID: ${ward.department_id || 'NOT SET'}`);
      console.log(`   - Rooms: ${roomsInWard.length}`);
      console.log(`   - Beds: ${bedsInWard.length}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ DIAGNOSTIC COMPLETE\n');
}

runDiagnostics().catch(console.error);