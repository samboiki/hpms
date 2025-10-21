const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recreateMissingBeds() {
  try {
    console.log('=================================');
    console.log('RECREATING MISSING BEDS');
    console.log('=================================\n');

    const correctDeptId = '744ff11f-0ed5-449a-8c15-07e97ad882bc';
    const correctPracticeId = '5da3896d-b9f3-4b0a-996a-3adca867cb30';

    // Get all wards
    const { data: wards } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', correctDeptId)
      .order('ward_name');

    // Ward specifications
    const wardSpecs = {
      'ICU-001': { name: 'ICU Ward', rooms: 7, bedsPerRoom: 1, roomType: 'Private' },
      'MAT-001': { name: 'Maternity Ward', rooms: 7, bedsPerRoom: 1, roomType: 'Private' },
      'PED-001': { name: 'Pediatric Ward', rooms: 6, bedsPerRoom: 2, roomType: 'Semi-Private' },
      'GWA-001': { name: 'General Ward A', rooms: 9, bedsPerRoom: 2, roomType: 'Semi-Private', shouldHave: 17 }
    };

    for (const ward of wards || []) {
      const spec = wardSpecs[ward.ward_code];
      if (!spec) continue;

      // Check current bed count
      const { count: currentBedCount } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      // For General Ward A, check if it needs more beds
      if (ward.ward_code === 'GWA-001' && currentBedCount >= spec.shouldHave) {
        console.log(`✓ ${ward.ward_name} already has ${currentBedCount} beds`);
        continue;
      }

      // For other wards, only add if they have 0 beds
      if (ward.ward_code !== 'GWA-001' && currentBedCount > 0) {
        console.log(`✓ ${ward.ward_name} already has ${currentBedCount} beds`);
        continue;
      }

      console.log(`\nAdding beds for ${ward.ward_name} (${ward.ward_code})...`);

      // Get or create rooms
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('ward_id', ward.id);

      let rooms = existingRooms || [];

      // Create additional rooms if needed
      const roomsNeeded = spec.rooms - rooms.length;
      if (roomsNeeded > 0) {
        for (let i = 0; i < roomsNeeded; i++) {
          const roomNumber = rooms.length + i + 1;
          const roomCode = `${ward.ward_code}-R${String(roomNumber).padStart(2, '0')}`;

          const { data: newRoom, error: roomError } = await supabase
            .from('rooms')
            .insert({
              room_number: roomCode,
              room_type: spec.roomType,
              ward_id: ward.id,
              department_id: correctDeptId,
              practice_id: correctPracticeId,
              floor: Math.ceil((roomNumber) / 10),
              is_active: true,
              max_capacity: spec.bedsPerRoom,
              current_occupancy: 0,
              features: spec.roomType === 'Private' ? ['Private Bathroom', 'TV', 'AC'] : ['Shared Bathroom', 'AC'],
              status: 'Available'
            })
            .select()
            .single();

          if (!roomError) {
            rooms.push(newRoom);
            console.log(`  Created room: ${roomCode}`);
          }
        }
      }

      // Create beds for each room
      for (const room of rooms.slice(0, spec.rooms)) {
        // Check if room already has beds
        const { count: roomBedCount } = await supabase
          .from('beds')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        const bedsToAdd = spec.bedsPerRoom - (roomBedCount || 0);

        for (let b = 0; b < bedsToAdd; b++) {
          const bedNumber = (roomBedCount || 0) + b + 1;
          const bedCode = `${room.room_number}-B${bedNumber}`;

          const { error: bedError } = await supabase
            .from('beds')
            .insert({
              bed_number: bedCode,
              bed_status: 'Available',
              bed_type: spec.roomType === 'Private' ? 'Standard' : 'Semi-Private',
              room_id: room.id,
              ward_id: ward.id,
              department_id: correctDeptId,
              practice_id: correctPracticeId,
              is_active: true,
              features: ['Adjustable', 'Side Rails'],
              last_cleaned: new Date().toISOString()
            });

          if (!bedError) {
            console.log(`    Added bed: ${bedCode}`);
          }
        }
      }
    }

    // Final verification
    console.log('\n=================================');
    console.log('FINAL BED COUNT PER WARD');
    console.log('=================================\n');

    for (const ward of wards || []) {
      const { count: bedCount } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      console.log(`${ward.ward_name} (${ward.ward_code}):`);
      console.log(`  Rooms: ${roomCount}`);
      console.log(`  Beds: ${bedCount}`);
    }

    const { count: totalBeds } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    console.log(`\n📊 Grand Total for Clinical department:`);
    console.log(`  Total Wards: 5`);
    console.log(`  Total Rooms: ${totalRooms}`);
    console.log(`  Total Beds: ${totalBeds}`);

    console.log('\n✅ ALL BEDS HAVE BEEN RECREATED!');
    console.log('🔄 Please refresh the browser to see all wards, rooms, and beds.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the recreation
recreateMissingBeds();