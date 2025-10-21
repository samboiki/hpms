const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createRoomsAndBeds() {
  console.log('=== CREATING ROOMS AND BEDS ===\n');

  // Get all wards
  const { data: wards, error: wardError } = await supabase
    .from('wards')
    .select('*')
    .eq('is_active', true);

  if (wardError) {
    console.error('Error fetching wards:', wardError.message);
    return;
  }

  console.log(`Found ${wards.length} active wards\n`);

  let totalRooms = 0;
  let totalBeds = 0;

  for (const ward of wards) {
    console.log(`Processing ward: ${ward.ward_name} (${ward.ward_code})`);

    // Create 5 rooms per ward
    const roomsToCreate = [];
    for (let i = 1; i <= 5; i++) {
      roomsToCreate.push({
        ward_id: ward.id,
        room_number: `${ward.ward_code}-R${i.toString().padStart(2, '0')}`,
        room_name: `Room ${i}`,
        room_type: i === 1 ? 'private' : 'standard',
        is_active: true
      });
    }

    const { data: createdRooms, error: roomError } = await supabase
      .from('rooms')
      .insert(roomsToCreate)
      .select();

    if (roomError) {
      console.error(`  Error creating rooms: ${roomError.message}`);
      continue;
    }

    console.log(`  ✓ Created ${createdRooms.length} rooms`);
    totalRooms += createdRooms.length;

    // Create beds for each room
    for (const room of createdRooms) {
      const bedCount = room.room_type === 'private' ? 1 : 2;
      const bedsToCreate = [];

      for (let i = 1; i <= bedCount; i++) {
        bedsToCreate.push({
          room_id: room.id,
          ward_id: ward.id,
          bed_number: `${room.room_number}-B${i}`,
          bed_type: room.room_type === 'private' ? 'private' : 'standard',
          status: 'available',
          is_active: true
        });
      }

      const { data: createdBeds, error: bedError } = await supabase
        .from('beds')
        .insert(bedsToCreate)
        .select();

      if (bedError) {
        console.error(`    Error creating beds for ${room.room_number}: ${bedError.message}`);
      } else {
        totalBeds += createdBeds.length;
      }
    }
  }

  console.log('\n=== CREATION SUMMARY ===');
  console.log(`✓ Total Wards: ${wards.length}`);
  console.log(`✓ Total Rooms Created: ${totalRooms}`);
  console.log(`✓ Total Beds Created: ${totalBeds}`);

  // Final verification
  const { count: finalWardCount } = await supabase.from('wards').select('*', { count: 'exact', head: true });
  const { count: finalRoomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
  const { count: finalBedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });

  console.log('\n=== FINAL DATABASE STATE ===');
  console.log(`Total Wards: ${finalWardCount}`);
  console.log(`Total Rooms: ${finalRoomCount}`);
  console.log(`Total Beds: ${finalBedCount}`);
}

createRoomsAndBeds().catch(console.error);
