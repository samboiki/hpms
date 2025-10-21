// 2025 Solution: Create Wards Table via Supabase Management API
const PROJECT_ID = 'jjxlfunlbyayxwvlpgwt';
const ACCESS_TOKEN = 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';

async function createWardsTable() {
  console.log('🚀 2025 SOLUTION: Creating Wards Table via Management API');
  console.log('================================================\n');

  try {
    // First, check if wards table exists
    console.log('🔍 Checking if wards table exists...');

    const checkResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'wards'
          );
        `
      })
    });

    if (checkResponse.ok) {
      const checkResult = await checkResponse.json();
      console.log('Check result:', checkResult);

      // Create wards table
      console.log('\n🔧 Creating wards table...');

      const createResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            -- Create wards table if it doesn't exist
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
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_wards_practice_id ON public.wards(practice_id);
            CREATE INDEX IF NOT EXISTS idx_wards_department_id ON public.wards(department_id);
            CREATE INDEX IF NOT EXISTS idx_wards_is_active ON public.wards(is_active);

            -- Enable RLS
            ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

            -- Create RLS policy
            CREATE POLICY IF NOT EXISTS "Users can view wards in their practice"
            ON public.wards FOR ALL
            USING (practice_id IN (
              SELECT practice_id FROM public.users WHERE id = auth.uid()
            ));

            -- Insert sample data for testing
            INSERT INTO public.wards (
              ward_name,
              ward_code,
              department_id,
              capacity,
              current_occupancy,
              ward_type,
              floor_number,
              building,
              nurse_station_phone,
              practice_id
            )
            SELECT
              'General Ward A',
              'GWA-001',
              d.id,
              20,
              15,
              'General',
              1,
              'Main Building',
              '+27 11 123 4567',
              d.practice_id
            FROM public.departments d
            WHERE NOT EXISTS (
              SELECT 1 FROM public.wards WHERE ward_code = 'GWA-001'
            )
            LIMIT 1;

            INSERT INTO public.wards (
              ward_name,
              ward_code,
              department_id,
              capacity,
              current_occupancy,
              ward_type,
              floor_number,
              building,
              nurse_station_phone,
              practice_id
            )
            SELECT
              'ICU Ward',
              'ICU-001',
              d.id,
              10,
              8,
              'Intensive Care',
              2,
              'Main Building',
              '+27 11 123 4568',
              d.practice_id
            FROM public.departments d
            WHERE NOT EXISTS (
              SELECT 1 FROM public.wards WHERE ward_code = 'ICU-001'
            )
            LIMIT 1;

            INSERT INTO public.wards (
              ward_name,
              ward_code,
              department_id,
              capacity,
              current_occupancy,
              ward_type,
              floor_number,
              building,
              nurse_station_phone,
              practice_id
            )
            SELECT
              'Pediatric Ward',
              'PED-001',
              d.id,
              15,
              10,
              'Pediatrics',
              3,
              'Children Wing',
              '+27 11 123 4569',
              d.practice_id
            FROM public.departments d
            WHERE NOT EXISTS (
              SELECT 1 FROM public.wards WHERE ward_code = 'PED-001'
            )
            LIMIT 1;

            INSERT INTO public.wards (
              ward_name,
              ward_code,
              department_id,
              capacity,
              current_occupancy,
              ward_type,
              floor_number,
              building,
              nurse_station_phone,
              practice_id
            )
            SELECT
              'Maternity Ward',
              'MAT-001',
              d.id,
              12,
              9,
              'Maternity',
              2,
              'Women Health Center',
              '+27 11 123 4570',
              d.practice_id
            FROM public.departments d
            WHERE NOT EXISTS (
              SELECT 1 FROM public.wards WHERE ward_code = 'MAT-001'
            )
            LIMIT 1;
          `
        })
      });

      if (createResponse.ok) {
        const createResult = await createResponse.json();
        console.log('✅ Wards table created/updated successfully!');
        console.log('Result:', createResult);
      } else {
        const errorText = await createResponse.text();
        console.log('❌ Failed to create wards table:', createResponse.status, errorText);
      }

      // Verify the table was created
      console.log('\n🔍 Verifying wards table structure...');

      const verifyResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'wards'
            ORDER BY ordinal_position;
          `
        })
      });

      if (verifyResponse.ok) {
        const verifyResult = await verifyResponse.json();
        console.log('✅ Wards table columns:');
        console.log(verifyResult);
      }

    } else {
      const errorText = await checkResponse.text();
      console.log('❌ Failed to check table existence:', checkResponse.status, errorText);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createWardsTable();