const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDepartmentMismatch() {
  try {
    console.log('=================================');
    console.log('FIXING DEPARTMENT ID MISMATCH');
    console.log('=================================\n');

    // The correct Clinical department that the UI is using
    const correctClinicalId = '744ff11f-0ed5-449a-8c15-07e97ad882bc';
    const correctPracticeId = '5da3896d-b9f3-4b0a-996a-3adca867cb30';

    // The incorrect Clinicals department where wards are currently assigned
    const incorrectClinicalId = 'cdfbf4c4-00aa-4006-8c0c-9c9b9a08a6eb';

    console.log('Target Clinical department ID:', correctClinicalId);
    console.log('Moving wards from department ID:', incorrectClinicalId);
    console.log('');

    // Get all wards from the incorrect department
    const { data: wardsToMove } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', incorrectClinicalId);

    console.log('Wards to move:');
    wardsToMove?.forEach(w => {
      console.log(`  - ${w.ward_name} (${w.ward_code})`);
    });
    console.log('');

    // Update each ward to the correct department
    for (const ward of wardsToMove || []) {
      // Update ward
      const { error: wardError } = await supabase
        .from('wards')
        .update({
          department_id: correctClinicalId,
          practice_id: correctPracticeId
        })
        .eq('id', ward.id);

      if (wardError) {
        console.error(`Error updating ward ${ward.ward_name}:`, wardError);
        continue;
      }

      console.log(`✅ Moved ward: ${ward.ward_name}`);

      // Update all rooms in this ward
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('ward_id', ward.id);

      for (const room of rooms || []) {
        // Update room
        await supabase
          .from('rooms')
          .update({
            department_id: correctClinicalId,
            practice_id: correctPracticeId
          })
          .eq('id', room.id);

        // Update all beds in this room
        await supabase
          .from('beds')
          .update({
            department_id: correctClinicalId,
            practice_id: correctPracticeId
          })
          .eq('room_id', room.id);
      }

      // Also update beds directly linked to ward
      await supabase
        .from('beds')
        .update({
          department_id: correctClinicalId,
          practice_id: correctPracticeId
        })
        .eq('ward_id', ward.id);
    }

    // Also check for any orphaned rooms/beds that might have the wrong department
    console.log('\nChecking for orphaned rooms...');

    const { data: orphanedRooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('department_id', incorrectClinicalId);

    for (const room of orphanedRooms || []) {
      await supabase
        .from('rooms')
        .update({
          department_id: correctClinicalId,
          practice_id: correctPracticeId
        })
        .eq('id', room.id);

      console.log(`✅ Fixed orphaned room: ${room.room_number}`);
    }

    const { data: orphanedBeds } = await supabase
      .from('beds')
      .select('*')
      .eq('department_id', incorrectClinicalId);

    for (const bed of orphanedBeds || []) {
      await supabase
        .from('beds')
        .update({
          department_id: correctClinicalId,
          practice_id: correctPracticeId
        })
        .eq('id', bed.id);

      console.log(`✅ Fixed orphaned bed: ${bed.bed_number}`);
    }

    // Final verification
    console.log('\n=================================');
    console.log('VERIFICATION');
    console.log('=================================\n');

    const { data: finalWards, count: wardCount } = await supabase
      .from('wards')
      .select('ward_name, ward_code', { count: 'exact' })
      .eq('department_id', correctClinicalId)
      .order('ward_name');

    console.log(`Clinical department now has ${wardCount} wards:`);
    finalWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctClinicalId);

    const { count: bedCount } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctClinicalId);

    console.log(`\n📊 Statistics for Clinical department:`);
    console.log(`  Total Wards: ${wardCount}`);
    console.log(`  Total Rooms: ${roomCount}`);
    console.log(`  Total Beds: ${bedCount}`);

    console.log('\n✅ ALL WARDS HAVE BEEN MOVED TO THE CORRECT DEPARTMENT!');
    console.log('🔄 Please refresh the browser to see all wards in the Clinical department.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the fix
fixDepartmentMismatch();