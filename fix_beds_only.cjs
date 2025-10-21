const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBeds() {
  console.log('🔧 FIXING BEDS practice_id AND department_id\n');

  // Get all beds
  const { data: allBeds, error } = await supabase
    .from('beds')
    .select('id, ward_id');

  if (error) {
    console.error('❌ Error fetching beds:', error);
    return;
  }

  console.log(`Found ${allBeds.length} beds to update\n`);

  let successCount = 0;
  let errorCount = 0;

  // Process in batches to avoid timeout
  for (let i = 0; i < allBeds.length; i++) {
    const bed = allBeds[i];
    process.stdout.write(`\rProcessing bed ${i + 1}/${allBeds.length}...`);

    try {
      // Get ward info
      const { data: ward } = await supabase
        .from('wards')
        .select('practice_id, department_id')
        .eq('id', bed.ward_id)
        .single();

      if (ward && ward.practice_id) {
        // Update bed
        const { error: updateError } = await supabase
          .from('beds')
          .update({
            practice_id: ward.practice_id,
            department_id: ward.department_id
          })
          .eq('id', bed.id);

        if (updateError) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    } catch (err) {
      errorCount++;
    }
  }

  console.log(`\n\n✅ Update complete:`);
  console.log(`   Successfully updated: ${successCount} beds`);
  console.log(`   Errors: ${errorCount} beds`);

  // Verify
  console.log('\n📊 VERIFICATION:\n');

  const { data: verifyBeds } = await supabase
    .from('beds')
    .select('practice_id, department_id');

  if (verifyBeds) {
    const bedsWithPractice = verifyBeds.filter(b => b.practice_id !== null).length;
    const bedsWithDept = verifyBeds.filter(b => b.department_id !== null).length;

    console.log(`Beds with practice_id: ${bedsWithPractice}/${verifyBeds.length}`);
    console.log(`Beds with department_id: ${bedsWithDept}/${verifyBeds.length}`);
  }

  // Sample
  const { data: sampleBeds } = await supabase
    .from('beds')
    .select('bed_number, ward_id, room_id, practice_id, department_id')
    .limit(5);

  console.log('\n📋 Sample Beds:');
  console.table(sampleBeds);
}

fixBeds().catch(console.error);