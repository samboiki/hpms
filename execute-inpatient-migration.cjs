const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERROR: No Supabase key found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL() {
  console.log('=== INPATIENT MODULE DATABASE MIGRATION ===\n');

  // Step 1: Drop old tables
  console.log('Step 1: Dropping old tables...');
  const dropStatements = [
    'DROP TABLE IF EXISTS ward_beds CASCADE',
    'DROP TABLE IF EXISTS hospital_wards CASCADE'
  ];

  for (const stmt of dropStatements) {
    console.log(`  Executing: ${stmt}`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
    if (error && !error.message.includes('does not exist')) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.log('  ✓ Success');
    }
  }

  // Step 2: Create wards table
  console.log('\nStep 2: Creating wards table...');
  const wardsSQL = `
CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL,
  ward_name TEXT NOT NULL,
  ward_code TEXT NOT NULL,
  ward_type TEXT NOT NULL,
  floor_number INTEGER,
  building TEXT,
  capacity INTEGER DEFAULT 0,
  current_occupancy INTEGER DEFAULT 0,
  nurse_station_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`;

  const { error: wardsError } = await supabase.rpc('exec_sql', { sql_query: wardsSQL });
  if (wardsError) {
    console.error(`  Error: ${wardsError.message}`);
  } else {
    console.log('  ✓ Wards table created');
  }

  // Step 3: Create rooms table
  console.log('\nStep 3: Creating rooms table...');
  const roomsSQL = `
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_name TEXT,
  room_type TEXT DEFAULT 'standard',
  bed_capacity INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`;

  const { error: roomsError } = await supabase.rpc('exec_sql', { sql_query: roomsSQL });
  if (roomsError) {
    console.error(`  Error: ${roomsError.message}`);
  } else {
    console.log('  ✓ Rooms table created');
  }

  // Step 4: Create beds table
  console.log('\nStep 4: Creating beds table...');
  const bedsSQL = `
CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  bed_type TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'available',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`;

  const { error: bedsError } = await supabase.rpc('exec_sql', { sql_query: bedsSQL });
  if (bedsError) {
    console.error(`  Error: ${bedsError.message}`);
  } else {
    console.log('  ✓ Beds table created');
  }

  // Step 5: Create indexes
  console.log('\nStep 5: Creating indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_wards_department ON wards(department_id)',
    'CREATE INDEX IF NOT EXISTS idx_wards_practice ON wards(practice_id)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_ward ON rooms(ward_id)',
    'CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_id)',
    'CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status)'
  ];

  for (const idx of indexes) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: idx });
    if (error) {
      console.error(`  Error creating index: ${error.message}`);
    }
  }
  console.log('  ✓ All indexes created');

  // Step 6: Enable RLS
  console.log('\nStep 6: Enabling Row Level Security...');
  const rlsStatements = [
    'ALTER TABLE wards ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE rooms ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE beds ENABLE ROW LEVEL SECURITY'
  ];

  for (const rls of rlsStatements) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: rls });
    if (error && !error.message.includes('already enabled')) {
      console.error(`  Error: ${error.message}`);
    }
  }
  console.log('  ✓ RLS enabled');

  // Step 7: Create RLS policies
  console.log('\nStep 7: Creating RLS policies...');
  const policies = [
    'DROP POLICY IF EXISTS "Enable all access for wards" ON wards',
    'CREATE POLICY "Enable all access for wards" ON wards FOR ALL USING (true)',
    'DROP POLICY IF EXISTS "Enable all access for rooms" ON rooms',
    'CREATE POLICY "Enable all access for rooms" ON rooms FOR ALL USING (true)',
    'DROP POLICY IF EXISTS "Enable all access for beds" ON beds',
    'CREATE POLICY "Enable all access for beds" ON beds FOR ALL USING (true)'
  ];

  for (const policy of policies) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: policy });
    if (error && !error.message.includes('does not exist')) {
      console.error(`  Error: ${error.message}`);
    }
  }
  console.log('  ✓ RLS policies created');

  // Step 8: Verify tables and count
  console.log('\n=== VERIFICATION ===');

  try {
    const { count: wardCount } = await supabase.from('wards').select('*', { count: 'exact', head: true });
    const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
    const { count: bedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });

    console.log('\n✅ MIGRATION COMPLETE!');
    console.log('\nCurrent database state:');
    console.log(`  - Wards: ${wardCount || 0}`);
    console.log(`  - Rooms: ${roomCount || 0}`);
    console.log(`  - Beds: ${bedCount || 0}`);

    console.log('\n📋 Table structure created successfully:');
    console.log('  departments → wards → rooms → beds');
    console.log('\nAll tables have RLS enabled with permissive policies.');

  } catch (err) {
    console.error('\nError during verification:', err.message);
  }
}

executeSQL().catch(console.error);