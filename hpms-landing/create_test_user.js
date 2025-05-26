// Script to create a test user using Supabase Admin API
// This bypasses all the SQL complexity and uses the proper API

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // You need to add this

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    // 1. Get Dr. Polina practice
    const { data: practice, error: practiceError } = await supabase
      .from('practices')
      .select('id')
      .eq('slug', 'dr-polina-aesthetics')
      .single();

    if (practiceError) {
      console.error('Error finding practice:', practiceError);
      return;
    }

    console.log('Found practice:', practice.id);

    // 2. Create user in auth.users using Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'test.admin@drpolina.com',
      password: 'testadmin123',
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Admin',
        role: 'admin',
        practice_id: practice.id
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Created auth user:', authUser.user.id);

    // 3. Create corresponding users table entry
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'test.admin@drpolina.com',
        full_name: 'Test Admin',
        role: 'admin',
        practice_id: practice.id
      });

    if (userError) {
      console.error('Error creating user profile:', userError);
      return;
    }

    console.log('Success! User created:');
    console.log('Email: test.admin@drpolina.com');
    console.log('Password: testadmin123');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run it
createTestUser();