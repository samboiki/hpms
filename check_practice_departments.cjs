const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkPracticeDepartments() {
  console.log('🔍 CHECKING PRACTICE AND DEPARTMENT RELATIONSHIPS\n');

  // Get all practices
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('id, name');

  if (practicesError) {
    console.log('❌ Error fetching practices:', practicesError.message);
    return;
  }

  console.log(`Found ${practices.length} practices:`);
  practices.forEach(p => console.log(`  - ${p.name} (${p.id})`));

  // Get wards with their practice_ids
  const { data: wards, error: wardsError } = await supabase
    .from('hospital_wards')
    .select('id, ward_name, practice_id, department_id');

  if (wardsError) {
    console.log('❌ Error fetching wards:', wardsError.message);
    return;
  }

  console.log(`\n📊 Found ${wards.length} wards`);

  // Group wards by practice_id
  const wardsByPractice = {};
  wards.forEach(ward => {
    if (!wardsByPractice[ward.practice_id]) {
      wardsByPractice[ward.practice_id] = [];
    }
    wardsByPractice[ward.practice_id].push(ward);
  });

  // Check departments for each practice
  for (const practiceId in wardsByPractice) {
    const practice = practices.find(p => p.id === practiceId);
    console.log(`\n=== ${practice?.name || 'Unknown Practice'} (${practiceId}) ===`);

    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('practice_id', practiceId);

    if (deptError) {
      console.log('  ❌ Error fetching departments:', deptError.message);
    } else {
      console.log(`  📋 Departments (${departments.length}):`);
      if (departments.length === 0) {
        console.log('    ⚠️ NO DEPARTMENTS FOUND FOR THIS PRACTICE!');
      } else {
        departments.forEach(dept => {
          console.log(`    - ${dept.name} (${dept.code})`);
        });
      }
    }

    console.log(`  🏥 Wards (${wardsByPractice[practiceId].length}):`);
    wardsByPractice[practiceId].forEach(ward => {
      console.log(`    - ${ward.ward_name}: department_id = ${ward.department_id || 'NULL ⚠️'}`);
    });
  }

  // Summary
  console.log('\n=== CRITICAL FINDINGS ===');
  const wardsWithoutDept = wards.filter(w => !w.department_id);
  console.log(`⚠️ ${wardsWithoutDept.length} out of ${wards.length} wards have NULL department_id`);

  for (const practiceId in wardsByPractice) {
    const practice = practices.find(p => p.id === practiceId);
    const { data: departments } = await supabase
      .from('departments')
      .select('id')
      .eq('practice_id', practiceId);

    if (departments && departments.length === 0) {
      console.log(`❌ Practice "${practice?.name}" has wards but NO departments!`);
      console.log(`   This will prevent the inpatient dashboard from loading properly.`);
    }
  }
}

checkPracticeDepartments();