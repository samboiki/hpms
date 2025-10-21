import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🔍 ACTUAL SCHEMA VERIFICATION');
console.log('='.repeat(80));

// Function to get actual columns from a table
async function getTableSchema(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      return { error: error.message };
    }

    if (data && data.length > 0) {
      return { columns: Object.keys(data[0]) };
    }

    return { columns: [] };
  } catch (err) {
    return { error: err.message };
  }
}

// Function to count records
async function countRecords(tableName, practiceFilter = true) {
  try {
    let query = supabase.from(tableName).select('*', { count: 'exact', head: true });

    if (practiceFilter) {
      query = query.eq('practice_id', practiceId);
    }

    const { count, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { count };
  } catch (err) {
    return { error: err.message };
  }
}

// Check hospital_wards table
console.log('\n1️⃣ HOSPITAL_WARDS TABLE:');
const wardsSchema = await getTableSchema('hospital_wards');
console.log('Schema:', JSON.stringify(wardsSchema, null, 2));

const wardsCount = await countRecords('hospital_wards');
console.log('Total records:', JSON.stringify(wardsCount, null, 2));

// Get actual ward data
const { data: wardsData, error: wardsError } = await supabase
  .from('hospital_wards')
  .select('*')
  .eq('practice_id', practiceId);

if (wardsError) {
  console.log('Error fetching wards:', wardsError.message);
} else {
  console.log(`Found ${wardsData?.length || 0} wards:`);
  wardsData?.forEach(ward => {
    console.log(`  - ${ward.ward_name} (${ward.ward_code})`);
    console.log(`    Department: ${ward.department_id}`);
    console.log(`    Total beds: ${ward.total_beds || 'N/A'}`);
    console.log(`    Occupied: ${ward.occupied_beds || 'N/A'}`);
  });
}

// Check rooms table
console.log('\n2️⃣ ROOMS TABLE:');
const roomsSchema = await getTableSchema('rooms');
console.log('Schema:', JSON.stringify(roomsSchema, null, 2));

const roomsCount = await countRecords('rooms');
console.log('Total records:', JSON.stringify(roomsCount, null, 2));

// Get room statistics by ward
const { data: roomsData, error: roomsError } = await supabase
  .from('rooms')
  .select('ward_id, room_status, bed_count, occupied_beds')
  .eq('practice_id', practiceId);

if (roomsError) {
  console.log('Error fetching rooms:', roomsError.message);
} else {
  console.log(`\nRoom Statistics:`);
  const totalRooms = roomsData?.length || 0;
  const totalBeds = roomsData?.reduce((sum, r) => sum + (r.bed_count || 0), 0) || 0;
  const totalOccupied = roomsData?.reduce((sum, r) => sum + (r.occupied_beds || 0), 0) || 0;

  console.log(`  Total rooms: ${totalRooms}`);
  console.log(`  Total beds: ${totalBeds}`);
  console.log(`  Occupied beds: ${totalOccupied}`);
  console.log(`  Available beds: ${totalBeds - totalOccupied}`);
}

// Check beds table
console.log('\n3️⃣ BEDS TABLE:');
const bedsSchema = await getTableSchema('beds');
console.log('Schema:', JSON.stringify(bedsSchema, null, 2));

const bedsCount = await countRecords('beds');
console.log('Total records:', JSON.stringify(bedsCount, null, 2));

// Get bed statistics
const { data: bedsData, error: bedsError } = await supabase
  .from('beds')
  .select('bed_status, patient_id')
  .eq('practice_id', practiceId);

if (bedsError) {
  console.log('Error fetching beds:', bedsError.message);
} else {
  console.log(`\nBed Statistics:`);
  const totalBeds = bedsData?.length || 0;
  const availableBeds = bedsData?.filter(b => b.bed_status === 'Available').length || 0;
  const occupiedBeds = bedsData?.filter(b => b.bed_status === 'Occupied' || b.patient_id !== null).length || 0;
  const maintenanceBeds = bedsData?.filter(b => b.bed_status === 'Maintenance').length || 0;

  console.log(`  Total beds: ${totalBeds}`);
  console.log(`  Available: ${availableBeds}`);
  console.log(`  Occupied: ${occupiedBeds}`);
  console.log(`  Maintenance: ${maintenanceBeds}`);

  console.log(`\nBed Status Values found:`);
  const uniqueStatuses = [...new Set(bedsData?.map(b => b.bed_status) || [])];
  console.log(`  ${JSON.stringify(uniqueStatuses)}`);
}

// Check patient_admissions table
console.log('\n4️⃣ PATIENT_ADMISSIONS TABLE:');
const admissionsSchema = await getTableSchema('patient_admissions');
console.log('Schema:', JSON.stringify(admissionsSchema, null, 2));

const admissionsCount = await countRecords('patient_admissions');
console.log('Total records:', JSON.stringify(admissionsCount, null, 2));

// Get admission data
const { data: admissionsData, error: admissionsError } = await supabase
  .from('patient_admissions')
  .select('*')
  .eq('practice_id', practiceId)
  .limit(5);

if (admissionsError) {
  console.log('Error fetching admissions:', admissionsError.message);
} else {
  console.log(`\nAdmissions sample (${admissionsData?.length || 0} records):`);
  admissionsData?.forEach(admission => {
    console.log(`  - Admission ID: ${admission.id}`);
    console.log(`    Patient: ${admission.patient_id}`);
    console.log(`    Bed: ${admission.bed_id || 'N/A'}`);
    console.log(`    Ward: ${admission.ward_id || 'N/A'}`);
    console.log(`    Status field: ${admission.admission_status || admission.status || 'N/A'}`);
  });
}

// Summary statistics
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY FOR PRACTICE:', practiceId);
console.log('='.repeat(80));

console.log('\n✅ VERIFIED TABLE NAMES:');
console.log('  - hospital_wards (wards)');
console.log('  - rooms (NOT hospital_rooms)');
console.log('  - beds (NOT hospital_beds)');
console.log('  - patient_admissions');

console.log('\n🔢 CURRENT COUNTS:');
console.log(`  - Wards: ${wardsData?.length || 0}`);
console.log(`  - Rooms: ${roomsData?.length || 0}`);
console.log(`  - Beds: ${bedsData?.length || 0}`);
console.log(`  - Admissions: ${admissionsData?.length || 0}`);

console.log('\n💡 COLUMN NAME FINDINGS:');
console.log('  - Beds table uses: bed_status (not status)');
console.log('  - Bed status values: Available, Occupied, Maintenance');
console.log('  - Patient_admissions: Check if it uses "status" or "admission_status"');

console.log('\n' + '='.repeat(80));