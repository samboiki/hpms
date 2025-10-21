const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSampleData() {
  console.log('=== CREATING SAMPLE INPATIENT DATA ===\n');

  // Step 1: Get a practice and department
  console.log('Step 1: Finding practice and departments...');
  const { data: practices, error: practiceError } = await supabase
    .from('practices')
    .select('id')
    .limit(1);

  if (practiceError || !practices || practices.length === 0) {
    console.error('No practices found. Please create a practice first.');
    return;
  }

  const practiceId = practices[0].id;
  console.log(`   ✓ Using practice: ${practiceId}`);

  // Get departments
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('*')
    .eq('practice_id', practiceId)
    .limit(3);

  if (deptError || !departments || departments.length === 0) {
    console.error('No departments found. Creating sample departments...');

    const newDepts = [
      { practice_id: practiceId, name: 'General Medicine', code: 'GEN', is_active: true },
      { practice_id: practiceId, name: 'Surgery', code: 'SUR', is_active: true },
      { practice_id: practiceId, name: 'Pediatrics', code: 'PED', is_active: true }
    ];

    const { data: createdDepts, error: createError } = await supabase
      .from('departments')
      .insert(newDepts)
      .select();

    if (createError) {
      console.error('Error creating departments:', createError.message);
      return;
    }

    departments.push(...createdDepts);
    console.log(`   ✓ Created ${createdDepts.length} departments`);
  } else {
    console.log(`   ✓ Found ${departments.length} departments`);
  }

  // Step 2: Create wards for each department
  console.log('\nStep 2: Creating wards...');
  const wardsToCreate = [];

  for (const dept of departments) {
    wardsToCreate.push({
      department_id: dept.id,
      practice_id: practiceId,
      ward_name: `${dept.name} Ward`,
      ward_code: `${dept.code}-W01`,
      ward_type: dept.name.includes('Surgery') ? 'surgical' : dept.name.includes('Pediatrics') ? 'pediatric' : 'general',
      floor_number: Math.floor(Math.random() * 5) + 1,
      building: 'Main Building',
      capacity: 20,
      current_occupancy: 0,
      nurse_station_phone: '+27-11-555-' + Math.floor(1000 + Math.random() * 9000),
      is_active: true
    });
  }

  const { data: createdWards, error: wardError } = await supabase
    .from('wards')
    .insert(wardsToCreate)
    .select();

  if (wardError) {
    console.error('Error creating wards:', wardError.message);
    return;
  }

  console.log(`   ✓ Created ${createdWards.length} wards`);

  // Step 3: Create rooms for each ward
  console.log('\nStep 3: Creating rooms...');
  const roomsToCreate = [];

  for (const ward of createdWards) {
    // Create 4 rooms per ward
    for (let i = 1; i <= 4; i++) {
      roomsToCreate.push({
        ward_id: ward.id,
        room_number: `${ward.ward_code}-R${i.toString().padStart(2, '0')}`,
        room_name: `Room ${i}`,
        room_type: i === 1 ? 'private' : 'standard',
        bed_capacity: i === 1 ? 1 : 2,
        is_active: true
      });
    }
  }

  const { data: createdRooms, error: roomError } = await supabase
    .from('rooms')
    .insert(roomsToCreate)
    .select();

  if (roomError) {
    console.error('Error creating rooms:', roomError.message);
    return;
  }

  console.log(`   ✓ Created ${createdRooms.length} rooms`);

  // Step 4: Create beds for each room
  console.log('\nStep 4: Creating beds...');
  const bedsToCreate = [];

  for (const room of createdRooms) {
    // Create beds based on room capacity
    const ward = createdWards.find(w => w.id === room.ward_id);
    for (let i = 1; i <= room.bed_capacity; i++) {
      bedsToCreate.push({
        room_id: room.id,
        ward_id: room.ward_id,
        bed_number: `${room.room_number}-B${i}`,
        bed_type: room.room_type === 'private' ? 'private' : 'standard',
        status: 'available',
        is_active: true
      });
    }
  }

  const { data: createdBeds, error: bedError } = await supabase
    .from('beds')
    .insert(bedsToCreate)
    .select();

  if (bedError) {
    console.error('Error creating beds:', bedError.message);
    return;
  }

  console.log(`   ✓ Created ${createdBeds.length} beds`);

  // Step 5: Verify final counts
  console.log('\n=== FINAL VERIFICATION ===');

  const { count: wardCount } = await supabase.from('wards').select('*', { count: 'exact', head: true });
  const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
  const { count: bedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });

  console.log(`\n✅ INPATIENT MODULE DATA CREATED!`);
  console.log(`\nFinal database state:`);
  console.log(`  - Total Wards: ${wardCount}`);
  console.log(`  - Total Rooms: ${roomCount}`);
  console.log(`  - Total Beds: ${bedCount}`);

  console.log(`\n📋 Sample data structure:`);
  console.log(`  - ${departments.length} departments`);
  console.log(`  - ${createdWards.length} wards (linked to departments)`);
  console.log(`  - ${createdRooms.length} rooms (linked to wards)`);
  console.log(`  - ${createdBeds.length} beds (linked to rooms and wards)`);

  // Display ward details
  console.log(`\n=== WARD DETAILS ===`);
  for (const ward of createdWards) {
    const dept = departments.find(d => d.id === ward.department_id);
    const wardRooms = createdRooms.filter(r => r.ward_id === ward.id);
    const wardBeds = createdBeds.filter(b => b.ward_id === ward.id);

    console.log(`\n${ward.ward_name} (${ward.ward_code})`);
    console.log(`  Department: ${dept?.name || 'Unknown'}`);
    console.log(`  Type: ${ward.ward_type}`);
    console.log(`  Floor: ${ward.floor_number}`);
    console.log(`  Rooms: ${wardRooms.length}`);
    console.log(`  Beds: ${wardBeds.length}`);
    console.log(`  Nurse Station: ${ward.nurse_station_phone}`);
  }
}

createSampleData().catch(console.error);