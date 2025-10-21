const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCompleteStats() {
  console.log('='.repeat(80));
  console.log('COMPLETE DATABASE STATISTICS ANALYSIS');
  console.log('='.repeat(80));

  // Get all wards with department linkage
  console.log('\n1. WARDS ANALYSIS:');
  console.log('-'.repeat(80));
  const { data: wards, error: wardsError } = await supabase
    .from('hospital_wards')
    .select('*');

  if (wardsError) {
    console.error('Error:', wardsError.message);
  } else {
    console.log(`Total wards: ${wards.length}`);
    const wardsWithDept = wards.filter(w => w.department_id !== null);
    const wardsWithoutDept = wards.filter(w => w.department_id === null);
    console.log(`Wards with department_id: ${wardsWithDept.length}`);
    console.log(`Wards WITHOUT department_id: ${wardsWithoutDept.length}`);

    if (wardsWithoutDept.length > 0) {
      console.log('\nWards missing department_id:');
      wardsWithoutDept.forEach(w => {
        console.log(`  - ${w.ward_name} (${w.ward_code}) - Type: ${w.ward_type}`);
      });
    }

    // Count by ward type
    const byType = {};
    wards.forEach(w => {
      byType[w.ward_type] = (byType[w.ward_type] || 0) + 1;
    });
    console.log('\nWards by type:', byType);

    // Calculate total and occupied beds
    const totalBedsFromWards = wards.reduce((sum, w) => sum + (w.total_beds || 0), 0);
    const occupiedBedsFromWards = wards.reduce((sum, w) => sum + (w.occupied_beds || 0), 0);
    console.log(`\nTotal beds (from wards): ${totalBedsFromWards}`);
    console.log(`Occupied beds (from wards): ${occupiedBedsFromWards}`);
    console.log(`Available beds (from wards): ${totalBedsFromWards - occupiedBedsFromWards}`);
  }

  // Get all rooms
  console.log('\n\n2. ROOMS ANALYSIS:');
  console.log('-'.repeat(80));
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*');

  if (roomsError) {
    console.error('Error:', roomsError.message);
  } else {
    console.log(`Total rooms: ${rooms.length}`);
    if (rooms.length > 0) {
      console.log('Sample room columns:', Object.keys(rooms[0]).join(', '));

      const roomsWithDept = rooms.filter(r => r.department_id !== null);
      const roomsWithoutDept = rooms.filter(r => r.department_id === null);
      console.log(`Rooms with department_id: ${roomsWithDept.length}`);
      console.log(`Rooms WITHOUT department_id: ${roomsWithoutDept.length}`);
    } else {
      console.log('No rooms found in database');
    }
  }

  // Get all beds
  console.log('\n\n3. BEDS ANALYSIS:');
  console.log('-'.repeat(80));
  const { data: beds, error: bedsError } = await supabase
    .from('beds')
    .select('*');

  if (bedsError) {
    console.error('Error:', bedsError.message);
  } else {
    console.log(`Total beds: ${beds.length}`);
    if (beds.length > 0) {
      console.log('Sample bed columns:', Object.keys(beds[0]).join(', '));

      const bedsWithDept = beds.filter(b => b.department_id !== null);
      const bedsWithoutDept = beds.filter(b => b.department_id === null);
      console.log(`Beds with department_id: ${bedsWithDept.length}`);
      console.log(`Beds WITHOUT department_id: ${bedsWithoutDept.length}`);

      // Count by status if status column exists
      if (beds[0].status) {
        const byStatus = {};
        beds.forEach(b => {
          byStatus[b.status] = (byStatus[b.status] || 0) + 1;
        });
        console.log('\nBeds by status:', byStatus);
      } else {
        console.log('\nNote: beds table does not have a "status" column');
        console.log('Available columns:', Object.keys(beds[0]).join(', '));
      }
    } else {
      console.log('No beds found in database');
    }
  }

  // Get all patient admissions
  console.log('\n\n4. PATIENT ADMISSIONS ANALYSIS:');
  console.log('-'.repeat(80));
  const { data: admissions, error: admissionsError } = await supabase
    .from('patient_admissions')
    .select('*');

  if (admissionsError) {
    console.error('Error:', admissionsError.message);
  } else {
    console.log(`Total admissions: ${admissions.length}`);
    if (admissions.length > 0) {
      console.log('Sample admission columns:', Object.keys(admissions[0]).join(', '));

      const admissionsWithDept = admissions.filter(a => a.department_id !== null);
      const admissionsWithoutDept = admissions.filter(a => a.department_id === null);
      console.log(`Admissions with department_id: ${admissionsWithDept.length}`);
      console.log(`Admissions WITHOUT department_id: ${admissionsWithoutDept.length}`);

      // Count by status if status column exists
      if (admissions[0].admission_status) {
        const byStatus = {};
        admissions.forEach(a => {
          byStatus[a.admission_status] = (byStatus[a.admission_status] || 0) + 1;
        });
        console.log('\nAdmissions by status:', byStatus);
      } else {
        console.log('\nNote: patient_admissions table does not have a "status" column');
        console.log('Available columns:', Object.keys(admissions[0]).join(', '));
      }

      // Count today's admissions
      const today = new Date().toISOString().split('T')[0];
      const admittedToday = admissions.filter(a => a.admitted_at?.startsWith(today));
      const dischargedToday = admissions.filter(a => a.discharge_date?.startsWith(today));
      console.log(`\nAdmitted today: ${admittedToday.length}`);
      console.log(`Discharged today: ${dischargedToday.length}`);
    } else {
      console.log('No admissions found in database');
    }
  }

  // Get departments for reference
  console.log('\n\n5. DEPARTMENTS REFERENCE:');
  console.log('-'.repeat(80));
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, name, department_type');

  if (deptError) {
    console.error('Error:', deptError.message);
  } else {
    console.log(`Total departments: ${departments.length}`);
    console.log('\nAvailable departments:');
    departments.forEach(d => {
      console.log(`  - ${d.name} (${d.department_type}) - ID: ${d.id}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF ISSUES:');
  console.log('='.repeat(80));

  if (wards && wards.filter(w => w.department_id === null).length > 0) {
    console.log('❌ ISSUE 1: All wards have NULL department_id');
  }

  if (rooms && rooms.length === 0) {
    console.log('❌ ISSUE 2: No rooms exist in the database');
  } else if (rooms && rooms.filter(r => r.department_id === null).length === rooms.length) {
    console.log('❌ ISSUE 2: All rooms have NULL department_id');
  }

  if (beds && beds.length === 0) {
    console.log('❌ ISSUE 3: No beds exist in the database');
  } else if (beds && beds.filter(b => b.department_id === null).length === beds.length) {
    console.log('❌ ISSUE 3: All beds have NULL department_id');
  }

  if (admissions && admissions.length === 0) {
    console.log('⚠️  ISSUE 4: No patient admissions exist in the database');
  }

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

getCompleteStats();