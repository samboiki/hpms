import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createDrPolinaUsers() {
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  
  console.log('\n🏥 Creating Dr. Polina Practice Users\n');

  // Create admin user
  const adminUser = {
    id: '38261a73-0e40-45d7-a668-9676391f5b10',
    email: 'admin@drpolina.com',
    full_name: 'Admin User',
    role: 'admin',
    practice_id: practiceId,
    avatar: null,
    last_login: new Date().toISOString()
  };

  console.log('1️⃣ Creating admin user...');
  const { error: adminError } = await supabase
    .from('users')
    .insert([adminUser]);

  if (adminError) {
    console.error('Error creating admin:', adminError);
  } else {
    console.log('✅ Created admin@drpolina.com');
  }

  // Create Dr. Polina (doctor)
  const doctorUser = {
    id: 'b7c4d5e6-f7a8-49b0-8c1d-2e3f4a5b6c7d',
    email: 'polina@drpolinaaesthetics.com',
    full_name: 'Dr. Polina Aesthetics',
    role: 'doctor',
    practice_id: practiceId,
    avatar: null
  };

  console.log('\n2️⃣ Creating doctor user...');
  const { error: doctorError } = await supabase
    .from('users')
    .insert([doctorUser]);

  if (doctorError) {
    console.error('Error creating doctor:', doctorError);
  } else {
    console.log('✅ Created Dr. Polina (doctor)');
  }

  // Verify
  console.log('\n3️⃣ Verifying users in Dr. Polina practice...');
  const { data: users, error: verifyError } = await supabase
    .from('users')
    .select('*')
    .eq('practice_id', practiceId);

  if (!verifyError && users) {
    console.log(`\nFound ${users.length} users in Dr. Polina practice:`);
    users.forEach(user => {
      console.log(`  - ${user.full_name} (${user.email}) - ${user.role}`);
    });
  }
}

createDrPolinaUsers().catch(console.error);