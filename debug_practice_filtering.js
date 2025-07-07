import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugPracticeFiltering() {
  const drPolinaPracticeId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  console.log('\n🔍 DEBUG: Practice Filtering Issues\n');

  // 1. Check Dr. Polina users
  console.log('1️⃣ Dr. Polina Practice Users:');
  console.log('================================');
  const { data: drPolinaUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .eq('practice_id', drPolinaPracticeId);

  if (usersError) {
    console.error('Error:', usersError);
  } else {
    console.log(`Found ${drPolinaUsers.length} users:`);
    drPolinaUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) [ID: ${user.id}]`);
    });
  }

  // 2. Check appointments for Dr. Polina doctors
  console.log('\n2️⃣ Appointments for Dr. Polina Doctors:');
  console.log('================================');
  if (drPolinaUsers && drPolinaUsers.length > 0) {
    const drPolinaDoctorIds = drPolinaUsers.filter(u => u.role === 'doctor').map(u => u.id);
    console.log('Dr. Polina doctor IDs:', drPolinaDoctorIds);

    if (drPolinaDoctorIds.length > 0) {
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          time,
          doctor_id,
          patient_id,
          patient:patients(first_name, last_name),
          doctor:users(full_name, practice_id)
        `)
        .in('doctor_id', drPolinaDoctorIds);

      if (apptError) {
        console.error('Appointments error:', apptError);
      } else {
        console.log(`Found ${appointments.length} appointments for Dr. Polina doctors`);
        appointments.forEach(apt => {
          console.log(`  - ${apt.date}: Patient ${apt.patient?.first_name} ${apt.patient?.last_name} with doctor ${apt.doctor?.full_name}`);
        });
      }
    } else {
      console.log('No doctors found in Dr. Polina practice');
    }
  }

  // 3. Check ALL appointments and their doctor's practice
  console.log('\n3️⃣ ALL Appointments with Doctor Practice Info:');
  console.log('================================');
  const { data: allAppointments, error: allApptError } = await supabase
    .from('appointments')
    .select(`
      id,
      date,
      doctor_id,
      patient:patients(first_name, last_name),
      doctor:users(full_name, email, practice_id)
    `)
    .order('date', { ascending: false })
    .limit(10);

  if (!allApptError && allAppointments) {
    console.log(`Found ${allAppointments.length} recent appointments:`);
    allAppointments.forEach(apt => {
      const practiceMatch = apt.doctor?.practice_id === drPolinaPracticeId ? '✅ DR POLINA' : '❌ OTHER';
      console.log(`  - ${apt.date}: ${apt.patient?.first_name} ${apt.patient?.last_name} with ${apt.doctor?.full_name} (${apt.doctor?.email}) - Practice: ${apt.doctor?.practice_id} ${practiceMatch}`);
    });
  }

  // 4. Check patients with appointments
  console.log('\n4️⃣ Patients with Appointments:');
  console.log('================================');
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .limit(10);

  if (!patientsError && patients) {
    console.log(`Found ${patients.length} patients in database`);
    patients.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} [ID: ${p.id}]`);
    });
  }

  // 5. Check if filtering is working
  console.log('\n5️⃣ Testing Filter Logic:');
  console.log('================================');
  if (allAppointments) {
    const filteredByPractice = allAppointments.filter(apt => 
      apt.doctor?.practice_id === drPolinaPracticeId
    );
    console.log(`Total appointments: ${allAppointments.length}`);
    console.log(`Filtered for Dr. Polina practice: ${filteredByPractice.length}`);
    
    if (filteredByPractice.length > 0) {
      console.log('Filtered appointments:');
      filteredByPractice.forEach(apt => {
        console.log(`  - ${apt.date}: ${apt.patient?.first_name} ${apt.patient?.last_name}`);
      });
    }
  }
}

debugPracticeFiltering().catch(console.error);