const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAllWards() {
  try {
    // First, check what wards already exist
    const { data: existingWards } = await supabase
      .from('wards')
      .select('ward_code, ward_name');

    console.log('Existing wards:', existingWards?.map(w => `${w.ward_name} (${w.ward_code})`).join(', '));

    // Get the first department
    const { data: departments } = await supabase
      .from('departments')
      .select('id, practice_id, name')
      .limit(1);

    if (!departments || departments.length === 0) {
      console.error('No departments found.');
      return;
    }

    const department = departments[0];
    console.log(`\nUsing department: ${department.name} (${department.id})`);

    // Define ALL wards that need to be created
    const wardsToCreate = [
      {
        name: 'Emergency Ward',
        code: 'EMG',
        type: 'Emergency',
        rooms: ['ER04', 'ER05', 'ER06', 'ER07', 'ER08']
      },
      {
        name: 'General Ward A',
        code: 'GWA',
        type: 'General',
        rooms: ['GWA03', 'GWA04', 'GWA05', 'GWA06', 'GWA07', 'GWA08', 'GWA09',
                'GWA10', 'GWA11', 'GWA12', 'GWA13', 'GWA14', 'GWA15', 'GWA16',
                'GWA17', 'GWA18', 'GWA19']
      },
      {
        name: 'Intensive Care Unit',
        code: 'ICU',
        type: 'ICU',
        rooms: ['ICU03', 'ICU04', 'ICU05', 'ICU06', 'ICU07', 'ICU08', 'ICU09']
      },
      {
        name: 'Maternity Ward',
        code: 'MAT',
        type: 'Maternity',
        rooms: ['MAT05', 'MAT06', 'MAT07', 'MAT08', 'MAT09', 'MAT10', 'MAT11']
      },
      {
        name: 'Pediatric Ward',
        code: 'PED',
        type: 'Pediatric',
        rooms: ['PED03', 'PED04', 'PED05', 'PED06', 'PED07', 'PED08', 'PED09',
                'PED10', 'PED11', 'PED12', 'PED13', 'PED14']
      }
    ];

    let totalWardsCreated = 0;
    let totalRoomsCreated = 0;
    let totalBedsCreated = 0;

    for (const wardData of wardsToCreate) {
      // Check if this ward already exists
      const { data: existingWard } = await supabase
        .from('wards')
        .select('*')
        .eq('ward_code', wardData.code)
        .single();

      let ward;

      if (existingWard) {
        console.log(`\n⚠️ Ward "${wardData.name}" already exists, using existing ward`);
        ward = existingWard;

        // Delete existing rooms and beds for this ward to recreate them properly
        console.log(`  Cleaning up existing rooms and beds...`);

        // Get all rooms for this ward
        const { data: existingRooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('ward_id', ward.id);

        if (existingRooms && existingRooms.length > 0) {
          // Delete beds in these rooms
          for (const room of existingRooms) {
            await supabase
              .from('beds')
              .delete()
              .eq('room_id', room.id);
          }

          // Delete the rooms
          await supabase
            .from('rooms')
            .delete()
            .eq('ward_id', ward.id);
        }
      } else {
        // Create new ward
        const { data: newWard, error: wardError } = await supabase
          .from('wards')
          .insert({
            ward_name: wardData.name,
            ward_code: wardData.code,
            department_id: department.id,
            practice_id: department.practice_id,
            capacity: wardData.rooms.length,
            current_occupancy: 0,
            ward_type: wardData.type,
            floor_number: 1,
            building: 'Main Building',
            is_active: true
          })
          .select()
          .single();

        if (wardError) {
          console.error(`\n❌ Error creating ward ${wardData.name}:`, wardError.message);
          continue;
        }

        ward = newWard;
        console.log(`\n✅ Created ward: ${wardData.name}`);
        totalWardsCreated++;
      }

      // Create rooms and beds for this ward
      for (const roomNumber of wardData.rooms) {
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_number: roomNumber,
            room_name: `Room ${roomNumber}`,
            room_type: wardData.type === 'ICU' ? 'ICU' :
                      wardData.type === 'Emergency' ? 'Emergency' :
                      wardData.type === 'Maternity' ? 'Maternity' :
                      wardData.type === 'Pediatric' ? 'Pediatric' : 'Standard',
            department_id: department.id,
            ward_id: ward.id,
            practice_id: department.practice_id,
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
          console.error(`  ❌ Error creating room ${roomNumber}:`, roomError.message);
          continue;
        }

        console.log(`  ✅ Created room: ${roomNumber}`);
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
            department_id: department.id,
            practice_id: department.practice_id,
            bed_type: room.room_type,
            bed_status: 'Available',
            is_active: true
          })
          .select()
          .single();

        if (bedError) {
          console.error(`    ❌ Error creating bed ${bedNumber}:`, bedError.message);
          continue;
        }

        console.log(`    ✅ Created bed: ${bedNumber}`);
        totalBedsCreated++;
      }
    }

    // Verify final state
    console.log('\n=================================');
    console.log('VERIFYING FINAL STATE...');
    console.log('=================================');

    const { data: finalWards } = await supabase
      .from('wards')
      .select('ward_name, ward_code')
      .eq('department_id', department.id)
      .order('ward_name');

    console.log('\nWards in database:');
    finalWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    console.log('\n=================================');
    console.log('✅ ALL WARDS CREATION COMPLETE!');
    console.log('=================================');
    console.log(`Total NEW Wards Created: ${totalWardsCreated}`);
    console.log(`Total Rooms Created: ${totalRoomsCreated}`);
    console.log(`Total Beds Created: ${totalBedsCreated}`);
    console.log('=================================');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
createAllWards();