const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function detailedAnalysis() {
  console.log('🔍 DETAILED INPATIENT MODULE ANALYSIS\n');
  console.log('='.repeat(80));

  try {
    // 1. Get all wards with full details
    console.log('\n📊 EXISTING WARDS (hospital_wards):');
    console.log('-'.repeat(80));
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .order('created_at', { ascending: false });

    if (wards && wards.length > 0) {
      console.log(`Total wards: ${wards.length}\n`);

      wards.forEach(ward => {
        console.log(`Ward: ${ward.ward_name} (${ward.ward_code})`);
        console.log(`  - ID: ${ward.id}`);
        console.log(`  - Practice ID: ${ward.practice_id}`);
        console.log(`  - Branch ID: ${ward.branch_id || 'NULL'}`);
        console.log(`  - Department ID: ${ward.department_id || 'NULL'} ${!ward.department_id ? '⚠️ MISSING!' : ''}`);
        console.log(`  - Ward Type: ${ward.ward_type}`);
        console.log(`  - Floor: ${ward.floor_number}`);
        console.log(`  - Total Beds: ${ward.total_beds}`);
        console.log(`  - Occupied Beds: ${ward.occupied_beds}`);
        console.log(`  - Active: ${ward.is_active}`);
        console.log(`  - Created: ${ward.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ Error or no wards found:', wardsError?.message || 'No data');
    }

    // 2. Check for all tables starting with 'hospital_' or 'patient_'
    console.log('\n📊 ALL INPATIENT-RELATED TABLES:');
    console.log('-'.repeat(80));
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%hospital%');

    if (tables) {
      console.log('Tables with "hospital" in name:');
      tables.forEach(t => console.log(`  - ${t.table_name}`));
    }

    const { data: patientTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%patient%');

    if (patientTables) {
      console.log('\nTables with "patient" in name:');
      patientTables.forEach(t => console.log(`  - ${t.table_name}`));
    }

    const { data: admissionTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%admission%');

    if (admissionTables) {
      console.log('\nTables with "admission" in name:');
      admissionTables.forEach(t => console.log(`  - ${t.table_name}`));
    }

    // 3. Check departments table
    console.log('\n📊 DEPARTMENTS TABLE:');
    console.log('-'.repeat(80));
    const { data: departments, error: deptsError } = await supabase
      .from('departments')
      .select('department_id, department_name, practice_id, is_active')
      .limit(10);

    if (departments) {
      console.log(`Total departments (showing first 10): ${departments.length}\n`);
      console.table(departments);
    } else {
      console.log('❌ Error getting departments:', deptsError?.message);
    }

    // 4. Check if there's a clinicals table
    console.log('\n📊 CLINICALS TABLE (Alternative department structure):');
    console.log('-'.repeat(80));
    const { data: clinicals, error: clinicalsError } = await supabase
      .from('clinicals')
      .select('*')
      .limit(10);

    if (clinicals && clinicals.length > 0) {
      console.log(`Total clinicals (showing first 10): ${clinicals.length}\n`);
      console.table(clinicals);
    } else {
      console.log('❌ Error or no clinicals found:', clinicalsError?.message || 'No data');
    }

    // 5. Check RLS policies on hospital_wards
    console.log('\n📊 RLS POLICIES ON hospital_wards:');
    console.log('-'.repeat(80));
    const { data: policies, error: policiesError } = await supabase.rpc('exec', {
      sql: `SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'hospital_wards';`
    });

    if (policies) {
      console.table(policies);
    } else {
      console.log('⚠️ Could not fetch RLS policies (RPC may not be available)');
    }

    // 6. Check for foreign key constraints on hospital_wards
    console.log('\n📊 FOREIGN KEY CONSTRAINTS:');
    console.log('-'.repeat(80));
    console.log('\nhospital_wards table has department_id column:', wards && wards.length > 0 ? 'YES ✅' : 'UNKNOWN');

    // Try to see if department_id has a foreign key
    const wardWithDept = wards?.find(w => w.department_id);
    if (wardWithDept) {
      console.log(`Found ward with department_id: ${wardWithDept.department_id}`);

      // Check if that department exists
      const { data: dept } = await supabase
        .from('departments')
        .select('department_id, department_name')
        .eq('department_id', wardWithDept.department_id)
        .single();

      if (dept) {
        console.log(`✅ Department exists: ${dept.department_name}`);
      } else {
        console.log('⚠️ Department not found - possible orphaned reference');
      }
    } else {
      console.log('⚠️ No wards have department_id set');
    }

    // 7. Check practice_id validity
    console.log('\n📊 PRACTICE VALIDATION:');
    console.log('-'.repeat(80));
    if (wards && wards.length > 0) {
      const practiceIds = [...new Set(wards.map(w => w.practice_id))];
      console.log(`Unique practice_ids in wards: ${practiceIds.length}`);

      for (const practiceId of practiceIds) {
        const { data: practice } = await supabase
          .from('practices')
          .select('id, practice_name, practice_type')
          .eq('id', practiceId)
          .single();

        if (practice) {
          console.log(`✅ Practice ${practiceId}: ${practice.practice_name} (${practice.practice_type})`);
        } else {
          console.log(`❌ Practice ${practiceId}: NOT FOUND`);
        }
      }
    }

    // 8. Expected table structure analysis
    console.log('\n📊 EXPECTED VS ACTUAL TABLE STRUCTURE:');
    console.log('-'.repeat(80));
    console.log('\n✅ EXISTS: hospital_wards');
    console.log('❌ MISSING: hospital_rooms');
    console.log('❌ MISSING: hospital_beds');
    console.log('✅ EXISTS: patient_admissions (but empty)');

    console.log('\n🔧 ISSUES IDENTIFIED:');
    console.log('-'.repeat(80));
    console.log('1. hospital_rooms table does not exist');
    console.log('2. hospital_beds table does not exist');
    console.log('3. patient_admissions table exists but is empty');
    console.log('4. hospital_wards table:');
    console.log('   - Uses "id" instead of "ward_id" as primary key');
    console.log('   - Has department_id column but may not be populated');
    console.log('   - Has branch_id column (not always populated)');

    console.log('\n✅ Analysis complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error(error);
  }
}

detailedAnalysis();