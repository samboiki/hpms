import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🔍 INPATIENT DATA VERIFICATION FOR PRACTICE:', practiceId);
console.log('='.repeat(80));

// Query 1: Find all ward/bed/room tables
console.log('\n1️⃣ TABLES WITH WARD/BED/ROOM IN NAME:');
try {
  const { data: tables, error } = await supabase.rpc('execute_sql', {
    query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%ward%' OR table_name LIKE '%bed%' OR table_name LIKE '%room%') ORDER BY table_name;`
  });

  if (error) {
    // Try direct query
    const { data: tables2, error: error2 } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .or('table_name.like.%ward%,table_name.like.%bed%,table_name.like.%room%');

    if (error2) {
      console.log('❌ Error:', error2.message);
      // Execute raw SQL
      const { data: rawData, error: rawError } = await supabase.rpc('exec_sql', {
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%ward%' OR table_name LIKE '%bed%' OR table_name LIKE '%room%') ORDER BY table_name;`
      });

      if (rawError) {
        console.log('❌ Raw SQL Error:', rawError.message);
      } else {
        console.log('✅ Tables found:', rawData);
      }
    } else {
      console.log('✅ Tables found:', tables2);
    }
  } else {
    console.log('✅ Tables found:', tables);
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

// Query 2: Check hospital_wards table
console.log('\n2️⃣ HOSPITAL_WARDS TABLE DATA:');
try {
  const { data: wards, error } = await supabase
    .from('hospital_wards')
    .select('id, ward_name, ward_code, department_id, practice_id, total_beds, occupied_beds, available_beds')
    .eq('practice_id', practiceId);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Found ${wards?.length || 0} wards`);
    console.log(JSON.stringify(wards, null, 2));
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

// Query 3: Check hospital_rooms table
console.log('\n3️⃣ HOSPITAL_ROOMS TABLE DATA:');
const roomTableNames = ['hospital_rooms', 'rooms', 'ward_rooms', 'department_rooms'];
let roomsFound = false;

for (const tableName of roomTableNames) {
  try {
    const { data: rooms, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('practice_id', practiceId)
      .limit(5);

    if (!error && rooms) {
      console.log(`✅ Found ${rooms.length} rooms in table: ${tableName}`);
      console.log(JSON.stringify(rooms, null, 2));
      roomsFound = true;
      break;
    }
  } catch (err) {
    // Continue to next table name
  }
}

if (!roomsFound) {
  console.log('❌ No rooms table found with any of the attempted names');
}

// Query 4: Check hospital_beds table
console.log('\n4️⃣ HOSPITAL_BEDS TABLE DATA:');
const bedTableNames = ['hospital_beds', 'beds', 'ward_beds', 'room_beds'];
let bedsFound = false;

for (const tableName of bedTableNames) {
  try {
    const { data: beds, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('practice_id', practiceId)
      .limit(5);

    if (!error && beds) {
      console.log(`✅ Found ${beds.length} beds in table: ${tableName}`);
      console.log(JSON.stringify(beds, null, 2));
      bedsFound = true;
      break;
    }
  } catch (err) {
    // Continue to next table name
  }
}

if (!bedsFound) {
  console.log('❌ No beds table found with any of the attempted names');
}

// Query 5: Get bed statistics
console.log('\n5️⃣ BED STATISTICS:');
try {
  const { data: beds, error } = await supabase
    .from('hospital_beds')
    .select('status')
    .eq('practice_id', practiceId);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    const stats = {
      total_beds: beds?.length || 0,
      available_beds: beds?.filter(b => b.status === 'available').length || 0,
      occupied_beds: beds?.filter(b => b.status === 'occupied').length || 0,
      maintenance_beds: beds?.filter(b => b.status === 'maintenance').length || 0
    };
    console.log('✅ Bed Statistics:', JSON.stringify(stats, null, 2));
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

// Query 6: Check patient_admissions
console.log('\n6️⃣ PATIENT_ADMISSIONS DATA:');
try {
  const { data: admissions, error } = await supabase
    .from('patient_admissions')
    .select('id, status')
    .eq('practice_id', practiceId);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    const admissionStats = {
      total_admissions: admissions?.length || 0,
      active_admissions: admissions?.filter(a => a.status === 'active').length || 0
    };
    console.log('✅ Admission Statistics:', JSON.stringify(admissionStats, null, 2));
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

// Query 7: Check schema for hospital_beds table
console.log('\n7️⃣ HOSPITAL_BEDS SCHEMA:');
try {
  const { data: schema, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'hospital_beds')
    .order('ordinal_position');

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Schema:', JSON.stringify(schema, null, 2));
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

// Query 8: Check schema for hospital_rooms table
console.log('\n8️⃣ HOSPITAL_ROOMS SCHEMA:');
try {
  const { data: schema, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'hospital_rooms')
    .order('ordinal_position');

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Schema:', JSON.stringify(schema, null, 2));
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}

console.log('\n' + '='.repeat(80));
console.log('✅ VERIFICATION COMPLETE');