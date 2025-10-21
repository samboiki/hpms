// 2025 FAST Solution: Create Wards Table
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

async function createWardsTable() {
  console.log('🚀 2025 FAST SOLUTION: Creating Wards Table');
  console.log('================================================');

  // Step 1: Create the table
  await executeSQLQuery(`
    CREATE TABLE IF NOT EXISTS public.wards (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      ward_name TEXT NOT NULL,
      ward_code TEXT UNIQUE,
      department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
      capacity INTEGER DEFAULT 0,
      current_occupancy INTEGER DEFAULT 0,
      ward_type TEXT,
      floor_number INTEGER,
      building TEXT,
      nurse_station_phone TEXT,
      is_active BOOLEAN DEFAULT true,
      practice_id UUID REFERENCES public.practices(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, 'Creating wards table');

  // Step 2: Create indexes
  await executeSQLQuery(`
    CREATE INDEX IF NOT EXISTS idx_wards_practice_id ON public.wards(practice_id);
    CREATE INDEX IF NOT EXISTS idx_wards_department_id ON public.wards(department_id);
    CREATE INDEX IF NOT EXISTS idx_wards_is_active ON public.wards(is_active);
  `, 'Creating indexes');

  // Step 3: Enable RLS
  await executeSQLQuery(`
    ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY
  `, 'Enabling RLS');

  // Step 4: Create RLS policy (simplified syntax)
  await executeSQLQuery(`
    DROP POLICY IF EXISTS "Users can view wards in their practice" ON public.wards;
    CREATE POLICY "Users can view wards in their practice"
    ON public.wards FOR ALL
    USING (practice_id IN (
      SELECT practice_id FROM public.users WHERE id = auth.uid()
    ))
  `, 'Creating RLS policy');

  // Step 5: Insert sample data
  await executeSQLQuery(`
    INSERT INTO public.wards (
      ward_name, ward_code, department_id, capacity, current_occupancy,
      ward_type, floor_number, building, nurse_station_phone, practice_id
    )
    SELECT
      'General Ward A', 'GWA-001', d.id, 20, 15, 'General',
      1, 'Main Building', '+27 11 123 4567', d.practice_id
    FROM public.departments d
    WHERE NOT EXISTS (SELECT 1 FROM public.wards WHERE ward_code = 'GWA-001')
    LIMIT 1
  `, 'Adding General Ward A');

  await executeSQLQuery(`
    INSERT INTO public.wards (
      ward_name, ward_code, department_id, capacity, current_occupancy,
      ward_type, floor_number, building, nurse_station_phone, practice_id
    )
    SELECT
      'ICU Ward', 'ICU-001', d.id, 10, 8, 'Intensive Care',
      2, 'Main Building', '+27 11 123 4568', d.practice_id
    FROM public.departments d
    WHERE NOT EXISTS (SELECT 1 FROM public.wards WHERE ward_code = 'ICU-001')
    LIMIT 1
  `, 'Adding ICU Ward');

  await executeSQLQuery(`
    INSERT INTO public.wards (
      ward_name, ward_code, department_id, capacity, current_occupancy,
      ward_type, floor_number, building, nurse_station_phone, practice_id
    )
    SELECT
      'Pediatric Ward', 'PED-001', d.id, 15, 10, 'Pediatrics',
      3, 'Children Wing', '+27 11 123 4569', d.practice_id
    FROM public.departments d
    WHERE NOT EXISTS (SELECT 1 FROM public.wards WHERE ward_code = 'PED-001')
    LIMIT 1
  `, 'Adding Pediatric Ward');

  await executeSQLQuery(`
    INSERT INTO public.wards (
      ward_name, ward_code, department_id, capacity, current_occupancy,
      ward_type, floor_number, building, nurse_station_phone, practice_id
    )
    SELECT
      'Maternity Ward', 'MAT-001', d.id, 12, 9, 'Maternity',
      2, 'Women Health Center', '+27 11 123 4570', d.practice_id
    FROM public.departments d
    WHERE NOT EXISTS (SELECT 1 FROM public.wards WHERE ward_code = 'MAT-001')
    LIMIT 1
  `, 'Adding Maternity Ward');

  // Step 6: Verify
  const verifyResult = await executeSQLQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wards'
    ORDER BY ordinal_position
  `, 'Verifying table structure');

  if (verifyResult) {
    console.log('\n📊 Wards Table Columns:');
    verifyResult.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type})`);
    });
  }

  // Step 7: Check data
  const dataResult = await executeSQLQuery(`
    SELECT ward_name, ward_code, capacity, current_occupancy, ward_type
    FROM public.wards
    LIMIT 5
  `, 'Checking sample data');

  if (dataResult) {
    console.log('\n📋 Sample Ward Data:');
    dataResult.forEach(ward => {
      console.log(`  • ${ward.ward_name} (${ward.ward_code}) - ${ward.current_occupancy}/${ward.capacity} beds`);
    });
  }

  console.log('\n🎉 WARDS TABLE SETUP COMPLETE!');
}

createWardsTable();