const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateWards() {
  try {
    console.log('=================================');
    console.log('CLEANING UP DUPLICATE WARDS');
    console.log('=================================\n');

    const correctDeptId = '744ff11f-0ed5-449a-8c15-07e97ad882bc';

    // Get all wards from the correct department
    const { data: allWards } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', correctDeptId)
      .order('ward_name');

    console.log('Current wards in Clinical department:');
    allWards?.forEach(w => {
      console.log(`  - ${w.ward_name} (${w.ward_code}) - ID: ${w.id.substring(0, 8)}...`);
    });
    console.log('');

    // Identify and remove duplicates
    // Keep the newer ones (with -001 codes) and remove the old ones
    const wardsToDelete = [];

    // Find duplicates
    const gwaWards = allWards?.filter(w => w.ward_name.includes('General Ward') || w.ward_code.includes('GWA'));
    const icuWards = allWards?.filter(w => w.ward_name.includes('ICU') || w.ward_name.includes('Intensive'));
    const pedWards = allWards?.filter(w => w.ward_name.includes('Pediatric') || w.ward_code.includes('PED'));
    const matWards = allWards?.filter(w => w.ward_name.includes('Maternity') || w.ward_code.includes('MAT'));

    // Delete older duplicates (ones without -001 suffix or with simpler names)
    if (gwaWards?.length > 1) {
      const oldGwa = gwaWards.find(w => w.ward_code === 'GWA' && w.ward_name === 'Gen Ward');
      if (oldGwa) wardsToDelete.push(oldGwa);
    }

    if (icuWards?.length > 1) {
      const oldIcu = icuWards.find(w => w.ward_code === 'ICU' && w.ward_name === 'Intensive Care Unit');
      if (oldIcu) wardsToDelete.push(oldIcu);
    }

    if (pedWards?.length > 1) {
      const oldPed = pedWards.find(w => w.ward_code === 'PED' && !w.ward_code.includes('-001'));
      if (oldPed) wardsToDelete.push(oldPed);
    }

    if (matWards?.length > 1) {
      const oldMat = matWards.find(w => w.ward_code === 'MAT' && !w.ward_code.includes('-001'));
      if (oldMat) wardsToDelete.push(oldMat);
    }

    console.log('Wards to delete (duplicates):');
    for (const ward of wardsToDelete) {
      console.log(`  - ${ward.ward_name} (${ward.ward_code})`);

      // Delete beds first
      const { error: bedError } = await supabase
        .from('beds')
        .delete()
        .eq('ward_id', ward.id);

      if (bedError) {
        console.error(`Error deleting beds for ward ${ward.ward_name}:`, bedError);
      }

      // Delete rooms
      const { error: roomError } = await supabase
        .from('rooms')
        .delete()
        .eq('ward_id', ward.id);

      if (roomError) {
        console.error(`Error deleting rooms for ward ${ward.ward_name}:`, roomError);
      }

      // Delete the ward
      const { error: wardError } = await supabase
        .from('wards')
        .delete()
        .eq('id', ward.id);

      if (wardError) {
        console.error(`Error deleting ward ${ward.ward_name}:`, wardError);
      } else {
        console.log(`  ✅ Deleted duplicate: ${ward.ward_name}`);
      }
    }

    // Final verification
    console.log('\n=================================');
    console.log('FINAL WARD LIST');
    console.log('=================================\n');

    const { data: finalWards, count: wardCount } = await supabase
      .from('wards')
      .select('*')
      .eq('department_id', correctDeptId)
      .order('ward_name');

    console.log(`Clinical department now has ${wardCount} wards:`);
    finalWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    // Count beds per ward
    console.log('\nBeds per ward:');
    for (const ward of finalWards || []) {
      const { count: bedCount } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('ward_id', ward.id);

      console.log(`  ${ward.ward_name}: ${bedCount} beds`);
    }

    const { count: totalRoomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    const { count: totalBedCount } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', correctDeptId);

    console.log(`\n📊 Final Statistics for Clinical department:`);
    console.log(`  Total Wards: ${wardCount}`);
    console.log(`  Total Rooms: ${totalRoomCount}`);
    console.log(`  Total Beds: ${totalBedCount}`);

    console.log('\n✅ DUPLICATE WARDS CLEANED UP!');
    console.log('🔄 Please refresh the browser to see the updated wards.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the cleanup
cleanupDuplicateWards();