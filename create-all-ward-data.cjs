const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAllWardData() {
  try {
    console.log('=================================');
    console.log('CREATING ALL WARD DATA');
    console.log('=================================\n');

    const correctDeptId = '744ff11f-0ed5-449a-8c15-07e97ad882bc';
    const correctPracticeId = '5da3896d-b9f3-4b0a-996a-3adca867cb30';

    // Get all wards
    const { data: wards } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', correctDeptId)
      .order('ward_name');

    console.log('Current wards:');
    wards?.forEach(w => console.log(`  - ${w.ward_name} (${w.ward_code})`));
    console.log('');

    // Define what each ward should have
    const wardConfigs = {
      'EMG': {
        name: 'Emergency Ward',
        targetBeds: 5,
        roomPrefix: 'ER',
        bedsPerRoom: 1,
        roomType: 'Emergency'
      },
      'GWA-001': {
        name: 'General Ward A',
        targetBeds: 17,
        roomPrefix: 'GWA',
        bedsPerRoom: 2,
        roomType: 'Semi-Private'
      },
      'ICU-001': {
        name: 'ICU Ward',
        targetBeds: 7,
        roomPrefix: 'ICU',
        bedsPerRoom: 1,
        roomType: 'Private'
      },
      'MAT-001': {
        name: 'Maternity Ward',
        targetBeds: 7,
        roomPrefix: 'MAT',
        bedsPerRoom: 1,
        roomType: 'Private'
      },
      'PED-001': {
        name: 'Pediatric Ward',
        targetBeds: 12,
        roomPrefix: 'PED',
        bedsPerRoom: 2,
        roomType: 'Semi-Private'
      }
    };

    for (const ward of wards || []) {
      const config = wardConfigs[ward.ward_code];
      if (!config) {
        console.log(`⚠️ No config for ward: ${ward.ward_name} (${ward.ward_code})`);
        continue;
      }

      console.log(`\n📋 Processing ${ward.ward_name} (${ward.ward_code})...`);

      // Check current bed count
      const { count: currentBeds } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      console.log(`  Current beds: ${currentBeds}, Target: ${config.targetBeds}`);

      if (currentBeds >= config.targetBeds) {
        console.log(`  ✓ Already has sufficient beds`);
        continue;
      }

      // Calculate rooms needed
      const roomsNeeded = Math.ceil(config.targetBeds / config.bedsPerRoom);

      // Get existing rooms
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('ward_id', ward.id);

      const existingRoomCount = existingRooms?.length || 0;
      console.log(`  Existing rooms: ${existingRoomCount}, Needed: ${roomsNeeded}`);

      // Create missing rooms
      const roomsToCreate = roomsNeeded - existingRoomCount;
      let allRooms = existingRooms || [];

      for (let i = 0; i < roomsToCreate; i++) {
        const roomNum = existingRoomCount + i + 1;
        const roomNumber = `${config.roomPrefix}-${String(roomNum).padStart(3, '0')}`;

        const { data: newRoom, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_number: roomNumber,
            room_type: config.roomType,
            ward_id: ward.id,
            department_id: correctDeptId,
            practice_id: correctPracticeId,
            floor: 1,
            is_active: true,
            max_capacity: config.bedsPerRoom,
            current_occupancy: 0,
            status: 'Available'
          })
          .select()
          .single();

        if (roomError) {
          console.error(`    Error creating room ${roomNumber}:`, roomError.message);
        } else {
          console.log(`    ✅ Created room: ${roomNumber}`);
          allRooms.push(newRoom);
        }
      }

      // Create beds for each room
      let totalBedsCreated = currentBeds || 0;

      for (const room of allRooms) {
        if (totalBedsCreated >= config.targetBeds) break;

        // Check existing beds in this room
        const { data: existingBeds } = await supabase
          .from('beds')
          .select('*')
          .eq('room_id', room.id);

        const existingBedCount = existingBeds?.length || 0;
        const bedsToAdd = Math.min(
          config.bedsPerRoom - existingBedCount,
          config.targetBeds - totalBedsCreated
        );

        for (let b = 0; b < bedsToAdd; b++) {
          const bedNum = existingBedCount + b + 1;
          const bedNumber = `${room.room_number}-B${bedNum}`;

          const { error: bedError } = await supabase
            .from('beds')
            .insert({
              bed_number: bedNumber,
              bed_status: 'Available',
              bed_type: config.roomType === 'Private' ? 'Standard' : 'Semi-Private',
              room_id: room.id,
              ward_id: ward.id,
              department_id: correctDeptId,
              practice_id: correctPracticeId,
              is_active: true,
              last_cleaned: new Date().toISOString()
            });

          if (bedError) {
            console.error(`      Error creating bed ${bedNumber}:`, bedError.message);
          } else {
            console.log(`      ✅ Created bed: ${bedNumber}`);
            totalBedsCreated++;
          }
        }
      }
    }

    // Final verification
    console.log('\n=================================');
    console.log('FINAL STATISTICS');
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

      const { count: availableBeds } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id)
        .eq('bed_status', 'Available');

      console.log(`${ward.ward_name} (${ward.ward_code}):`);
      console.log(`  Rooms: ${roomCount}`);
      console.log(`  Total Beds: ${bedCount}`);
      console.log(`  Available Beds: ${availableBeds}`);
      console.log('');
    }

    const { count: totalBeds } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    console.log(`📊 Grand Total for Clinical department:`);
    console.log(`  Total Wards: ${wards?.length || 0}`);
    console.log(`  Total Rooms: ${totalRooms}`);
    console.log(`  Total Beds: ${totalBeds}`);

    console.log('\n✅ ALL WARD DATA CREATED SUCCESSFULLY!');
    console.log('🔄 Please refresh the browser to see all wards, rooms, and beds in the Clinical department.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the creation
createAllWardData();