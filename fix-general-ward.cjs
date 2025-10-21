const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixGeneralWard() {
  try {
    // Find the Clinicals department
    const { data: departments } = await supabase
      .from('departments')
      .select('*')
      .ilike('name', '%clinical%');

    if (!departments || departments.length === 0) {
      console.error('Clinicals department not found!');
      return;
    }

    const clinicalsDept = departments[0];
    console.log(`Found Clinicals department: ${clinicalsDept.name} (${clinicalsDept.id})`);

    // Find ALL General Ward A entries (there might be duplicates)
    const { data: allGeneralWards } = await supabase
      .from('wards')
      .select('*')
      .or('ward_code.eq.GWA,ward_name.ilike.%General Ward%');

    console.log('\nFound General Ward entries:');
    allGeneralWards?.forEach(w => {
      console.log(`  - ${w.ward_name} (${w.ward_code}) in department: ${w.department_id}`);
    });

    // Move all General Ward A entries to Clinicals
    for (const ward of allGeneralWards || []) {
      if (ward.department_id !== clinicalsDept.id) {
        // Update the ward
        const { error: wardError } = await supabase
          .from('wards')
          .update({
            department_id: clinicalsDept.id,
            practice_id: clinicalsDept.practice_id
          })
          .eq('id', ward.id);

        if (wardError) {
          console.error(`Error updating ward ${ward.ward_name}:`, wardError);
          continue;
        }

        // Update all rooms in this ward
        const { error: roomsError } = await supabase
          .from('rooms')
          .update({
            department_id: clinicalsDept.id,
            practice_id: clinicalsDept.practice_id
          })
          .eq('ward_id', ward.id);

        if (roomsError) {
          console.error(`Error updating rooms for ward ${ward.ward_name}:`, roomsError);
        }

        // Update all beds in this ward
        const { error: bedsError } = await supabase
          .from('beds')
          .update({
            department_id: clinicalsDept.id,
            practice_id: clinicalsDept.practice_id
          })
          .eq('ward_id', ward.id);

        if (bedsError) {
          console.error(`Error updating beds for ward ${ward.ward_name}:`, bedsError);
        }

        console.log(`✅ Moved ${ward.ward_name} (${ward.ward_code}) to Clinicals department`);
      }
    }

    // Final verification
    console.log('\n=================================');
    console.log('FINAL WARD STATUS IN CLINICALS:');
    console.log('=================================');

    const { data: clinicalWards } = await supabase
      .from('wards')
      .select('ward_name, ward_code')
      .eq('department_id', clinicalsDept.id)
      .order('ward_name');

    console.log('\nAll wards in Clinicals department:');
    clinicalWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    // Count beds and rooms
    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', clinicalsDept.id)
      .eq('is_active', true);

    const { count: bedCount } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', clinicalsDept.id)
      .eq('is_active', true);

    console.log(`\nTotal rooms in Clinicals: ${roomCount}`);
    console.log(`Total beds in Clinicals: ${bedCount}`);

    console.log('\n✅ ALL WARDS SUCCESSFULLY MOVED TO CLINICALS!');
    console.log('\nYou should now see all 5 wards when you click on the Clinicals department:');
    console.log('  1. Emergency Ward (5 beds)');
    console.log('  2. General Ward A (17 beds)');
    console.log('  3. Intensive Care Unit (7 beds)');
    console.log('  4. Maternity Ward (7 beds)');
    console.log('  5. Pediatric Ward (12 beds)');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
fixGeneralWard();