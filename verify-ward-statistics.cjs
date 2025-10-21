const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStatistics() {
  console.log('=== WARD STATISTICS (AGGREGATED) ===\n');

  const { data: wards, error: wardsError } = await supabase
    .from('hospital_wards')
    .select('total_beds, occupied_beds')
    .eq('is_active', true);

  if (wardsError) {
    console.error('Error fetching wards:', wardsError);
    return;
  }

  const totalWards = wards.length;
  const totalBeds = wards.reduce((sum, w) => sum + (w.total_beds || 0), 0);
  const occupiedBeds = wards.reduce((sum, w) => sum + (w.occupied_beds || 0), 0);
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0;

  console.log('Total Wards:', totalWards);
  console.log('Total Beds:', totalBeds);
  console.log('Occupied Beds:', occupiedBeds);
  console.log('Available Beds:', availableBeds);
  console.log('Occupancy Rate:', occupancyRate + '%');

  console.log('\n=== WARD DETAILS WITH DEPARTMENT STATUS ===\n');
  const { data: wardDetails, error: wardDetailsError } = await supabase
    .from('hospital_wards')
    .select('ward_name, ward_code, ward_type, total_beds, occupied_beds, department_id')
    .eq('is_active', true)
    .order('ward_name');

  if (wardDetailsError) {
    console.error('Error fetching ward details:', wardDetailsError);
  } else {
    wardDetails.forEach(ward => {
      const deptStatus = ward.department_id ? 'LINKED ✓' : 'NOT LINKED ✗';
      console.log(`${ward.ward_name} (${ward.ward_code}) | Type: ${ward.ward_type} | Beds: ${ward.occupied_beds}/${ward.total_beds} | Dept: ${deptStatus}`);
    });
  }

  console.log('\n=== PATIENT ADMISSIONS STATISTICS ===\n');
  const { data: admissions, error: admissionError } = await supabase
    .from('patient_admissions')
    .select('admission_status');

  if (admissionError) {
    console.error('Error fetching admissions:', admissionError);
  } else {
    const total = admissions.length;
    const active = admissions.filter(a => a.admission_status === 'active').length;
    const discharged = admissions.filter(a => a.admission_status === 'discharged').length;
    const transferred = admissions.filter(a => a.admission_status === 'transferred').length;

    console.log('Total Admissions:', total);
    console.log('Active Admissions:', active);
    console.log('Discharged:', discharged);
    console.log('Transferred:', transferred);
  }

  console.log('\n=== SUMMARY ===\n');
  console.log('Dashboard should display:');
  console.log(`- ${totalWards} active wards`);
  console.log(`- ${totalBeds} total beds`);
  console.log(`- ${occupiedBeds} occupied beds`);
  console.log(`- ${availableBeds} available beds`);
  console.log(`- ${occupancyRate}% occupancy rate`);
  console.log(`- ${admissions.filter(a => a.admission_status === 'active').length} active admissions`);
}

verifyStatistics().catch(console.error);