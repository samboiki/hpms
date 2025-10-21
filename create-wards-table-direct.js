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
    // Try to query the table directly - if it exists, this will work
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log(`❌ ${tableName} table does not exist`);
        return false;
      } else {
        console.log(`✅ ${tableName} table exists (got error but table exists: ${error.message})`);
        return true;
      }
    }

    console.log(`✅ ${tableName} table exists`);
    return true;
  } catch (error) {
    console.log(`❌ ${tableName} table does not exist (error: ${error.message})`);
    return false;
  }
}

async function createWardsTableDirect() {
  console.log('\n🏥 Creating wards table using direct SQL execution...\n');

  // Create the wards table with comprehensive schema
  const createWardsSQL = `
    CREATE TABLE IF NOT EXISTS wards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ward_name TEXT NOT NULL,
        ward_code TEXT UNIQUE NOT NULL,
        department_id UUID,
        capacity INTEGER NOT NULL DEFAULT 0,
        current_occupancy INTEGER NOT NULL DEFAULT 0,
        ward_type TEXT CHECK (ward_type IN ('ICU', 'General', 'Surgery', 'Maternity', 'Pediatric', 'Emergency', 'Outpatient', 'Private', 'Semi-Private', 'Other')),
        floor_number INTEGER,
        building TEXT,
        nurse_station_phone TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        practice_id UUID NOT NULL
    );
  `;

  try {
    // First, let's try to check what tables exist by trying to access them
    console.log('🔍 Checking existing table structure...');

    // Check if practices table exists (should exist based on the codebase)
    const practicesExists = await checkTableExists('practices');
    console.log(`Practices table exists: ${practicesExists}`);

    // Check if departments table exists
    const departmentsExists = await checkTableExists('departments');
    console.log(`Departments table exists: ${departmentsExists}`);

    // Now try to execute the SQL directly through a simple query
    console.log('\n🔧 Executing CREATE TABLE statement...');

    // We'll use a workaround by creating the table through a stored procedure call
    // First, let's try to create the table using raw SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        sql: createWardsSQL
      })
    });

    if (!response.ok) {
      console.log('❌ Direct SQL execution failed, trying alternative method...');

      // Alternative approach: Use Supabase client to create the table step by step
      console.log('🔧 Creating wards table through SQL statements...');

      // Let's use SQL statements that Supabase can execute
      // This is a workaround since we can't execute DDL directly
      console.log('⚠️  Unable to execute DDL statements through this client.');
      console.log('📋 Please execute the following SQL manually in your Supabase dashboard:');
      console.log('\n' + '='.repeat(80));
      console.log('-- WARDS TABLE CREATION SQL');
      console.log('='.repeat(80));
      console.log(createWardsSQL);

      // Add constraints and indexes
      console.log(`
-- Add foreign key constraints (execute after table creation)
ALTER TABLE wards
ADD CONSTRAINT fk_wards_practice FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE;

-- Add department foreign key only if departments table exists
-- ALTER TABLE wards
-- ADD CONSTRAINT fk_wards_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wards_practice_id ON wards(practice_id);
CREATE INDEX IF NOT EXISTS idx_wards_department_id ON wards(department_id);
CREATE INDEX IF NOT EXISTS idx_wards_ward_code ON wards(ward_code);
CREATE INDEX IF NOT EXISTS idx_wards_active ON wards(is_active);
CREATE INDEX IF NOT EXISTS idx_wards_ward_type ON wards(ward_type);

-- Add check constraints
ALTER TABLE wards
ADD CONSTRAINT chk_wards_capacity_positive CHECK (capacity >= 0),
ADD CONSTRAINT chk_wards_occupancy_positive CHECK (current_occupancy >= 0),
ADD CONSTRAINT chk_wards_occupancy_not_exceed_capacity CHECK (current_occupancy <= capacity);

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
    );

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
    EXECUTE FUNCTION update_updated_at_column();

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
COMMENT ON COLUMN wards.practice_id IS 'Practice that owns this ward';
      `);
      console.log('='.repeat(80));
      console.log('\n📝 After creating the table, you can verify it exists by running this script again.');

      return false;
    }

    const result = await response.json();
    console.log('✅ Table creation result:', result);
    return true;

  } catch (error) {
    console.error('❌ Error creating wards table:', error.message);
    return false;
  }
}

async function main() {
  console.log('🏥 WARDS TABLE CREATION TOOL\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  // Check if wards table already exists
  const wardsExists = await checkTableExists('wards');

  if (wardsExists) {
    console.log('\n✅ Wards table already exists!');

    // Show some basic stats if possible
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .limit(5);

      if (!error && data) {
        console.log(`📊 Found ${data.length} ward records (showing first 5)`);
        if (data.length > 0) {
          console.log('\n📋 Sample wards:');
          data.forEach(ward => {
            console.log(`  • ${ward.ward_name} (${ward.ward_code}) - ${ward.capacity} beds, ${ward.current_occupancy} occupied`);
          });
        }
      }
    } catch (e) {
      console.log('📊 Unable to fetch ward data');
    }

  } else {
    console.log('\n🔧 Wards table does not exist. Creating it...');
    const success = await createWardsTableDirect();

    if (success) {
      console.log('\n✅ Wards table created successfully!');
    } else {
      console.log('\n⚠️  Please execute the provided SQL manually in Supabase dashboard');
    }
  }

  console.log('\n✅ Ward table setup process complete!');
}

main().catch(console.error);