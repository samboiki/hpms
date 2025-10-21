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

async function checkTableExists(tableName) {
  console.log(`🔍 Checking if '${tableName}' table exists...`);

  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);

    if (error) {
      console.log(`❌ Error checking ${tableName} table:`, error.message);
      return false;
    }

    const exists = data && data.length > 0;
    console.log(`${exists ? '✅' : '❌'} ${tableName} table ${exists ? 'exists' : 'does not exist'}`);
    return exists;
  } catch (error) {
    console.error(`❌ Unexpected error checking ${tableName}:`, error);
    return false;
  }
}

async function executeSQL(sql, description) {
  console.log(`🔧 ${description}...`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return false;
    }

    console.log(`✅ Successfully executed: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    return false;
  }
}

async function createWardsTable() {
  console.log('\n🏥 Creating wards table with complete hospital ward management schema...\n');

  const createTableSQL = `
-- Create wards table for hospital ward management
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_name TEXT NOT NULL,
    ward_code TEXT UNIQUE NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    ward_type TEXT CHECK (ward_type IN ('ICU', 'General', 'Surgery', 'Maternity', 'Pediatric', 'Emergency', 'Outpatient', 'Private', 'Semi-Private', 'Other')),
    floor_number INTEGER,
    building TEXT,
    nurse_station_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE
);`;

  const createIndexesSQL = `
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wards_practice_id ON wards(practice_id);
CREATE INDEX IF NOT EXISTS idx_wards_department_id ON wards(department_id);
CREATE INDEX IF NOT EXISTS idx_wards_ward_code ON wards(ward_code);
CREATE INDEX IF NOT EXISTS idx_wards_active ON wards(is_active);
CREATE INDEX IF NOT EXISTS idx_wards_ward_type ON wards(ward_type);`;

  const createConstraintsSQL = `
-- Add check constraints
ALTER TABLE wards
ADD CONSTRAINT chk_wards_capacity_positive CHECK (capacity >= 0),
ADD CONSTRAINT chk_wards_occupancy_positive CHECK (current_occupancy >= 0),
ADD CONSTRAINT chk_wards_occupancy_not_exceed_capacity CHECK (current_occupancy <= capacity);`;

  const createCommentsSQL = `
-- Add helpful comments
COMMENT ON TABLE wards IS 'Hospital wards management table for tracking bed capacity and occupancy';
COMMENT ON COLUMN wards.ward_name IS 'Display name of the ward';
COMMENT ON COLUMN wards.ward_code IS 'Unique identifier code for the ward';
COMMENT ON COLUMN wards.department_id IS 'Department responsible for managing this ward';
COMMENT ON COLUMN wards.capacity IS 'Total number of beds in the ward';
COMMENT ON COLUMN wards.current_occupancy IS 'Current number of occupied beds';
COMMENT ON COLUMN wards.ward_type IS 'Type of ward (ICU, General, Surgery, etc.)';
COMMENT ON COLUMN wards.floor_number IS 'Floor number where the ward is located';
COMMENT ON COLUMN wards.building IS 'Building where the ward is located';
COMMENT ON COLUMN wards.nurse_station_phone IS 'Phone number for the ward nurse station';
COMMENT ON COLUMN wards.practice_id IS 'Practice that owns this ward';`;

  const createRLSSQL = `
-- Enable Row Level Security
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant support
CREATE POLICY "Users can view wards for their practice" ON wards
    FOR SELECT USING (
        practice_id IN (
            SELECT practice_id
            FROM practice_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can insert wards for their practice" ON wards
    FOR INSERT WITH CHECK (
        practice_id IN (
            SELECT practice_id
            FROM practice_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can update wards for their practice" ON wards
    FOR UPDATE USING (
        practice_id IN (
            SELECT practice_id
            FROM practice_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can delete wards for their practice" ON wards
    FOR DELETE USING (
        practice_id IN (
            SELECT practice_id
            FROM practice_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );`;

  const createTriggerSQL = `
-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wards_updated_at
    BEFORE UPDATE ON wards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();`;

  const createViewSQL = `
-- Create useful view for ward statistics
CREATE OR REPLACE VIEW ward_statistics AS
SELECT
    w.id,
    w.ward_name,
    w.ward_code,
    w.ward_type,
    w.floor_number,
    w.building,
    w.capacity,
    w.current_occupancy,
    CASE
        WHEN w.capacity > 0
        THEN ROUND((w.current_occupancy::numeric / w.capacity::numeric) * 100, 2)
        ELSE 0
    END as occupancy_percentage,
    w.capacity - w.current_occupancy as available_beds,
    d.name as department_name,
    d.code as department_code,
    p.practice_name,
    w.practice_id,
    w.is_active,
    w.created_at,
    w.updated_at
FROM wards w
LEFT JOIN departments d ON w.department_id = d.id
LEFT JOIN practices p ON w.practice_id = p.id;

-- Grant permissions on the view
GRANT SELECT ON ward_statistics TO authenticated;

-- Enable RLS on the view
ALTER VIEW ward_statistics SET (security_invoker = true);`;

  // Execute all SQL statements
  const success = await executeSQL(createTableSQL, 'Creating wards table') &&
                 await executeSQL(createIndexesSQL, 'Creating indexes') &&
                 await executeSQL(createConstraintsSQL, 'Adding constraints') &&
                 await executeSQL(createCommentsSQL, 'Adding comments') &&
                 await executeSQL(createRLSSQL, 'Setting up RLS policies') &&
                 await executeSQL(createTriggerSQL, 'Creating updated_at trigger') &&
                 await executeSQL(createViewSQL, 'Creating ward statistics view');

  return success;
}

async function insertSampleData() {
  console.log('\n📊 Checking if we should insert sample ward data...\n');

  try {
    // Check if there are any practices first
    const { data: practices, error: practiceError } = await supabase
      .from('practices')
      .select('id, practice_name')
      .limit(1);

    if (practiceError) {
      console.log('❌ Error checking practices:', practiceError.message);
      return false;
    }

    if (!practices || practices.length === 0) {
      console.log('ℹ️  No practices found - skipping sample data insertion');
      return true;
    }

    // Check if there are any departments
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .limit(1);

    if (deptError) {
      console.log('❌ Error checking departments:', deptError.message);
      return false;
    }

    // Check if wards table already has data
    const { count, error: countError } = await supabase
      .from('wards')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Error checking ward count:', countError.message);
      return false;
    }

    if (count > 0) {
      console.log(`ℹ️  Wards table already has ${count} records - skipping sample data`);
      return true;
    }

    const practiceId = practices[0].id;
    const departmentId = departments && departments.length > 0 ? departments[0].id : null;

    console.log(`📝 Inserting sample ward data for practice: ${practices[0].practice_name}`);

    const sampleWards = [
      {
        ward_name: 'Intensive Care Unit',
        ward_code: 'ICU-01',
        department_id: departmentId,
        capacity: 12,
        current_occupancy: 8,
        ward_type: 'ICU',
        floor_number: 3,
        building: 'Main Building',
        nurse_station_phone: '+1-555-0101',
        practice_id: practiceId
      },
      {
        ward_name: 'General Medicine Ward A',
        ward_code: 'GM-A01',
        department_id: departmentId,
        capacity: 24,
        current_occupancy: 18,
        ward_type: 'General',
        floor_number: 2,
        building: 'Main Building',
        nurse_station_phone: '+1-555-0102',
        practice_id: practiceId
      },
      {
        ward_name: 'Surgical Ward',
        ward_code: 'SW-01',
        department_id: departmentId,
        capacity: 16,
        current_occupancy: 12,
        ward_type: 'Surgery',
        floor_number: 4,
        building: 'Main Building',
        nurse_station_phone: '+1-555-0103',
        practice_id: practiceId
      },
      {
        ward_name: 'Maternity Ward',
        ward_code: 'MAT-01',
        department_id: departmentId,
        capacity: 20,
        current_occupancy: 14,
        ward_type: 'Maternity',
        floor_number: 1,
        building: 'Women\'s Health Building',
        nurse_station_phone: '+1-555-0104',
        practice_id: practiceId
      }
    ];

    const { error: insertError } = await supabase
      .from('wards')
      .insert(sampleWards);

    if (insertError) {
      console.log('❌ Error inserting sample data:', insertError.message);
      return false;
    }

    console.log(`✅ Successfully inserted ${sampleWards.length} sample ward records`);
    return true;

  } catch (error) {
    console.error('❌ Unexpected error inserting sample data:', error);
    return false;
  }
}

async function main() {
  console.log('🏥 WARDS TABLE SETUP TOOL\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  // Check if wards table already exists
  const wardsExists = await checkTableExists('wards');

  // Also check for hospital_wards table
  const hospitalWardsExists = await checkTableExists('hospital_wards');

  if (wardsExists) {
    console.log('\n✅ Wards table already exists!');

    // Show some basic stats
    try {
      const { count, error } = await supabase
        .from('wards')
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`📊 Current ward count: ${count}`);
      }
    } catch (e) {
      console.log('📊 Unable to get ward count');
    }

  } else if (hospitalWardsExists) {
    console.log('\n⚠️  Found hospital_wards table but no wards table.');
    console.log('ℹ️  It looks like you might want to use hospital_wards instead of wards.');
    console.log('ℹ️  The existing migrations reference hospital_wards table.');

  } else {
    console.log('\n🔧 Neither wards nor hospital_wards table exists. Creating wards table...');

    const success = await createWardsTable();

    if (success) {
      console.log('\n✅ Wards table created successfully!');

      // Optionally insert sample data
      await insertSampleData();

    } else {
      console.log('\n❌ Failed to create wards table');
    }
  }

  console.log('\n🎯 Summary:');
  console.log('  - Wards table: ' + (wardsExists ? '✅ EXISTS' : await checkTableExists('wards') ? '✅ CREATED' : '❌ MISSING'));
  console.log('  - Hospital_wards table: ' + (hospitalWardsExists ? '✅ EXISTS' : '❌ MISSING'));

  console.log('\n✅ Ward table setup complete!');
}

main().catch(console.error);