const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function moveWardsToClinicals() {
  try {
    console.log('=================================');
    console.log('MOVING WARDS TO CORRECT DEPARTMENT');
    console.log('=================================\n');

    // The UI is looking for this department
    const correctDeptId = 'cdfbf4c4-00aa-4006-8c0c-9c9b9a08a6eb';
    const correctPracticeId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

    // We created wards under this department
    const wrongDeptId = '744ff11f-0ed5-449a-8c15-07e97ad882bc';

    console.log('Target department (what UI shows): Clinicals');
    console.log('  ID:', correctDeptId);
    console.log('  Practice:', correctPracticeId);
    console.log('');
    console.log('Current wards location: Clinical');
    console.log('  ID:', wrongDeptId);
    console.log('');

    // Get all wards from the wrong department
    const { data: wardsToMove, error: fetchError } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', wrongDeptId);

    if (fetchError) {
      console.error('Error fetching wards:', fetchError);
      return;
    }

    console.log('Found', wardsToMove?.length || 0, 'wards to move:');
    console.log('');
    wardsToMove?.forEach(w => {
      console.log('  -', w.ward_name, '(' + w.ward_code + ')');
    });
    console.log('');

    // Move each ward
    for (const ward of wardsToMove || []) {
      console.log('Moving', ward.ward_name, '...');

      // Update ward
      const { error: wardError } = await supabase
        .from('wards')
        .update({
          department_id: correctDeptId,
          practice_id: correctPracticeId
        })
        .eq('id', ward.id);

      if (wardError) {
        console.error('  Error updating ward:', wardError.message);
        continue;
      }

      console.log('  ✅ Moved ward to Clinicals department');

      // Update all rooms for this ward
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('ward_id', ward.id);

      if (rooms && rooms.length > 0) {
        const { error: roomsError } = await supabase
          .from('rooms')
          .update({
            department_id: correctDeptId,
            practice_id: correctPracticeId
          })
          .eq('ward_id', ward.id);

        if (!roomsError) {
          console.log('  ✅ Updated', rooms.length, 'rooms');
        }
      }

      // Update all beds for this ward
      const { data: beds } = await supabase
        .from('beds')
        .select('id')
        .eq('ward_id', ward.id);

      if (beds && beds.length > 0) {
        const { error: bedsError } = await supabase
          .from('beds')
          .update({
            department_id: correctDeptId,
            practice_id: correctPracticeId
          })
          .eq('ward_id', ward.id);

        if (!bedsError) {
          console.log('  ✅ Updated', beds.length, 'beds');
        }
      }

      console.log('');
    }

    // Verify the move
    console.log('=================================');
    console.log('VERIFICATION');
    console.log('=================================');
    console.log('');

    const { data: finalWards, count } = await supabase
      .from('wards')
      .select('*', { count: 'exact' })
      .eq('department_id', correctDeptId)
      .order('ward_name');

    console.log('Clinicals department now has', count, 'wards:');
    console.log('');

    for (const ward of finalWards || []) {
      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      const { count: bedCount } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      console.log(ward.ward_name, '(' + ward.ward_code + '):');
      console.log('  Rooms:', roomCount || 0);
      console.log('  Beds:', bedCount || 0);
      console.log('');
    }

    console.log('✅ ALL WARDS MOVED SUCCESSFULLY!');
    console.log('🔄 Refresh the browser - wards should now appear in Clinicals MED-10!');

  } catch (error) {
    console.error('Error:', error);
  }
}

moveWardsToClinicals();
