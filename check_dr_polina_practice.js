import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDrPolinaPractice() {
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  console.log('\n🏥 Checking Dr. Polina Practice (ID:', practiceId, ')\n');

  // 1. Check users in this practice
  console.log('1️⃣ USERS IN THIS PRACTICE:');
  console.log('================================');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('practice_id', practiceId);

  if (usersError) {
    console.error('Error fetching users:', usersError);
  } else {
    console.log('Found', users.length, 'users:');
    users.forEach(user => {
      console.log(`  - ${user.full_name} (${user.email}) - ${user.role} [ID: ${user.id}]`);
    });
  }

  // 2. Check appointments for these doctors
  console.log('\n2️⃣ APPOINTMENTS FOR THESE DOCTORS:');
  console.log('================================');
  
  if (users && users.length > 0) {
    const doctorIds = users.map(u => u.id);
    
    const { data: appointments, error: appointmentsError } = await supabase
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
      .in('doctor_id', doctorIds)
      .limit(10);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
    } else {
      console.log('Found', appointments.length, 'appointments:');
      appointments.forEach(apt => {
        console.log(`  - ${apt.date} ${apt.time}: Patient ${apt.patient?.first_name} ${apt.patient?.last_name} with Dr. ${apt.doctor?.full_name}`);
      });
    }
  }

  // 3. Check if appointments table has practice_id column
  console.log('\n3️⃣ CHECKING APPOINTMENTS TABLE STRUCTURE:');
  console.log('================================');
  const { data: appointmentsSample, error: sampleError } = await supabase
    .from('appointments')
    .select('*')
    .limit(1);

  if (!sampleError && appointmentsSample && appointmentsSample.length > 0) {
    const columns = Object.keys(appointmentsSample[0]);
    console.log('Appointments table columns:', columns);
    console.log('Has practice_id column?', columns.includes('practice_id') ? 'YES ✅' : 'NO ❌');
  }

  // 4. Check ALL appointments to see the problem
  console.log('\n4️⃣ CHECKING ALL APPOINTMENTS (first 20):');
  console.log('================================');
  const { data: allAppointments, error: allApptsError } = await supabase
    .from('appointments')
    .select(`
      id,
      date,
      time,
      doctor_id,
      patient:patients(first_name, last_name),
      doctor:users(full_name, email, practice_id)
    `)
    .order('date', { ascending: false })
    .limit(20);

  if (!allApptsError && allAppointments) {
    console.log('Recent appointments across ALL practices:');
    allAppointments.forEach(apt => {
      console.log(`  - ${apt.date}: ${apt.patient?.first_name} ${apt.patient?.last_name} with ${apt.doctor?.full_name} (${apt.doctor?.email}) [Practice: ${apt.doctor?.practice_id}]`);
    });
  }

  // 5. Check how many different practices have appointments
  console.log('\n5️⃣ PRACTICES WITH APPOINTMENTS:');
  console.log('================================');
  const { data: practicesWithAppts, error: practicesError } = await supabase
    .from('appointments')
    .select(`
      doctor:users(practice_id, practices(name))
    `);

  if (!practicesError && practicesWithAppts) {
    const uniquePractices = new Set();
    practicesWithAppts.forEach(apt => {
      if (apt.doctor?.practice_id) {
        uniquePractices.add(JSON.stringify({
          id: apt.doctor.practice_id,
          name: apt.doctor.practices?.name
        }));
      }
    });
    
    console.log('Found appointments from', uniquePractices.size, 'different practices:');
    Array.from(uniquePractices).forEach(p => {
      const practice = JSON.parse(p);
      console.log(`  - ${practice.name} (ID: ${practice.id})`);
    });
  }
}

checkDrPolinaPractice().catch(console.error);