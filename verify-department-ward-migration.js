import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function verifyMigration() {
  console.log('🏥 Verifying Department-Ward Migration Status...\n');

  try {
    // Check if hospital_wards table exists and get its structure
    console.log('🔍 Step 1: Checking hospital_wards table structure...');

    const { data: wardsData, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .limit(1);

    if (wardsError) {
      console.log('❌ Error accessing hospital_wards table:', wardsError.message);
      return;
    }

    console.log('✅ hospital_wards table accessible');
    if (wardsData && wardsData.length > 0) {
      const columns = Object.keys(wardsData[0]);
      console.log('   Available columns:', columns.join(', '));

      if (columns.includes('department_id')) {
        console.log('✅ department_id column found in hospital_wards table!');
      } else {
        console.log('❌ department_id column NOT found in hospital_wards table');
        console.log('   Migration may not have been executed yet');
      }
    } else {
      console.log('   Table is empty, cannot verify columns from data');
    }

    // Check if departments table exists
    console.log('\n🔍 Step 2: Checking departments table...');

    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id, name, practice_id')
      .limit(3);

    if (deptError) {
      console.log('❌ Error accessing departments table:', deptError.message);
    } else {
      console.log('✅ departments table accessible');
      console.log(`   Found ${deptData?.length || 0} departments`);
      if (deptData && deptData.length > 0) {
        console.log('   Sample departments:');
        deptData.forEach(dept => {
          console.log(`   - ${dept.name} (ID: ${dept.id})`);
        });
      }
    }

    // Try to access the statistics view if it exists
    console.log('\n🔍 Step 3: Checking department_ward_statistics view...');

    const { data: viewData, error: viewError } = await supabase
      .from('department_ward_statistics')
      .select('*')
      .limit(5);

    if (viewError) {
      console.log('❌ Error accessing department_ward_statistics view:', viewError.message);
      console.log('   View may not have been created yet');
    } else {
      console.log('✅ department_ward_statistics view accessible!');
      console.log(`   Found ${viewData?.length || 0} department statistics`);
      if (viewData && viewData.length > 0) {
        console.log('   Sample statistics:');
        viewData.forEach(stat => {
          console.log(`   - ${stat.department_name}: ${stat.total_wards} wards, ${stat.occupancy_rate}% occupancy`);
        });
      }
    }

    // Summary
    console.log('\n📊 Migration Status Summary:');
    console.log('==========================================');

    if (wardsData && wardsData.length > 0 && Object.keys(wardsData[0]).includes('department_id')) {
      console.log('✅ hospital_wards.department_id column: READY');
    } else {
      console.log('❌ hospital_wards.department_id column: MISSING');
    }

    if (!deptError) {
      console.log('✅ departments table: ACCESSIBLE');
    } else {
      console.log('❌ departments table: ERROR');
    }

    if (!viewError) {
      console.log('✅ department_ward_statistics view: READY');
    } else {
      console.log('❌ department_ward_statistics view: MISSING');
    }

    console.log('\n📋 Next Steps:');
    if (wardsData && wardsData.length > 0 && !Object.keys(wardsData[0]).includes('department_id')) {
      console.log('1. Execute the SQL migration in Supabase SQL Editor:');
      console.log('   - Copy contents from department-ward-migration.sql');
      console.log('   - Paste into Supabase > SQL Editor');
      console.log('   - Run the migration');
    } else {
      console.log('1. ✅ Migration appears complete!');
      console.log('2. You can now assign wards to departments');
      console.log('3. Use department_ward_statistics view for reporting');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run verification
verifyMigration();