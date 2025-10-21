const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugWardFetching() {
  try {
    console.log('=================================');
    console.log('DEBUGGING WARD FETCHING ISSUE');
    console.log('=================================\n');

    // 1. Find all Clinical departments
    const { data: allDepts } = await supabase
      .from('departments')
      .select('*');

    const clinicalDepts = allDepts?.filter(d =>
      d.name?.toLowerCase().includes('clinical')
    );

    console.log('Clinical departments found:');
    clinicalDepts?.forEach(d => {
      console.log(`  - ${d.name}`);
      console.log(`    ID: ${d.id}`);
      console.log(`    Code: ${d.department_code || 'none'}`);
      console.log(`    Practice: ${d.practice_id}`);
      console.log('');
    });

    // 2. Check which one shows "MED-10" in the UI
    console.log('Checking which department has code "MED-10":');
    const med10Dept = allDepts?.find(d => d.department_code === 'MED-10');
    if (med10Dept) {
      console.log(`✅ Found: ${med10Dept.name} (${med10Dept.id})`);
    } else {
      console.log('❌ No department with code "MED-10" found');
    }
    console.log('');

    // 3. For EACH Clinical department, check what wards it has
    for (const dept of clinicalDepts || []) {
      console.log(`\n--- Wards for ${dept.name} (${dept.id}) ---`);

      const { data: wards, error } = await supabase
        .from('wards')
        .select('*')
        .eq('department_id', dept.id);

      if (error) {
        console.error('Error fetching wards:', error);
      } else if (!wards || wards.length === 0) {
        console.log('  ⚠️ NO WARDS FOUND for this department');
      } else {
        console.log(`  ✅ Found ${wards.length} wards:`);
        wards.forEach(w => {
          console.log(`    - ${w.ward_name} (${w.ward_code})`);
        });
      }
    }

    // 4. Check ALL wards in database and their departments
    console.log('\n=================================');
    console.log('ALL WARDS IN DATABASE');
    console.log('=================================\n');

    const { data: allWards } = await supabase
      .from('wards')
      .select('*')
      .order('ward_name');

    console.log(`Total wards in database: ${allWards?.length || 0}\n`);

    for (const ward of allWards || []) {
      const dept = allDepts?.find(d => d.id === ward.department_id);
      console.log(`${ward.ward_name} (${ward.ward_code})`);
      console.log(`  Department: ${dept?.name || 'Unknown'} (${ward.department_id})`);
      console.log(`  Practice: ${ward.practice_id}`);
      console.log('');
    }

    // 5. Simulate what the UI is doing
    console.log('=================================');
    console.log('SIMULATING UI QUERY');
    console.log('=================================\n');

    // The UI shows "Clinicals MED-10", so let's find that exact department
    const uiDepartment = allDepts?.find(d =>
      d.name?.toLowerCase().includes('clinical') &&
      (d.department_code === 'MED-10' || !d.department_code)
    );

    if (uiDepartment) {
      console.log(`UI is showing: ${uiDepartment.name} (${uiDepartment.department_code || 'no code'})`);
      console.log(`Department ID: ${uiDepartment.id}`);
      console.log(`Practice ID: ${uiDepartment.practice_id}\n`);

      console.log('Fetching wards with query:');
      console.log(`  .from('wards').select('*').eq('department_id', '${uiDepartment.id}')\n`);

      const { data: uiWards, error: uiError } = await supabase
        .from('wards')
        .select('*')
        .eq('department_id', uiDepartment.id);

      if (uiError) {
        console.error('ERROR:', uiError);
      } else {
        console.log(`Result: ${uiWards?.length || 0} wards found`);
        if (uiWards && uiWards.length > 0) {
          console.log('✅ WARDS SHOULD BE VISIBLE:');
          uiWards.forEach(w => {
            console.log(`  - ${w.ward_name} (${w.ward_code})`);
          });
        } else {
          console.log('❌ NO WARDS FOUND - THIS IS THE PROBLEM!');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the debug
debugWardFetching();