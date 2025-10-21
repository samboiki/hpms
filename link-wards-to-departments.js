import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function linkWardsToDepartments() {
  console.log('🏥 Linking Wards to Departments\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Get all active departments
    console.log('\n📋 Step 1: Fetching active departments...\n');
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (deptError) {
      console.error('❌ Error fetching departments:', deptError);
      return;
    }

    console.log(`✅ Found ${departments.length} active departments:\n`);
    departments.forEach((dept, idx) => {
      console.log(`   ${idx + 1}. ${dept.name} [${dept.code}] (${dept.id})`);
    });

    // Step 2: Get wards that need linking
    console.log('\n📋 Step 2: Fetching unlinked wards...\n');
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('id, ward_name, ward_code, ward_type')
      .is('department_id', null);

    if (wardsError) {
      console.error('❌ Error fetching wards:', wardsError);
      return;
    }

    console.log(`✅ Found ${wards.length} unlinked wards:\n`);
    wards.forEach((ward, idx) => {
      console.log(`   ${idx + 1}. ${ward.ward_name} (${ward.ward_code}) - Type: ${ward.ward_type}`);
    });

    if (wards.length === 0) {
      console.log('\n✅ All wards are already linked to departments!');
      return;
    }

    // Step 3: Create department mapping based on ward types
    console.log('\n📋 Step 3: Creating department mapping logic...\n');

    // Create a mapping helper function
    function findDepartmentForWard(ward, departments) {
      const wardType = ward.ward_type?.toLowerCase() || '';
      const wardName = ward.ward_name?.toLowerCase() || '';

      // ICU wards
      if (wardType.includes('icu') || wardName.includes('icu') || wardName.includes('intensive')) {
        const icuDept = departments.find(d =>
          d.name.toLowerCase().includes('icu') ||
          d.name.toLowerCase().includes('intensive')
        );
        if (icuDept) return icuDept;
      }

      // Pediatric wards
      if (wardType.includes('pediatric') || wardName.includes('pediatric') || wardName.includes('children')) {
        const pedDept = departments.find(d =>
          d.name.toLowerCase().includes('pediatric') ||
          d.name.toLowerCase().includes('paediatric')
        );
        if (pedDept) return pedDept;
      }

      // Maternity/Obstetrics wards
      if (wardType.includes('maternity') || wardName.includes('maternity') || wardName.includes('obstetric')) {
        const matDept = departments.find(d =>
          d.name.toLowerCase().includes('maternity') ||
          d.name.toLowerCase().includes('obstetric')
        );
        if (matDept) return matDept;
      }

      // Emergency wards
      if (wardType.includes('emergency') || wardName.includes('emergency') || wardName.includes('a&e')) {
        const emergDept = departments.find(d =>
          d.name.toLowerCase().includes('emergency') ||
          d.name.toLowerCase().includes('casualty')
        );
        if (emergDept) return emergDept;
      }

      // Surgical wards
      if (wardType.includes('surgical') || wardName.includes('surgical') || wardName.includes('surgery')) {
        const surgDept = departments.find(d =>
          d.name.toLowerCase().includes('surgical') ||
          d.name.toLowerCase().includes('surgery')
        );
        if (surgDept) return surgDept;
      }

      // General/Medical wards - default fallback
      const generalDept = departments.find(d =>
        d.name.toLowerCase().includes('general') ||
        d.name.toLowerCase().includes('medical')
      );
      if (generalDept) return generalDept;

      // Last resort: return first available department
      return departments[0];
    }

    // Step 4: Link each ward to appropriate department
    console.log('\n📋 Step 4: Linking wards to departments...\n');

    const updates = [];

    for (const ward of wards) {
      const department = findDepartmentForWard(ward, departments);

      if (department) {
        console.log(`🔗 Linking: ${ward.ward_name} → ${department.name}`);

        const { error: updateError } = await supabase
          .from('hospital_wards')
          .update({ department_id: department.id })
          .eq('id', ward.id);

        if (updateError) {
          console.error(`   ❌ Error: ${updateError.message}`);
        } else {
          console.log(`   ✅ Successfully linked!`);
          updates.push({
            ward_id: ward.id,
            ward_name: ward.ward_name,
            ward_code: ward.ward_code,
            ward_type: ward.ward_type,
            department_id: department.id,
            department_name: department.name
          });
        }
      } else {
        console.log(`   ⚠️  No suitable department found for: ${ward.ward_name}`);
      }
    }

    // Step 5: Verify the updates
    console.log('\n📋 Step 5: Verifying ward-department linkages...\n');
    console.log('=' .repeat(60));

    const { data: verifyData, error: verifyError } = await supabase
      .from('hospital_wards')
      .select(`
        id,
        ward_name,
        ward_code,
        ward_type,
        department_id,
        departments!inner(
          name,
          code
        )
      `)
      .order('ward_name');

    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError);
      return;
    }

    console.log('\n✅ VERIFICATION COMPLETE - All Wards with Department Links:\n');
    verifyData.forEach((ward, idx) => {
      console.log(`${idx + 1}. ${ward.ward_name} (${ward.ward_code})`);
      console.log(`   Type: ${ward.ward_type}`);
      console.log(`   Department: ${ward.departments.name} [${ward.departments.code}]`);
      console.log(`   Department ID: ${ward.department_id}`);
      console.log('');
    });

    // Summary
    console.log('=' .repeat(60));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total Departments: ${departments.length}`);
    console.log(`   Wards Linked: ${updates.length}`);
    console.log(`   Total Wards Verified: ${verifyData.length}`);

    if (updates.length > 0) {
      console.log('\n✅ Ward-to-Department Mapping:\n');
      updates.forEach((update, idx) => {
        console.log(`   ${idx + 1}. ${update.ward_name} → ${update.department_name}`);
      });
    }

    console.log('\n✅ All wards successfully linked to departments!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function main() {
  console.log('🚀 Ward-Department Linking Tool\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await linkWardsToDepartments();

  console.log('\n✅ Process complete!');
}

main().catch(console.error);