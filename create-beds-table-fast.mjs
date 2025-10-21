// 2025 FAST Solution: Create Beds Table
const PROJECT_ID = 'jjxlfunlbyayxwvlpgwt';
const ACCESS_TOKEN = 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';

async function executeSQLQuery(query, description) {
  console.log(`\n🔧 ${description}...`);

  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });

  if (response.ok) {
    const result = await response.json();
    console.log(`✅ ${description} - SUCCESS!`);
    return result;
  } else {
    const errorText = await response.text();
    console.log(`❌ ${description} - FAILED:`, errorText);
    return null;
  }
}

async function createBedsTable() {
  console.log('🚀 2025 FAST SOLUTION: Creating Beds Table');
  console.log('================================================');

  // Step 1: Create the table
  await executeSQLQuery(`
    CREATE TABLE IF NOT EXISTS public.beds (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      bed_number TEXT NOT NULL,
      bed_name TEXT,
      room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
      ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
      department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
      bed_type TEXT DEFAULT 'Standard',
      bed_status TEXT DEFAULT 'Available',
      patient_id UUID,
      patient_name TEXT,
      admission_date TIMESTAMP WITH TIME ZONE,
      expected_discharge TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT true,
      practice_id UUID REFERENCES public.practices(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, 'Creating beds table');

  // Step 2: Create indexes
  await executeSQLQuery(`
    CREATE INDEX IF NOT EXISTS idx_beds_practice_id ON public.beds(practice_id);
    CREATE INDEX IF NOT EXISTS idx_beds_department_id ON public.beds(department_id);
    CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
    CREATE INDEX IF NOT EXISTS idx_beds_ward_id ON public.beds(ward_id);
    CREATE INDEX IF NOT EXISTS idx_beds_bed_status ON public.beds(bed_status);
    CREATE INDEX IF NOT EXISTS idx_beds_patient_id ON public.beds(patient_id);
  `, 'Creating indexes');

  // Step 3: Enable RLS
  await executeSQLQuery(`
    ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY
  `, 'Enabling RLS');

  // Step 4: Create RLS policy
  await executeSQLQuery(`
    DROP POLICY IF EXISTS "Users can view beds in their practice" ON public.beds;
    CREATE POLICY "Users can view beds in their practice"
    ON public.beds FOR ALL
    USING (practice_id IN (
      SELECT practice_id FROM public.users WHERE id = auth.uid()
    ))
  `, 'Creating RLS policy');

  // Step 5: Insert sample data
  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, practice_id
    )
    SELECT
      'B101-1', 'Bed 1', r.id, r.ward_id, r.department_id,
      'Standard', 'Available', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '101'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B101-1')
    LIMIT 1
  `, 'Adding Bed B101-1');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, patient_name, admission_date, practice_id
    )
    SELECT
      'B102-1', 'Bed 1', r.id, r.ward_id, r.department_id,
      'Standard', 'Occupied', 'John Doe', NOW() - INTERVAL '2 days', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '102'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B102-1')
    LIMIT 1
  `, 'Adding Bed B102-1');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, practice_id
    )
    SELECT
      'B102-2', 'Bed 2', r.id, r.ward_id, r.department_id,
      'Standard', 'Available', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '102'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B102-2')
    LIMIT 1
  `, 'Adding Bed B102-2');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, patient_name, admission_date, practice_id
    )
    SELECT
      'B103-1', 'Bed 1', r.id, r.ward_id, r.department_id,
      'Standard', 'Occupied', 'Jane Smith', NOW() - INTERVAL '1 day', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '103'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B103-1')
    LIMIT 1
  `, 'Adding Bed B103-1');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, practice_id
    )
    SELECT
      'B103-2', 'Bed 2', r.id, r.ward_id, r.department_id,
      'Standard', 'Maintenance', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '103'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B103-2')
    LIMIT 1
  `, 'Adding Bed B103-2');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, practice_id
    )
    SELECT
      'B103-3', 'Bed 3', r.id, r.ward_id, r.department_id,
      'Standard', 'Reserved', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '103'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B103-3')
    LIMIT 1
  `, 'Adding Bed B103-3');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, patient_name, admission_date, practice_id
    )
    SELECT
      'B103-4', 'Bed 4', r.id, r.ward_id, r.department_id,
      'Standard', 'Occupied', 'Bob Johnson', NOW() - INTERVAL '3 days', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = '103'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'B103-4')
    LIMIT 1
  `, 'Adding Bed B103-4');

  await executeSQLQuery(`
    INSERT INTO public.beds (
      bed_number, bed_name, room_id, ward_id, department_id,
      bed_type, bed_status, patient_name, admission_date, expected_discharge, practice_id
    )
    SELECT
      'ICU-01-1', 'ICU Bed 1', r.id, r.ward_id, r.department_id,
      'ICU', 'Occupied', 'Alice Brown', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', r.practice_id
    FROM public.rooms r
    WHERE r.room_number = 'ICU-01'
    AND NOT EXISTS (SELECT 1 FROM public.beds WHERE bed_number = 'ICU-01-1')
    LIMIT 1
  `, 'Adding ICU Bed');

  // Step 6: Verify
  const verifyResult = await executeSQLQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'beds'
    ORDER BY ordinal_position
  `, 'Verifying table structure');

  if (verifyResult) {
    console.log('\n📊 Beds Table Columns:');
    verifyResult.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type})`);
    });
  }

  // Step 7: Check data
  const dataResult = await executeSQLQuery(`
    SELECT b.bed_number, b.bed_name, b.bed_type, b.bed_status, r.room_number
    FROM public.beds b
    LEFT JOIN public.rooms r ON b.room_id = r.id
    LIMIT 10
  `, 'Checking sample data');

  if (dataResult) {
    console.log('\n📋 Sample Bed Data:');
    dataResult.forEach(bed => {
      console.log(`  • ${bed.bed_name} (${bed.bed_number}) - Room ${bed.room_number} - ${bed.bed_type} - ${bed.bed_status}`);
    });
  }

  console.log('\n🎉 BEDS TABLE SETUP COMPLETE!');
}

createBedsTable();