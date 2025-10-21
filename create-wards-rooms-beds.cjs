const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createWardsRoomsAndBeds() {
  try {
    // First, get the first department to assign these wards to
    const { data: departments } = await supabase
      .from('departments')
      .select('id, practice_id, name')
      .limit(1);

    if (!departments || departments.length === 0) {
      console.error('No departments found. Please create a department first.');
      return;
    }

    const department = departments[0];
    console.log(`Using department: ${department.name} (${department.id})`);

    // Define the wards and their rooms with bed counts
    const wardsData = [
      {
        name: 'Emergency Ward',
        code: 'EMG',
        type: 'Emergency',
        rooms: [
          { number: 'ER04', beds: 1 },
          { number: 'ER05', beds: 1 },
          { number: 'ER06', beds: 1 },
          { number: 'ER07', beds: 1 },
          { number: 'ER08', beds: 1 }
        ]
      },
      {
        name: 'General Ward A',
        code: 'GWA',
        type: 'General',
        rooms: [
          { number: 'GWA03', beds: 1 },
          { number: 'GWA04', beds: 1 },
          { number: 'GWA05', beds: 1 },
          { number: 'GWA06', beds: 1 },
          { number: 'GWA07', beds: 1 },
          { number: 'GWA08', beds: 1 },
          { number: 'GWA09', beds: 1 },
          { number: 'GWA10', beds: 1 },
          { number: 'GWA11', beds: 1 },
          { number: 'GWA12', beds: 1 },
          { number: 'GWA13', beds: 1 },
          { number: 'GWA14', beds: 1 },
          { number: 'GWA15', beds: 1 },
          { number: 'GWA16', beds: 1 },
          { number: 'GWA17', beds: 1 },
          { number: 'GWA18', beds: 1 },
          { number: 'GWA19', beds: 1 }
        ]
      },
      {
        name: 'Intensive Care Unit',
        code: 'ICU',
        type: 'ICU',
        rooms: [
          { number: 'ICU03', beds: 1 },
          { number: 'ICU04', beds: 1 },
          { number: 'ICU05', beds: 1 },
          { number: 'ICU06', beds: 1 },
          { number: 'ICU07', beds: 1 },
          { number: 'ICU08', beds: 1 },
          { number: 'ICU09', beds: 1 }
        ]
      },
      {
        name: 'Maternity Ward',
        code: 'MAT',
        type: 'Maternity',
        rooms: [
          { number: 'MAT05', beds: 1 },
          { number: 'MAT06', beds: 1 },
          { number: 'MAT07', beds: 1 },
          { number: 'MAT08', beds: 1 },
          { number: 'MAT09', beds: 1 },
          { number: 'MAT10', beds: 1 },
          { number: 'MAT11', beds: 1 }
        ]
      },
      {
        name: 'Pediatric Ward',
        code: 'PED',
        type: 'Pediatric',
        rooms: [
          { number: 'PED03', beds: 1 },
          { number: 'PED04', beds: 1 },
          { number: 'PED05', beds: 1 },
          { number: 'PED06', beds: 1 },
          { number: 'PED07', beds: 1 },
          { number: 'PED08', beds: 1 },
          { number: 'PED09', beds: 1 },
          { number: 'PED10', beds: 1 },
          { number: 'PED11', beds: 1 },
          { number: 'PED12', beds: 1 },
          { number: 'PED13', beds: 1 },
          { number: 'PED14', beds: 1 }
        ]
      }
    ];

    let totalWardsCreated = 0;
    let totalRoomsCreated = 0;
    let totalBedsCreated = 0;

    // Create each ward with its rooms and beds
    for (const wardData of wardsData) {
      // Create ward
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .insert({
          ward_name: wardData.name,
          ward_code: wardData.code,
          department_id: department.id,
          practice_id: department.practice_id,
          capacity: wardData.rooms.reduce((sum, r) => sum + r.beds, 0),
          current_occupancy: 0,
          ward_type: wardData.type,
          floor_number: 1,
          building: 'Main Building',
          is_active: true
        })
        .select()
        .single();

      if (wardError) {
        console.error(`Error creating ward ${wardData.name}:`, wardError);
        continue;
      }

      console.log(`✅ Created ward: ${wardData.name}`);
      totalWardsCreated++;

      // Create rooms for this ward
      for (const roomData of wardData.rooms) {
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_number: roomData.number,
            room_name: `Room ${roomData.number}`,
            room_type: wardData.type === 'ICU' ? 'ICU' :
                      wardData.type === 'Emergency' ? 'Emergency' :
                      wardData.type === 'Maternity' ? 'Maternity' :
                      wardData.type === 'Pediatric' ? 'Pediatric' : 'Standard',
            department_id: department.id,
            ward_id: ward.id,
            practice_id: department.practice_id,
            floor_number: 1,
            building: 'Main Building',
            bed_count: roomData.beds,
            occupied_beds: 0,
            room_status: 'Available',
            is_active: true
          })
          .select()
          .single();

        if (roomError) {
          console.error(`Error creating room ${roomData.number}:`, roomError);
          continue;
        }

        console.log(`  ✅ Created room: ${roomData.number}`);
        totalRoomsCreated++;

        // Create beds for this room
        for (let bedNum = 1; bedNum <= roomData.beds; bedNum++) {
          const bedNumber = `${roomData.number}-${bedNum}`;

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
            console.error(`Error creating bed ${bedNumber}:`, bedError);
            continue;
          }

          console.log(`    ✅ Created bed: ${bedNumber}`);
          totalBedsCreated++;
        }
      }
    }

    console.log('\n=================================');
    console.log('✅ CREATION COMPLETE!');
    console.log('=================================');
    console.log(`Total Wards Created: ${totalWardsCreated}`);
    console.log(`Total Rooms Created: ${totalRoomsCreated}`);
    console.log(`Total Beds Created: ${totalBedsCreated}`);
    console.log('=================================');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
createWardsRoomsAndBeds();