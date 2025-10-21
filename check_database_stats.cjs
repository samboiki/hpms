const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStats() {
  console.log('='.repeat(80));
  console.log('DATABASE STATISTICS CHECK');
  console.log('='.repeat(80));

  try {
    // Query 1: Bed Statistics
    console.log('\n1. BED STATISTICS:');
    console.log('-'.repeat(80));
    const { data: bedStats, error: bedError } = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          COUNT(*) as total_beds,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_beds,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds
        FROM hospital_beds;
      `
    });

    if (bedError) {
      console.log('Using direct query instead...');
      const { data: beds, error: bedsError } = await supabase
        .from('hospital_beds')
        .select('status');

      if (bedsError) {
        console.error('Error:', bedsError.message);
      } else {
        const stats = {
          total_beds: beds.length,
          available_beds: beds.filter(b => b.status === 'available').length,
          occupied_beds: beds.filter(b => b.status === 'occupied').length,
          maintenance_beds: beds.filter(b => b.status === 'maintenance').length
        };
        console.log(JSON.stringify(stats, null, 2));
      }
    } else {
      console.log(JSON.stringify(bedStats, null, 2));
    }

    // Query 2: Patient Admissions
    console.log('\n2. PATIENT ADMISSIONS:');
    console.log('-'.repeat(80));
    const { data: admissions, error: admissionsError } = await supabase
      .from('patient_admissions')
      .select('status, admitted_at, discharged_at');

    if (admissionsError) {
      console.error('Error:', admissionsError.message);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const admissionStats = {
        total_admissions: admissions.length,
        active_admissions: admissions.filter(a => a.status === 'active').length,
        admitted_today: admissions.filter(a => a.admitted_at?.startsWith(today)).length,
        discharged_today: admissions.filter(a => a.discharged_at?.startsWith(today)).length
      };
      console.log(JSON.stringify(admissionStats, null, 2));
    }

    // Query 3: Department Linkage for Wards
    console.log('\n3. DEPARTMENT LINKAGE FOR WARDS:');
    console.log('-'.repeat(80));
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('department_id');

    if (wardsError) {
      console.error('Error:', wardsError.message);
    } else {
      const wardsByDept = {};
      wards.forEach(w => {
        const deptId = w.department_id || 'null';
        wardsByDept[deptId] = (wardsByDept[deptId] || 0) + 1;
      });
      console.log(JSON.stringify(wardsByDept, null, 2));
    }

    // Query 4: Department Linkage for Rooms
    console.log('\n4. DEPARTMENT LINKAGE FOR ROOMS:');
    console.log('-'.repeat(80));
    const { data: rooms, error: roomsError } = await supabase
      .from('hospital_rooms')
      .select('department_id');

    if (roomsError) {
      console.error('Error:', roomsError.message);
    } else {
      const roomsByDept = {};
      rooms.forEach(r => {
        const deptId = r.department_id || 'null';
        roomsByDept[deptId] = (roomsByDept[deptId] || 0) + 1;
      });
      console.log(JSON.stringify(roomsByDept, null, 2));
    }

    // Query 5: Department Linkage for Beds
    console.log('\n5. DEPARTMENT LINKAGE FOR BEDS:');
    console.log('-'.repeat(80));
    const { data: bedsWithDept, error: bedsError2 } = await supabase
      .from('hospital_beds')
      .select('department_id');

    if (bedsError2) {
      console.error('Error:', bedsError2.message);
    } else {
      const bedsByDept = {};
      bedsWithDept.forEach(b => {
        const deptId = b.department_id || 'null';
        bedsByDept[deptId] = (bedsByDept[deptId] || 0) + 1;
      });
      console.log(JSON.stringify(bedsByDept, null, 2));
    }

    // Query 6: Detailed Bed Stats by Department
    console.log('\n6. DETAILED BED STATISTICS BY DEPARTMENT:');
    console.log('-'.repeat(80));
    const { data: bedsDetailed, error: bedsDetailedError } = await supabase
      .from('hospital_beds')
      .select('department_id, status, departments(name)');

    if (bedsDetailedError) {
      console.error('Error:', bedsDetailedError.message);
    } else {
      const detailedStats = {};
      bedsDetailed.forEach(b => {
        const deptId = b.department_id || 'null';
        if (!detailedStats[deptId]) {
          detailedStats[deptId] = {
            department_id: deptId,
            department_name: b.departments?.name || 'Unknown',
            total_beds: 0,
            available: 0,
            occupied: 0,
            maintenance: 0
          };
        }
        detailedStats[deptId].total_beds++;
        if (b.status === 'available') detailedStats[deptId].available++;
        if (b.status === 'occupied') detailedStats[deptId].occupied++;
        if (b.status === 'maintenance') detailedStats[deptId].maintenance++;
      });
      console.log(JSON.stringify(Object.values(detailedStats), null, 2));
    }

    // Query 7: Detailed Admission Stats by Department
    console.log('\n7. DETAILED ADMISSION STATISTICS BY DEPARTMENT:');
    console.log('-'.repeat(80));
    const { data: admissionsDetailed, error: admissionsDetailedError } = await supabase
      .from('patient_admissions')
      .select('department_id, status, admitted_at, departments(name)');

    if (admissionsDetailedError) {
      console.error('Error:', admissionsDetailedError.message);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const detailedAdmissionStats = {};
      admissionsDetailed.forEach(a => {
        const deptId = a.department_id || 'null';
        if (!detailedAdmissionStats[deptId]) {
          detailedAdmissionStats[deptId] = {
            department_id: deptId,
            department_name: a.departments?.name || 'Unknown',
            total_admissions: 0,
            active: 0,
            discharged: 0,
            admitted_today: 0
          };
        }
        detailedAdmissionStats[deptId].total_admissions++;
        if (a.status === 'active') detailedAdmissionStats[deptId].active++;
        if (a.status === 'discharged') detailedAdmissionStats[deptId].discharged++;
        if (a.admitted_at?.startsWith(today)) detailedAdmissionStats[deptId].admitted_today++;
      });
      console.log(JSON.stringify(Object.values(detailedAdmissionStats), null, 2));
    }

    // Additional Check: Sample bed records
    console.log('\n8. SAMPLE BED RECORDS (First 5):');
    console.log('-'.repeat(80));
    const { data: sampleBeds, error: sampleBedsError } = await supabase
      .from('hospital_beds')
      .select('id, bed_number, status, department_id, room_id, ward_id, practice_id')
      .limit(5);

    if (sampleBedsError) {
      console.error('Error:', sampleBedsError.message);
    } else {
      console.log(JSON.stringify(sampleBeds, null, 2));
    }

    // Additional Check: Sample admission records
    console.log('\n9. SAMPLE ADMISSION RECORDS (First 5):');
    console.log('-'.repeat(80));
    const { data: sampleAdmissions, error: sampleAdmissionsError } = await supabase
      .from('patient_admissions')
      .select('id, patient_id, status, department_id, ward_id, room_id, bed_id, admitted_at, discharged_at')
      .limit(5);

    if (sampleAdmissionsError) {
      console.error('Error:', sampleAdmissionsError.message);
    } else {
      console.log(JSON.stringify(sampleAdmissions, null, 2));
    }

    console.log('\n' + '='.repeat(80));
    console.log('CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

checkDatabaseStats();