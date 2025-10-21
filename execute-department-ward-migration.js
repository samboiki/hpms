import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeDepartmentWardMigration() {
  console.log('🏥 Executing Department-Ward Migration...');

  try {
    // Test basic connectivity
    const { data: testData, error: testError } = await supabase
      .from('hospital_wards')
      .select('id')
      .limit(1);

    if (testError) {
      console.log('❌ Basic connectivity failed:', testError.message);
      return;
    }

    console.log('✅ Connected to Supabase database!');
    console.log(`   Found hospital_wards table with ${testData?.length || 0} records`);

    // Execute the migration steps
    console.log('\n🔧 Step 1: Adding department_id column to hospital_wards...');

    const migrationSQL = `
      -- Add department_id column to hospital_wards table
      ALTER TABLE hospital_wards
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

      -- Create index for performance
      CREATE INDEX IF NOT EXISTS idx_hospital_wards_department ON hospital_wards(department_id);

      -- Add helpful comment
      COMMENT ON COLUMN hospital_wards.department_id IS 'Department responsible for managing this ward';

      -- Create a view for department ward statistics
      CREATE OR REPLACE VIEW department_ward_statistics AS
      SELECT
        d.id as department_id,
        d.name as department_name,
        d.practice_id,
        COUNT(DISTINCT hw.id) as total_wards,
        SUM(hw.total_beds) as total_beds,
        SUM(hw.occupied_beds) as occupied_beds,
        CASE
          WHEN SUM(hw.total_beds) > 0
          THEN ROUND((SUM(hw.occupied_beds)::numeric / SUM(hw.total_beds)::numeric) * 100, 2)
          ELSE 0
        END as occupancy_rate
      FROM departments d
      LEFT JOIN hospital_wards hw ON hw.department_id = d.id AND hw.is_active = true
      GROUP BY d.id, d.name, d.practice_id;

      -- Grant appropriate permissions
      GRANT SELECT ON department_ward_statistics TO authenticated;
    `;

    // Try to execute using RPC if available
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('exec_sql', {
        sql: migrationSQL
      });

      if (rpcError) {
        console.log('ℹ️  exec_sql function not available:', rpcError.message);
        console.log('🔧 Migration needs to be executed manually in Supabase SQL Editor');
        console.log('\n📋 Please copy and paste this SQL into your Supabase SQL Editor:');
        console.log('=' * 60);
        console.log(migrationSQL);
        console.log('=' * 60);
      } else {
        console.log('✅ Successfully executed migration through RPC function!');
        console.log('Result:', rpcResult);
      }
    } catch (rpcError) {
      console.log('ℹ️  RPC execution not available:', rpcError.message);
      console.log('🔧 Migration needs to be executed manually in Supabase SQL Editor');
      console.log('\n📋 Please copy and paste this SQL into your Supabase SQL Editor:');
      console.log('=' * 60);
      console.log(migrationSQL);
      console.log('=' * 60);
    }

    // Verify the migration by checking if the column exists
    console.log('\n🔍 Step 2: Verifying migration...');

    const { data: columnCheck, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'hospital_wards')
      .eq('column_name', 'department_id');

    if (columnCheck && columnCheck.length > 0) {
      console.log('✅ department_id column successfully added to hospital_wards table!');
      console.log(`   Column type: ${columnCheck[0].data_type}`);
    } else if (columnError) {
      console.log('⚠️  Could not verify column addition:', columnError.message);
    } else {
      console.log('⚠️  department_id column not found - manual execution may be required');
    }

    // Check if the view was created
    console.log('\n🔍 Step 3: Verifying view creation...');

    const { data: viewCheck, error: viewError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_name', 'department_ward_statistics');

    if (viewCheck && viewCheck.length > 0) {
      console.log('✅ department_ward_statistics view successfully created!');
    } else if (viewError) {
      console.log('⚠️  Could not verify view creation:', viewError.message);
    } else {
      console.log('⚠️  department_ward_statistics view not found - manual execution may be required');
    }

    console.log('\n🎉 Department-Ward Migration Process Complete!');
    console.log('\n📊 Next Steps:');
    console.log('1. You can now assign wards to departments through the admin interface');
    console.log('2. Use the department_ward_statistics view to monitor ward occupancy by department');
    console.log('3. Update existing wards to associate them with appropriate departments');

  } catch (error) {
    console.error('❌ Migration execution failed:', error.message);
    console.log('\n🔧 Manual execution required. Please run the following SQL in Supabase SQL Editor:');
    console.log('=' * 60);
    console.log(`
-- Add department_id column to hospital_wards table
ALTER TABLE hospital_wards
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_hospital_wards_department ON hospital_wards(department_id);

-- Add helpful comment
COMMENT ON COLUMN hospital_wards.department_id IS 'Department responsible for managing this ward';

-- Create a view for department ward statistics
CREATE OR REPLACE VIEW department_ward_statistics AS
SELECT
  d.id as department_id,
  d.name as department_name,
  d.practice_id,
  COUNT(DISTINCT hw.id) as total_wards,
  SUM(hw.total_beds) as total_beds,
  SUM(hw.occupied_beds) as occupied_beds,
  CASE
    WHEN SUM(hw.total_beds) > 0
    THEN ROUND((SUM(hw.occupied_beds)::numeric / SUM(hw.total_beds)::numeric) * 100, 2)
    ELSE 0
  END as occupancy_rate
FROM departments d
LEFT JOIN hospital_wards hw ON hw.department_id = d.id AND hw.is_active = true
GROUP BY d.id, d.name, d.practice_id;

-- Grant appropriate permissions
GRANT SELECT ON department_ward_statistics TO authenticated;
    `);
    console.log('=' * 60);
  }
}

// Execute the migration
executeDepartmentWardMigration();