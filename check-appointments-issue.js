import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAppointments() {
  console.log('Checking appointments in database...\n');

  // 1. Check all appointments for Dr. Polina practice
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(first_name, last_name, email),
      doctor:users(full_name)
    `)
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
    .order('created_at', { ascending: false });

  if (apptError) {
    console.error('Error fetching appointments:', apptError);
  } else {
    console.log(`Found ${appointments?.length || 0} appointments for Dr. Polina practice:\n`);
    appointments?.forEach(apt => {
      console.log(`- ID: ${apt.id}`);
      console.log(`  Patient: ${apt.patient?.first_name} ${apt.patient?.last_name} (${apt.patient?.email})`);
      console.log(`  Doctor ID: ${apt.doctor_id || 'NOT ASSIGNED'}`);
      console.log(`  Doctor: ${apt.doctor?.full_name || 'NOT ASSIGNED'}`);
      console.log(`  Date/Time: ${apt.date} ${apt.time}`);
      console.log(`  Status: ${apt.status}`);
      console.log(`  Type: ${apt.type}`);
      console.log(`  Created: ${apt.created_at}\n`);
    });
  }

  // 2. Check doctors for Dr. Polina practice
  const { data: doctors, error: docError } = await supabase
    .from('users')
    .select('*')
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3');

  if (docError) {
    console.error('Error fetching doctors:', docError);
  } else {
    console.log(`\nFound ${doctors?.length || 0} doctors for Dr. Polina practice:`);
    doctors?.forEach(doc => {
      console.log(`- ${doc.full_name} (ID: ${doc.id}, Role: ${doc.role})`);
    });
  }

  // 3. Check appointments with NULL doctor_id
  const { data: pendingAppts, error: pendingError } = await supabase
    .from('appointments')
    .select('*')
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
    .is('doctor_id', null);

  console.log(`\nFound ${pendingAppts?.length || 0} appointments without assigned doctor (pending online bookings)`);

  // 4. Check how practiceDataService might be querying
  const doctorIds = doctors?.map(d => d.id) || [];
  const { data: filteredAppts, error: filteredError } = await supabase
    .from('appointments')
    .select('*')
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
    .in('doctor_id', doctorIds);

  console.log(`\nUsing doctor filter (${doctorIds.join(', ')}): Found ${filteredAppts?.length || 0} appointments`);
  console.log('This explains why pending appointments (doctor_id = null) are not showing!');
}

checkAppointments();