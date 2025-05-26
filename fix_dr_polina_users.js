import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixDrPolinaUsers() {
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  console.log('\n🔧 FIXING DR. POLINA PRACTICE USERS\n');

  // 1. Find the admin@drpolina.com user
  console.log('1️⃣ Looking for admin@drpolina.com user...');
  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'admin@drpolina.com')
    .single();

  if (adminError) {
    console.error('Error finding admin user:', adminError);
  } else if (adminUser) {
    console.log('Found admin user:', {
      id: adminUser.id,
      email: adminUser.email,
      full_name: adminUser.full_name,
      current_practice_id: adminUser.practice_id
    });

    // Update if needed
    if (adminUser.practice_id !== practiceId) {
      console.log('⚠️ User has wrong practice_id! Updating...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ practice_id: practiceId })
        .eq('id', adminUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
      } else {
        console.log('✅ Updated admin user to Dr. Polina practice');
      }
    } else {
      console.log('✅ User already has correct practice_id');
    }
  }

  // 2. Check all users that might belong to Dr. Polina
  console.log('\n2️⃣ Looking for all Dr. Polina related users...');
  const { data: drPolinaUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .or('email.ilike.%drpolina%,email.ilike.%polina%');

  if (!usersError && drPolinaUsers) {
    console.log(`Found ${drPolinaUsers.length} potential Dr. Polina users:`);
    drPolinaUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.full_name}) - ${user.role} [Practice: ${user.practice_id}]`);
    });
  }

  // 3. Check what practices exist
  console.log('\n3️⃣ Checking all practices...');
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('id, name, slug');

  if (!practicesError && practices) {
    console.log('All practices:');
    practices.forEach(p => {
      console.log(`  - ${p.name} (${p.slug}) [ID: ${p.id}]`);
    });
  }

  // 4. Count users per practice
  console.log('\n4️⃣ Users per practice:');
  const { data: userCounts, error: countError } = await supabase
    .from('users')
    .select('practice_id, full_name')
    .order('practice_id');

  if (!countError && userCounts) {
    const practiceUserCounts = {};
    userCounts.forEach(user => {
      const pid = user.practice_id || 'NO_PRACTICE';
      practiceUserCounts[pid] = (practiceUserCounts[pid] || 0) + 1;
    });

    Object.entries(practiceUserCounts).forEach(([pid, count]) => {
      console.log(`  Practice ${pid}: ${count} users`);
    });
  }

  // 5. Create a test doctor for Dr. Polina if none exists
  console.log('\n5️⃣ Checking if Dr. Polina practice has a doctor...');
  const { data: doctors, error: doctorsError } = await supabase
    .from('users')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('role', 'doctor');

  if (!doctorsError) {
    if (doctors.length === 0) {
      console.log('❌ No doctors found for Dr. Polina practice!');
      console.log('Please create a doctor user for this practice.');
    } else {
      console.log(`✅ Found ${doctors.length} doctor(s) in Dr. Polina practice`);
    }
  }
}

fixDrPolinaUsers().catch(console.error);