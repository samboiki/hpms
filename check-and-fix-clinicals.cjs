const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixClinicals() {
  try {
    // Find ALL departments with "Clinical" in the name
    const { data: allClinicalDepts } = await supabase
      .from('departments')
      .select('*')
      .or('name.ilike.%clinical%,department_code.eq.MED-10');

    console.log('Found Clinical departments:');
    allClinicalDepts?.forEach(d => {
      console.log(`  - ${d.name} (Code: ${d.department_code || 'none'}, ID: ${d.id})`);
    });

    // Find the one with code MED-10 (this is what's showing in UI)
    const targetDept = allClinicalDepts?.find(d => d.department_code === 'MED-10') || allClinicalDepts?.[0];

    if (!targetDept) {
      console.error('No Clinicals department found!');
      return;
    }

    console.log(`\nTarget department for wards: ${targetDept.name} (${targetDept.id})`);

    // Get all medical wards regardless of department
    const { data: allWards } = await supabase
      .from('wards')
      .select('*')
      .in('ward_code', ['EMG', 'GWA', 'ICU', 'MAT', 'PED', 'GWA-001', 'ICU-001', 'MAT-001', 'PED-001']);

    console.log('\nFound medical wards in database:');
    allWards?.forEach(w => {
      console.log(`  - ${w.ward_name} (${w.ward_code}) in dept: ${w.department_id}`);
    });

    // Move ALL medical wards to the correct Clinicals department
    let wardsUpdated = 0;
    let roomsUpdated = 0;
    let bedsUpdated = 0;

    for (const ward of allWards || []) {
      if (ward.department_id !== targetDept.id) {
        // Update ward
        await supabase
          .from('wards')
          .update({
            department_id: targetDept.id,
            practice_id: targetDept.practice_id
          })
          .eq('id', ward.id);

        // Update rooms
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('ward_id', ward.id);

        for (const room of rooms || []) {
          await supabase
            .from('rooms')
            .update({
              department_id: targetDept.id,
              practice_id: targetDept.practice_id
            })
            .eq('id', room.id);

          // Update beds in this room
          await supabase
            .from('beds')
            .update({
              department_id: targetDept.id,
              practice_id: targetDept.practice_id
            })
            .eq('room_id', room.id);
        }

        console.log(`✅ Moved ${ward.ward_name} to ${targetDept.name}`);
        wardsUpdated++;
      }
    }

    // Also check for orphaned rooms and beds
    console.log('\nChecking for orphaned rooms...');

    const { data: medicalRooms } = await supabase
      .from('rooms')
      .select('*')
      .or('room_number.like.ER%,room_number.like.GWA%,room_number.like.ICU%,room_number.like.MAT%,room_number.like.PED%');

    for (const room of medicalRooms || []) {
      if (room.department_id !== targetDept.id) {
        await supabase
          .from('rooms')
          .update({
            department_id: targetDept.id,
            practice_id: targetDept.practice_id
          })
          .eq('id', room.id);

        await supabase
          .from('beds')
          .update({
            department_id: targetDept.id,
            practice_id: targetDept.practice_id
          })
          .eq('room_id', room.id);

        roomsUpdated++;
        console.log(`  ✅ Fixed orphaned room ${room.room_number}`);
      }
    }

    // Final verification
    console.log('\n=================================');
    console.log(`FINAL STATUS FOR ${targetDept.name}:`);
    console.log('=================================');

    const { data: finalWards, count: wardCount } = await supabase
      .from('wards')
      .select('ward_name, ward_code', { count: 'exact' })
      .eq('department_id', targetDept.id)
      .order('ward_name');

    console.log(`\nWards (${wardCount} total):`);
    finalWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', targetDept.id)
      .eq('is_active', true);

    const { count: bedCount } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', targetDept.id)
      .eq('is_active', true);

    const { count: availableBeds } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', targetDept.id)
      .eq('bed_status', 'Available')
      .eq('is_active', true);

    console.log(`\n📊 Statistics:`);
    console.log(`  Total Wards: ${wardCount}`);
    console.log(`  Total Rooms: ${roomCount}`);
    console.log(`  Total Beds: ${bedCount}`);
    console.log(`  Available Beds: ${availableBeds}`);

    console.log('\n✅ DONE! Refresh the page to see the wards in Clinicals department.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
checkAndFixClinicals();