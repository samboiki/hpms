// Test appointment approval flow
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testAppointmentApproval() {
  console.log('🧪 Testing Appointment Approval Flow');
  
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  // 1. Check pending appointments
  console.log('\n1. Checking pending appointments...');
  const { data: pendingAppts, error: pendingError } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name),
      doctor:users!doctor_id(id, full_name)
    `)
    .eq('practice_id', practiceId)
    .eq('status', 'pending');
    
  if (pendingError) {
    console.error('❌ Error fetching pending appointments:', pendingError);
    return;
  }
  
  console.log(`✅ Found ${pendingAppts?.length || 0} pending appointments`);
  
  if (pendingAppts && pendingAppts.length > 0) {
    console.log('Sample pending appointment:', {
      id: pendingAppts[0].id,
      patient: `${pendingAppts[0].patient?.first_name} ${pendingAppts[0].patient?.last_name}`,
      date: pendingAppts[0].date,
      time: pendingAppts[0].time,
      doctor_id: pendingAppts[0].doctor_id,
      practice_id: pendingAppts[0].practice_id
    });
  }
  
  // 2. Check available doctors
  console.log('\n2. Checking available doctors...');
  const { data: doctors, error: doctorError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'doctor')
    .eq('practice_id', practiceId);
    
  if (doctorError) {
    console.error('❌ Error fetching doctors:', doctorError);
    return;
  }
  
  console.log(`✅ Found ${doctors?.length || 0} doctors`);
  doctors?.forEach(doc => {
    console.log(`   - Dr. ${doc.full_name} (${doc.id})`);
  });
  
  // 3. Test approval flow (dry run)
  if (pendingAppts && pendingAppts.length > 0 && doctors && doctors.length > 0) {
    const testAppt = pendingAppts[0];
    const testDoctor = doctors[0];
    
    console.log('\n3. Testing approval flow (dry run)...');
    console.log(`   Would assign appointment ${testAppt.id} to Dr. ${testDoctor.full_name}`);
    console.log(`   Status would change: pending → scheduled`);
    console.log(`   doctor_id would be set to: ${testDoctor.id}`);
  }
  
  // 4. Check if appointments show in grid view
  console.log('\n4. Verifying grid view query...');
  const { data: allAppts, error: allError } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, email),
      doctor:users!doctor_id(id, full_name)
    `)
    .eq('practice_id', practiceId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
    
  if (allError) {
    console.error('❌ Error in grid view query:', allError);
  } else {
    const statusCounts = {};
    allAppts?.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
    });
    console.log('✅ Appointment counts by status:', statusCounts);
  }
}

// Run the test
testAppointmentApproval().catch(console.error);