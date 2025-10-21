const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function detailedAnalysis() {
  console.log('🔍 DETAILED WARD-DEPARTMENT-ROOM-BED ANALYSIS\n');
  console.log('=' .repeat(100));

  // Get all wards with their department names
  console.log('\n1️⃣ ALL WARDS WITH DEPARTMENT NAMES:');
  const { data: wardsWithDepts, error: wardsError } = await supabase
    .from('wards')
    .select(`
      id,
      ward_name,
      ward_type,
      floor_number,
      total_beds,
      occupied_beds,
      department_id,
      departments!wards_department_id_fkey (
        id,
        name,
        description,
        department_type
      )
    `)
    .order('ward_name');

  if (wardsError) {
    console.error('❌ Error:', wardsError);
  } else {
    console.log(`\n✅ Found ${wardsWithDepts?.length || 0} wards\n`);
    wardsWithDepts?.forEach((ward, idx) => {
      console.log(`${idx + 1}. Ward: ${ward.ward_name}`);
      console.log(`   - Ward ID: ${ward.id}`);
      console.log(`   - Ward Type: ${ward.ward_type || 'N/A'}`);
      console.log(`   - Floor: ${ward.floor_number || 'N/A'}`);
      console.log(`   - Total Beds: ${ward.total_beds || 0}`);
      console.log(`   - Occupied: ${ward.occupied_beds || 0}`);
      console.log(`   - Department ID: ${ward.department_id || 'NOT SET'}`);
      console.log(`   - Department Name: ${ward.departments?.name || 'NOT LINKED'}`);
      console.log(`   - Department Type: ${ward.departments?.department_type || 'N/A'}`);
      console.log('');
    });
  }

  // Get rooms grouped by ward
  console.log('\n2️⃣ ROOMS GROUPED BY WARD:');
  const { data: allRooms } = await supabase
    .from('rooms')
    .select('*')
    .order('ward_id, room_number');

  if (allRooms) {
    const roomsByWard = {};
    allRooms.forEach(room => {
      const wardId = room.ward_id || 'NO_WARD';
      if (!roomsByWard[wardId]) {
        roomsByWard[wardId] = [];
      }
      roomsByWard[wardId].push(room);
    });

    for (const [wardId, rooms] of Object.entries(roomsByWard)) {
      const ward = wardsWithDepts?.find(w => w.id === wardId);
      console.log(`\n${ward?.ward_name || 'UNASSIGNED'} (${wardId}):`);
      console.log(`   Total Rooms: ${rooms.length}`);
      rooms.slice(0, 5).forEach(room => {
        console.log(`   - ${room.room_number}: ${room.room_name || 'Unnamed'} (${room.room_type}) - ${room.room_status}`);
      });
      if (rooms.length > 5) {
        console.log(`   ... and ${rooms.length - 5} more rooms`);
      }
    }
  }

  // Get beds grouped by ward
  console.log('\n3️⃣ BEDS GROUPED BY WARD:');
  const { data: allBeds } = await supabase
    .from('beds')
    .select('*')
    .order('ward_id, bed_number');

  if (allBeds) {
    const bedsByWard = {};
    allBeds.forEach(bed => {
      const wardId = bed.ward_id || 'NO_WARD';
      if (!bedsByWard[wardId]) {
        bedsByWard[wardId] = [];
      }
      bedsByWard[wardId].push(bed);
    });

    for (const [wardId, beds] of Object.entries(bedsByWard)) {
      const ward = wardsWithDepts?.find(w => w.id === wardId);
      console.log(`\n${ward?.ward_name || 'UNASSIGNED'} (${wardId}):`);
      console.log(`   Total Beds: ${beds.length}`);
      const availableBeds = beds.filter(b => b.bed_status === 'Available').length;
      const occupiedBeds = beds.filter(b => b.bed_status === 'Occupied').length;
      console.log(`   - Available: ${availableBeds}`);
      console.log(`   - Occupied: ${occupiedBeds}`);
      console.log(`   Sample beds: ${beds.slice(0, 3).map(b => b.bed_number).join(', ')}`);
    }
  }

  // Get specific department details
  console.log('\n4️⃣ DEPARTMENT DETAILS (Clinical Departments):');
  const { data: clinicalDepts } = await supabase
    .from('departments')
    .select('*')
    .or('department_type.eq.clinical,department_type.eq.medical')
    .order('name');

  if (clinicalDepts) {
    console.log(`\n✅ Found ${clinicalDepts.length} clinical/medical departments\n`);
    clinicalDepts.forEach((dept, idx) => {
      console.log(`${idx + 1}. ${dept.name}`);
      console.log(`   - ID: ${dept.id}`);
      console.log(`   - Type: ${dept.department_type || 'N/A'}`);
      console.log(`   - Description: ${dept.description || 'N/A'}`);
      console.log(`   - Head: ${dept.head_of_department || 'N/A'}`);
      console.log('');
    });
  }

  // Critical Query: Check if rooms/beds are visible when filtering by department
  console.log('\n5️⃣ CRITICAL: DEPARTMENT → WARD → ROOM → BED CHAIN:');

  // Pick the first ward's department
  const firstWard = wardsWithDepts?.[0];
  if (firstWard && firstWard.department_id) {
    const deptId = firstWard.department_id;
    console.log(`\nTesting with Department ID: ${deptId}`);
    console.log(`Department Name: ${firstWard.departments?.name || 'Unknown'}`);

    // Get wards for this department
    const { data: wardsForDept } = await supabase
      .from('wards')
      .select('id, ward_name')
      .eq('department_id', deptId);

    console.log(`\nWards in this department: ${wardsForDept?.length || 0}`);
    wardsForDept?.forEach(w => console.log(`   - ${w.ward_name} (${w.id})`));

    if (wardsForDept && wardsForDept.length > 0) {
      const wardId = wardsForDept[0].id;

      // Get rooms for this ward
      const { data: roomsForWard } = await supabase
        .from('rooms')
        .select('id, room_number, room_name, room_status')
        .eq('ward_id', wardId);

      console.log(`\nRooms in ward "${wardsForDept[0].ward_name}": ${roomsForWard?.length || 0}`);
      roomsForWard?.forEach(r => console.log(`   - ${r.room_number}: ${r.room_name || 'Unnamed'} (${r.room_status})`));

      // Get beds for this ward
      const { data: bedsForWard } = await supabase
        .from('beds')
        .select('id, bed_number, bed_status')
        .eq('ward_id', wardId);

      console.log(`\nBeds in ward "${wardsForDept[0].ward_name}": ${bedsForWard?.length || 0}`);
      bedsForWard?.slice(0, 10).forEach(b => console.log(`   - ${b.bed_number}: ${b.bed_status}`));
    }
  }

  // Check RLS policies
  console.log('\n6️⃣ CHECKING TABLE POLICIES:');
  const tables = ['wards', 'rooms', 'beds', 'departments'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`✅ ${table}: Accessible (count available)`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('✅ DETAILED ANALYSIS COMPLETE\n');
}

detailedAnalysis().catch(console.error);