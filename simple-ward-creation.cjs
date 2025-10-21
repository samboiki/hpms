const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simpleWardCreation() {
  try {
    console.log('=================================');
    console.log('SIMPLE WARD CREATION');
    console.log('=================================\n');

    // Find Clinical department
    const { data: departments } = await supabase
      .from('departments')
      .select('*');

    const clinicalDept = departments?.find(d =>
      d.name?.toLowerCase().includes('clinical')
    );

    if (!clinicalDept) {
      console.error('No Clinical department found!');
      return;
    }

    console.log(`Using department: ${clinicalDept.name} (${clinicalDept.id})\n`);

    // Create 5 simple wards without rooms/beds for now
    const wardsToCreate = [
      { name: 'Emergency Ward', code: 'EMG' },
      { name: 'General Ward A', code: 'GWA' },
      { name: 'Intensive Care Unit', code: 'ICU' },
      { name: 'Maternity Ward', code: 'MAT' },
      { name: 'Pediatric Ward', code: 'PED' }
    ];

    for (const wardInfo of wardsToCreate) {
      // Check if ward already exists
      const { data: existingWard } = await supabase
        .from('wards')
        .select('*')
        .eq('ward_code', wardInfo.code)
        .eq('department_id', clinicalDept.id)
        .single();

      if (existingWard) {
        console.log(`✓ Ward already exists: ${wardInfo.name} (${wardInfo.code})`);
        continue;
      }

      // Create the ward
      const { data: newWard, error: wardError } = await supabase
        .from('wards')
        .insert({
          ward_name: wardInfo.name,
          ward_code: wardInfo.code,
          department_id: clinicalDept.id,
          practice_id: clinicalDept.practice_id,
          capacity: 20,
          current_occupancy: 0,
          ward_type: 'General',
          floor_number: 1,
          building: 'Main Building',
          nurse_station_phone: '',
          is_active: true
        })
        .select()
        .single();

      if (wardError) {
        console.error(`Error creating ${wardInfo.name}:`, wardError.message);
      } else {
        console.log(`✅ Created ward: ${wardInfo.name} (${wardInfo.code})`);
      }
    }

    // Final check
    console.log('\n=================================');
    console.log('VERIFICATION');
    console.log('=================================\n');

    const { data: allWards, count } = await supabase
      .from('wards')
      .select('*', { count: 'exact' })
      .eq('department_id', clinicalDept.id)
      .order('ward_name');

    console.log(`Clinical department now has ${count} wards:`);
    allWards?.forEach(w => {
      console.log(`  ✓ ${w.ward_name} (${w.ward_code})`);
    });

    console.log('\n✅ WARDS CREATED SUCCESSFULLY!');
    console.log('🔄 Please refresh the browser to see the wards in the Clinical department.');
    console.log('\n⚠️ NOTE: Rooms and beds were NOT created due to schema issues.');
    console.log('The UI should now show the wards, but the bed counts will be 0.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the creation
simpleWardCreation();