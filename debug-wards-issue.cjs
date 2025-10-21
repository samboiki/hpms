const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugWardsIssue() {
  try {
    console.log('=================================');
    console.log('DEBUGGING WARDS DATA ISSUE');
    console.log('=================================\n');

    // 1. Check all departments
    const { data: departments } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    console.log('ALL DEPARTMENTS:');
    console.log('-----------------');
    departments?.forEach(d => {
      console.log(`Name: ${d.name || d.department_name}`);
      console.log(`  ID: ${d.id}`);
      console.log(`  Code: ${d.department_code || 'none'}`);
      console.log(`  Practice ID: ${d.practice_id}`);
      console.log('');
    });

    // 2. Find the Clinicals department with code MED-10
    const clinicalsDept = departments?.find(d =>
      d.department_code === 'MED-10' ||
      (d.name && d.name.toLowerCase().includes('clinical'))
    );

    if (clinicalsDept) {
      console.log('TARGET CLINICALS DEPARTMENT:');
      console.log('-----------------------------');
      console.log(`Name: ${clinicalsDept.name || clinicalsDept.department_name}`);
      console.log(`ID: ${clinicalsDept.id}`);
      console.log(`Code: ${clinicalsDept.department_code}`);
      console.log(`Practice ID: ${clinicalsDept.practice_id}\n`);
    }

    // 3. Check ALL wards in the database
    const { data: allWards } = await supabase
      .from('wards')
      .select('*')
      .order('ward_name');

    console.log('ALL WARDS IN DATABASE:');
    console.log('----------------------');
    allWards?.forEach(w => {
      console.log(`${w.ward_name} (${w.ward_code})`);
      console.log(`  Ward ID: ${w.id}`);
      console.log(`  Department ID: ${w.department_id}`);
      console.log(`  Practice ID: ${w.practice_id}`);
      const belongsToClinicals = clinicalsDept && w.department_id === clinicalsDept.id;
      console.log(`  Belongs to Clinicals: ${belongsToClinicals ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    // 4. Check rooms and beds count for Clinicals department
    if (clinicalsDept) {
      const { count: wardCount } = await supabase
        .from('wards')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', clinicalsDept.id);

      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', clinicalsDept.id);

      const { count: bedCount } = await supabase
        .from('beds')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', clinicalsDept.id);

      console.log('CLINICALS DEPARTMENT STATISTICS:');
      console.log('---------------------------------');
      console.log(`Wards: ${wardCount}`);
      console.log(`Rooms: ${roomCount}`);
      console.log(`Beds: ${bedCount}\n`);
    }

    // 5. Check if there's a mismatch in practice_id
    const { data: practices } = await supabase
      .from('practices')
      .select('id, practice_name');

    console.log('PRACTICES:');
    console.log('----------');
    practices?.forEach(p => {
      console.log(`${p.practice_name}: ${p.id}`);
    });

    // 6. Final diagnosis
    console.log('\n=================================');
    console.log('DIAGNOSIS:');
    console.log('=================================');

    if (!clinicalsDept) {
      console.log('❌ PROBLEM: No Clinicals department found with code MED-10');
    } else {
      const { data: clinicalWards } = await supabase
        .from('wards')
        .select('*')
        .eq('department_id', clinicalsDept.id);

      if (!clinicalWards || clinicalWards.length === 0) {
        console.log('❌ PROBLEM: No wards are assigned to the Clinicals department');
        console.log(`   Department ID: ${clinicalsDept.id}`);
        console.log('\n   SOLUTION: Need to update all medical wards to have:');
        console.log(`   - department_id: ${clinicalsDept.id}`);
        console.log(`   - practice_id: ${clinicalsDept.practice_id}`);
      } else {
        console.log('✅ Wards are properly assigned to Clinicals department');
        console.log(`   Found ${clinicalWards.length} wards`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
debugWardsIssue();