import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkInpatientData() {
  console.log('📋 CHECKING EXISTING INPATIENT DATA\n');

  try {
    // Check wards
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .order('ward_name');

    if (wardsError) {
      console.log('❌ Error fetching wards:', wardsError.message);
    } else {
      console.log(`🏥 EXISTING WARDS: ${wards.length} total`);
      wards.forEach(ward => {
        console.log(`• ${ward.ward_name} (${ward.ward_code}) - ${ward.ward_type}`);
        console.log(`  Practice ID: ${ward.practice_id}`);
        console.log(`  Total beds: ${ward.total_beds}, Occupied: ${ward.occupied_beds}`);
      });
      console.log();
    }

    // Check beds
    const { data: beds, error: bedsError } = await supabase
      .from('ward_beds')
      .select('*, ward:hospital_wards(ward_name, ward_code)')
      .order('bed_number');

    if (bedsError) {
      console.log('❌ Error fetching beds:', bedsError.message);
    } else {
      console.log(`🛏️ EXISTING BEDS: ${beds.length} total`);
      const bedsByStatus = beds.reduce((acc, bed) => {
        acc[bed.status] = (acc[bed.status] || 0) + 1;
        return acc;
      }, {});

      Object.entries(bedsByStatus).forEach(([status, count]) => {
        console.log(`  • ${status}: ${count} beds`);
      });
      console.log();
    }

    // Check admissions
    const { data: admissions, error: admissionsError } = await supabase
      .from('patient_admissions')
      .select('*, patient:patients(first_name, last_name)')
      .order('admission_date', { ascending: false });

    if (admissionsError) {
      console.log('❌ Error fetching admissions:', admissionsError.message);
    } else {
      console.log(`🏥 EXISTING ADMISSIONS: ${admissions.length} total`);
      const activeAdmissions = admissions.filter(a => a.admission_status === 'active');
      console.log(`  • Active: ${activeAdmissions.length}`);
      console.log(`  • Discharged: ${admissions.length - activeAdmissions.length}`);

      if (activeAdmissions.length > 0) {
        console.log('\n📋 ACTIVE ADMISSIONS:');
        activeAdmissions.forEach(admission => {
          console.log(`  • ${admission.patient.first_name} ${admission.patient.last_name} (${admission.admission_number})`);
          console.log(`    Admitted: ${new Date(admission.admission_date).toLocaleDateString()}`);
          console.log(`    Condition: ${admission.patient_condition || 'Not specified'}`);
        });
      }
      console.log();
    }

    // Check bed allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('bed_allocations')
      .select('*, patient:patients(first_name, last_name), bed:ward_beds(bed_number), ward:hospital_wards(ward_name)')
      .eq('is_current', true);

    if (allocationsError) {
      console.log('❌ Error fetching bed allocations:', allocationsError.message);
    } else {
      console.log(`🛏️ CURRENT BED ALLOCATIONS: ${allocations.length} active`);
      allocations.forEach(allocation => {
        console.log(`  • ${allocation.patient.first_name} ${allocation.patient.last_name} in ${allocation.ward.ward_name} - Bed ${allocation.bed.bed_number}`);
      });
      console.log();
    }

    // Check departments
    const { data: departments, error: deptsError } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (deptsError) {
      console.log('❌ Error fetching departments:', deptsError.message);
    } else {
      console.log(`🏢 EXISTING DEPARTMENTS: ${departments.length} total`);
      departments.forEach(dept => {
        console.log(`• ${dept.name} (${dept.id})`);
        console.log(`  Practice ID: ${dept.practice_id}`);
      });
      console.log();
    }

    // Summary
    console.log('📊 SUMMARY:');
    console.log('==========================================');
    console.log(`✅ Wards: ${wards?.length || 0}`);
    console.log(`✅ Beds: ${beds?.length || 0}`);
    console.log(`✅ Active Admissions: ${admissions?.filter(a => a.admission_status === 'active').length || 0}`);
    console.log(`✅ Current Bed Allocations: ${allocations?.length || 0}`);
    console.log(`✅ Departments: ${departments?.length || 0}`);

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkInpatientData();