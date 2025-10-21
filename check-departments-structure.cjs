const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function checkDepartments() {
  console.log('🔍 DEPARTMENTS TABLE STRUCTURE CHECK\n');
  console.log('='.repeat(80));

  try {
    // Try to get departments with all columns
    const { data: depts, error: deptsError } = await supabase
      .from('departments')
      .select('*')
      .limit(5);

    if (depts && depts.length > 0) {
      console.log('✅ Departments table structure:');
      console.log('Columns:', Object.keys(depts[0]));
      console.log('\nSample departments:');
      console.table(depts);

      // Check if department_ids from wards exist in departments
      console.log('\n📊 WARD-DEPARTMENT RELATIONSHIP CHECK:');
      console.log('-'.repeat(80));

      const { data: wards } = await supabase
        .from('hospital_wards')
        .select('id, ward_name, department_id')
        .not('department_id', 'is', null);

      if (wards) {
        console.log(`\nWards with department_id set: ${wards.length}`);

        for (const ward of wards) {
          // Try to find matching department by id column
          const { data: dept, error } = await supabase
            .from('departments')
            .select('*')
            .eq('id', ward.department_id)
            .single();

          if (dept) {
            console.log(`✅ Ward "${ward.ward_name}" → Department "${dept.name}" (ID: ${dept.id})`);
          } else {
            console.log(`❌ Ward "${ward.ward_name}" → Department ID ${ward.department_id} NOT FOUND`);
            console.log(`   Error: ${error?.message}`);
          }
        }
      }

      // Get all departments to see what's available
      console.log('\n📊 ALL AVAILABLE DEPARTMENTS:');
      console.log('-'.repeat(80));
      const { data: allDepts } = await supabase
        .from('departments')
        .select('id, name, practice_id, is_active')
        .order('name');

      if (allDepts) {
        console.log(`Total departments: ${allDepts.length}\n`);
        allDepts.forEach(d => {
          console.log(`  ${d.name} (ID: ${d.id})`);
          console.log(`    Practice: ${d.practice_id}`);
          console.log(`    Active: ${d.is_active}`);
          console.log('');
        });
      }

    } else {
      console.log('❌ Error getting departments:', deptsError?.message);
      console.log('Error details:', deptsError);
    }

    console.log('\n✅ Check complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkDepartments();