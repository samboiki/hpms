const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalFixAllWards() {
  try {
    console.log('=================================');
    console.log('FINAL COMPREHENSIVE FIX');
    console.log('=================================\n');

    // Step 1: Find the Clinical department
    const { data: departments } = await supabase
      .from('departments')
      .select('*');

    // Filter for Clinical departments
    const clinicalDepts = departments?.filter(d =>
      d.name?.toLowerCase().includes('clinical')
    );

    console.log('Found departments with "Clinical" in name:');
    clinicalDepts?.forEach(d => {
      console.log(`  - ${d.name} (ID: ${d.id}, Practice: ${d.practice_id})`);
    });

    // Use the first Clinical department
    const clinicalDept = clinicalDepts?.[0];
    if (!clinicalDept) {
      console.error('No Clinical department found!');
      return;
    }

    console.log(`\n✅ Using: ${clinicalDept.name} (${clinicalDept.id})`);
    console.log(`   Practice ID: ${clinicalDept.practice_id}\n`);

    // Step 2: Define what we want
    const targetWards = [
      { name: 'Emergency Ward', code: 'EMG', beds: 5, roomType: 'Emergency' },
      { name: 'General Ward A', code: 'GWA', beds: 17, roomType: 'Semi-Private' },
      { name: 'Intensive Care Unit', code: 'ICU', beds: 7, roomType: 'Private' },
      { name: 'Maternity Ward', code: 'MAT', beds: 7, roomType: 'Private' },
      { name: 'Pediatric Ward', code: 'PED', beds: 12, roomType: 'Semi-Private' }
    ];

    // Step 3: Clean up ALL existing wards first
    console.log('Cleaning up existing wards...');
    const { data: existingWards } = await supabase
      .from('wards')
      .select('*');

    for (const ward of existingWards || []) {
      // Delete all beds in this ward
      await supabase.from('beds').delete().eq('ward_id', ward.id);
      // Delete all rooms in this ward
      await supabase.from('rooms').delete().eq('ward_id', ward.id);
      // Delete the ward
      await supabase.from('wards').delete().eq('id', ward.id);
    }
    console.log('✅ Cleaned up all existing wards\n');

    // Step 4: Create fresh wards
    console.log('Creating fresh wards...');
    for (const targetWard of targetWards) {
      // Create the ward
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .insert({
          ward_name: targetWard.name,
          ward_code: targetWard.code,
          department_id: clinicalDept.id,
          practice_id: clinicalDept.practice_id,
          capacity: targetWard.beds,
          ward_type: 'General',
          floor_number: 1,
          building: 'Main Building',
          nurse_station_phone: '',
          is_active: true
        })
        .select()
        .single();

      if (wardError) {
        console.error(`Error creating ward ${targetWard.name}:`, wardError);
        continue;
      }

      console.log(`✅ Created ward: ${targetWard.name} (${targetWard.code})`);

      // Create rooms and beds
      let bedsCreated = 0;
      let roomNumber = 1;

      while (bedsCreated < targetWard.beds) {
        const roomCode = `${targetWard.code}-${String(roomNumber).padStart(3, '0')}`;
        const bedsInThisRoom = targetWard.roomType === 'Private' ? 1 :
                               Math.min(2, targetWard.beds - bedsCreated);

        // Create room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_number: roomCode,
            room_type: targetWard.roomType,
            ward_id: ward.id,
            department_id: clinicalDept.id,
            practice_id: clinicalDept.practice_id,
            floor: 1,
            is_active: true,
            max_capacity: bedsInThisRoom,
            status: 'Available'
          })
          .select()
          .single();

        if (roomError) {
          console.error(`  Error creating room ${roomCode}:`, roomError);
          roomNumber++;
          continue;
        }

        console.log(`  ✅ Created room: ${roomCode}`);

        // Create beds in this room
        for (let b = 1; b <= bedsInThisRoom; b++) {
          const bedCode = `${roomCode}-B${b}`;

          const { error: bedError } = await supabase
            .from('beds')
            .insert({
              bed_number: bedCode,
              bed_status: 'Available',
              bed_type: targetWard.roomType === 'Private' ? 'Standard' : 'Semi-Private',
              room_id: room.id,
              ward_id: ward.id,
              department_id: clinicalDept.id,
              practice_id: clinicalDept.practice_id,
              is_active: true
            });

          if (bedError) {
            console.error(`    Error creating bed ${bedCode}:`, bedError);
          } else {
            console.log(`    ✅ Created bed: ${bedCode}`);
            bedsCreated++;
          }
        }

        roomNumber++;
      }
    }

    // Step 5: Final verification
    console.log('\n=================================');
    console.log('FINAL VERIFICATION');
    console.log('=================================\n');

    const { data: finalWards } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', clinicalDept.id)
      .order('ward_name');

    console.log(`Clinical department (${clinicalDept.name}) now has ${finalWards?.length || 0} wards:\n`);

    for (const ward of finalWards || []) {
      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      const { count: bedCount } = await supabase
        .from('beds')
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
      console.log(`  Available Beds: ${availableBeds}\n`);
    }

    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', clinicalDept.id);

    const { count: totalBeds } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', clinicalDept.id);

    console.log('📊 GRAND TOTAL:');
    console.log(`  Department: ${clinicalDept.name}`);
    console.log(`  Total Wards: ${finalWards?.length || 0}`);
    console.log(`  Total Rooms: ${totalRooms}`);
    console.log(`  Total Beds: ${totalBeds}`);

    console.log('\n✅ ALL DONE! Refresh the browser to see the complete ward setup.');
    console.log('🎯 All wards are now properly assigned to the Clinical department.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the final fix
finalFixAllWards();