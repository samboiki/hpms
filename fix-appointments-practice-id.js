import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixAppointments() {
  console.log('Checking appointments without practice_id...\n');

  // 1. Check appointments without practice_id
  const { data: appointmentsNoPractice, error: checkError } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, date, time, status')
    .is('practice_id', null);

  if (checkError) {
    console.error('Error checking appointments:', checkError);
    return;
  }

  console.log(`Found ${appointmentsNoPractice?.length || 0} appointments without practice_id`);

  if (appointmentsNoPractice && appointmentsNoPractice.length > 0) {
    console.log('\nUpdating appointments to Dr. Polina practice...');
    
    // Update all appointments without practice_id to Dr. Polina's practice
    const { data: updateResult, error: updateError } = await supabase
      .from('appointments')
      .update({ practice_id: 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3' })
      .is('practice_id', null)
      .select();

    if (updateError) {
      console.error('Error updating appointments:', updateError);
    } else {
      console.log(`Successfully updated ${updateResult?.length || 0} appointments`);
    }
  }

  // 2. Now check all appointments for Dr. Polina practice
  console.log('\nChecking all appointments for Dr. Polina practice...');
  
  const { data: allAppointments, error: allError } = await supabase
    .from('appointments')
    .select('*')
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3');

  if (allError) {
    console.error('Error fetching appointments:', allError);
  } else {
    console.log(`Total appointments for Dr. Polina practice: ${allAppointments?.length || 0}`);
    
    // Group by doctor_id
    const byDoctor = allAppointments?.reduce((acc, apt) => {
      const key = apt.doctor_id || 'NO_DOCTOR';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nAppointments by doctor:', byDoctor);
  }
}

checkAndFixAppointments();