// 2025 FAST Solution: Create Rooms Table
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

async function createRoomsTable() {
  console.log('🚀 2025 FAST SOLUTION: Creating Rooms Table');
  console.log('================================================');

  // Step 1: Create the table
  await executeSQLQuery(`
    CREATE TABLE IF NOT EXISTS public.rooms (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      room_number TEXT NOT NULL,
      room_name TEXT,
      room_type TEXT,
      department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
      ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
      floor_number INTEGER DEFAULT 1,
      building TEXT DEFAULT 'Main Building',
      bed_count INTEGER DEFAULT 1,
      occupied_beds INTEGER DEFAULT 0,
      room_status TEXT DEFAULT 'Available',
      amenities TEXT[],
      daily_rate DECIMAL(10,2),
      is_active BOOLEAN DEFAULT true,
      practice_id UUID REFERENCES public.practices(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, 'Creating rooms table');

  // Step 2: Create indexes
  await executeSQLQuery(`
    CREATE INDEX IF NOT EXISTS idx_rooms_practice_id ON public.rooms(practice_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_department_id ON public.rooms(department_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_ward_id ON public.rooms(ward_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);
    CREATE INDEX IF NOT EXISTS idx_rooms_room_status ON public.rooms(room_status);
  `, 'Creating indexes');

  // Step 3: Enable RLS
  await executeSQLQuery(`
    ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY
  `, 'Enabling RLS');

  // Step 4: Create RLS policy
  await executeSQLQuery(`
    DROP POLICY IF EXISTS "Users can view rooms in their practice" ON public.rooms;
    CREATE POLICY "Users can view rooms in their practice"
    ON public.rooms FOR ALL
    USING (practice_id IN (
      SELECT practice_id FROM public.users WHERE id = auth.uid()
    ))
  `, 'Creating RLS policy');

  // Step 5: Insert sample data
  await executeSQLQuery(`
    INSERT INTO public.rooms (
      room_number, room_name, room_type, department_id, ward_id, floor_number,
      building, bed_count, occupied_beds, room_status, amenities, daily_rate, practice_id
    )
    SELECT
      '101', 'Room 101', 'Private', d.id, w.id, 1,
      'Main Building', 1, 0, 'Available',
      ARRAY['TV', 'Air Conditioning', 'Private Bathroom'],
      1500.00, d.practice_id
    FROM public.departments d
    LEFT JOIN public.wards w ON w.department_id = d.id
    WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE room_number = '101')
    LIMIT 1
  `, 'Adding Room 101');

  await executeSQLQuery(`
    INSERT INTO public.rooms (
      room_number, room_name, room_type, department_id, ward_id, floor_number,
      building, bed_count, occupied_beds, room_status, amenities, daily_rate, practice_id
    )
    SELECT
      '102', 'Room 102', 'Semi-Private', d.id, w.id, 1,
      'Main Building', 2, 1, 'Partially Occupied',
      ARRAY['TV', 'Air Conditioning'],
      1000.00, d.practice_id
    FROM public.departments d
    LEFT JOIN public.wards w ON w.department_id = d.id
    WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE room_number = '102')
    LIMIT 1
  `, 'Adding Room 102');

  await executeSQLQuery(`
    INSERT INTO public.rooms (
      room_number, room_name, room_type, department_id, ward_id, floor_number,
      building, bed_count, occupied_beds, room_status, amenities, daily_rate, practice_id
    )
    SELECT
      '103', 'Room 103', 'General', d.id, w.id, 1,
      'Main Building', 4, 3, 'Occupied',
      ARRAY['Shared Bathroom'],
      500.00, d.practice_id
    FROM public.departments d
    LEFT JOIN public.wards w ON w.department_id = d.id
    WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE room_number = '103')
    LIMIT 1
  `, 'Adding Room 103');

  await executeSQLQuery(`
    INSERT INTO public.rooms (
      room_number, room_name, room_type, department_id, ward_id, floor_number,
      building, bed_count, occupied_beds, room_status, amenities, daily_rate, practice_id
    )
    SELECT
      'ICU-01', 'ICU Room 1', 'ICU', d.id, w.id, 2,
      'Main Building', 1, 1, 'Occupied',
      ARRAY['Ventilator', 'Cardiac Monitor', 'Private Bathroom', 'Air Conditioning'],
      3500.00, d.practice_id
    FROM public.departments d
    LEFT JOIN public.wards w ON w.department_id = d.id
    WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE room_number = 'ICU-01')
    LIMIT 1
  `, 'Adding ICU Room');

  // Step 6: Verify
  const verifyResult = await executeSQLQuery(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rooms'
    ORDER BY ordinal_position
  `, 'Verifying table structure');

  if (verifyResult) {
    console.log('\n📊 Rooms Table Columns:');
    verifyResult.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type})`);
    });
  }

  // Step 7: Check data
  const dataResult = await executeSQLQuery(`
    SELECT room_number, room_name, room_type, bed_count, occupied_beds, room_status
    FROM public.rooms
    LIMIT 5
  `, 'Checking sample data');

  if (dataResult) {
    console.log('\n📋 Sample Room Data:');
    dataResult.forEach(room => {
      console.log(`  • ${room.room_name} (${room.room_number}) - ${room.room_type} - ${room.occupied_beds}/${room.bed_count} beds - ${room.room_status}`);
    });
  }

  console.log('\n🎉 ROOMS TABLE SETUP COMPLETE!');
}

createRoomsTable();