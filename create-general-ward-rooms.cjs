const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createGeneralWardRooms() {
  try {
    // Find the existing General Ward A
    const { data: wards } = await supabase
      .from('wards')
      .select('*')
      .eq('ward_code', 'GWA')
      .limit(1);

    if (!wards || wards.length === 0) {
      console.error('General Ward A not found');
      return;
    }

    const ward = wards[0];
    console.log(`Using existing ward: ${ward.ward_name} (${ward.id})`);

    // Rooms for General Ward A
    const rooms = [
      'GWA03', 'GWA04', 'GWA05', 'GWA06', 'GWA07', 'GWA08', 'GWA09',
      'GWA10', 'GWA11', 'GWA12', 'GWA13', 'GWA14', 'GWA15', 'GWA16',
      'GWA17', 'GWA18', 'GWA19'
    ];

    let totalRoomsCreated = 0;
    let totalBedsCreated = 0;

    // Create rooms and beds
    for (const roomNumber of rooms) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_number: roomNumber,
          room_name: `Room ${roomNumber}`,
          room_type: 'Standard',
          department_id: ward.department_id,
          ward_id: ward.id,
          practice_id: ward.practice_id,
          floor_number: 1,
          building: 'Main Building',
          bed_count: 1,
          occupied_beds: 0,
          room_status: 'Available',
          is_active: true
        })
        .select()
        .single();

      if (roomError) {
        console.error(`Error creating room ${roomNumber}:`, roomError);
        continue;
      }

      console.log(`✅ Created room: ${roomNumber}`);
      totalRoomsCreated++;

      // Create bed for this room
      const bedNumber = `${roomNumber}-1`;

      const { data: bed, error: bedError } = await supabase
        .from('beds')
        .insert({
          bed_number: bedNumber,
          bed_name: `Bed ${bedNumber}`,
          room_id: room.id,
          ward_id: ward.id,
          department_id: ward.department_id,
          practice_id: ward.practice_id,
          bed_type: 'Standard',
          bed_status: 'Available',
          is_active: true
        })
        .select()
        .single();

      if (bedError) {
        console.error(`Error creating bed ${bedNumber}:`, bedError);
        continue;
      }

      console.log(`  ✅ Created bed: ${bedNumber}`);
      totalBedsCreated++;
    }

    console.log('\n=================================');
    console.log('✅ GENERAL WARD A ROOMS COMPLETE!');
    console.log('=================================');
    console.log(`Total Rooms Created: ${totalRoomsCreated}`);
    console.log(`Total Beds Created: ${totalBedsCreated}`);
    console.log('=================================');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
createGeneralWardRooms();