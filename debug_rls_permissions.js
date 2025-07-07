import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRLSPermissions() {
  console.log('\n🔐 DEBUG: RLS Permissions\n');

  // Test direct table access
  console.log('1️⃣ Testing direct table access...');
  
  try {
    // Test users table
    const { data: users, error: usersError, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    console.log('Users table:');
    console.log('  Error:', usersError);
    console.log('  Count:', count);
    console.log('  Data length:', users?.length || 0);
    
    if (users && users.length > 0) {
      console.log('  Sample user:', {
        email: users[0].email,
        practice_id: users[0].practice_id,
        role: users[0].role
      });
    }
  } catch (err) {
    console.error('Users table error:', err);
  }

  try {
    // Test appointments table
    const { data: appointments, error: apptError, count: apptCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' });
    
    console.log('\nAppointments table:');
    console.log('  Error:', apptError);
    console.log('  Count:', apptCount);
    console.log('  Data length:', appointments?.length || 0);
    
    if (appointments && appointments.length > 0) {
      console.log('  Sample appointment:', {
        id: appointments[0].id,
        doctor_id: appointments[0].doctor_id,
        date: appointments[0].date
      });
    }
  } catch (err) {
    console.error('Appointments table error:', err);
  }

  try {
    // Test patients table
    const { data: patients, error: patientsError, count: patientCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact' });
    
    console.log('\nPatients table:');
    console.log('  Error:', patientsError);
    console.log('  Count:', patientCount);
    console.log('  Data length:', patients?.length || 0);
    
    if (patients && patients.length > 0) {
      console.log('  Sample patient:', {
        first_name: patients[0].first_name,
        last_name: patients[0].last_name,
        id: patients[0].id
      });
    }
  } catch (err) {
    console.error('Patients table error:', err);
  }

  // Test with auth simulation
  console.log('\n2️⃣ Testing with simulated auth...');
  
  // Try to set a user context (this won't work with anon key but let's see)
  try {
    const { data: authTest, error: authError } = await supabase.auth.getUser();
    console.log('Auth test:', { data: authTest, error: authError });
  } catch (err) {
    console.log('Auth test failed (expected):', err.message);
  }
}

debugRLSPermissions().catch(console.error);