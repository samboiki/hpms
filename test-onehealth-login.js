import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create clients
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testAuthentication() {
  console.log('🔍 Testing OneHealth Portal Authentication\n');
  console.log('=' .repeat(50));

  // 1. Check if users exist in auth.users
  console.log('\n1️⃣ Checking auth.users table:');
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error fetching auth users:', authError.message);
  } else {
    console.log(`✅ Found ${authUsers.users.length} users in auth.users`);
    if (authUsers.users.length > 0) {
      console.log('\nFirst 3 users:');
      authUsers.users.slice(0, 3).forEach(user => {
        console.log(`  - ${user.email} (Created: ${new Date(user.created_at).toLocaleDateString()})`);
      });
    }
  }

  // 2. Check users table
  console.log('\n2️⃣ Checking users table:');
  const { data: dbUsers, error: dbError } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .limit(5);

  if (dbError) {
    console.error('❌ Error fetching users from database:', dbError.message);
  } else {
    console.log(`✅ Found ${dbUsers.length} users in users table`);
    if (dbUsers.length > 0) {
      console.log('\nSample users:');
      dbUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - Practice: ${user.practice_id || 'None'}`);
      });
    }
  }

  // 3. Check user_profiles table (used by OneHealth)
  console.log('\n3️⃣ Checking user_profiles table:');
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .limit(5);

  if (profileError) {
    console.error('⚠️  user_profiles table not found or error:', profileError.message);
    console.log('   This table might be needed for OneHealth portal');
  } else {
    console.log(`✅ Found ${profiles.length} profiles in user_profiles table`);
  }

  // 4. Create a test doctor user if needed
  console.log('\n4️⃣ Creating test doctor user:');
  const testEmail = 'doctor@onehealth.test';
  const testPassword = 'OneHealth2025!';

  // Check if user exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single();

  if (existingUser) {
    console.log(`ℹ️  Test user already exists: ${testEmail}`);
  } else {
    // Create auth user
    const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Doctor',
        role: 'doctor'
      }
    });

    if (createAuthError) {
      console.error('❌ Error creating auth user:', createAuthError.message);
    } else {
      console.log('✅ Created auth user:', testEmail);

      // Create database user
      const { error: dbCreateError } = await supabaseAdmin
        .from('users')
        .insert({
          id: newAuthUser.user.id,
          email: testEmail,
          full_name: 'Test Doctor',
          role: 'doctor',
          is_active: true
        });

      if (dbCreateError) {
        console.error('❌ Error creating database user:', dbCreateError.message);
      } else {
        console.log('✅ Created database user record');
      }
    }
  }

  // 5. Test login
  console.log('\n5️⃣ Testing login:');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
    console.log('\n🔧 Troubleshooting suggestions:');
    console.log('   1. Check if the user exists in both auth.users and users table');
    console.log('   2. Verify the password is correct');
    console.log('   3. Check if the user account is confirmed');
    console.log('   4. Ensure RLS policies allow the login');
  } else {
    console.log('✅ Login successful!');
    console.log('   User ID:', loginData.user.id);
    console.log('   Session token received');
  }

  // 6. Check RLS policies
  console.log('\n6️⃣ Checking RLS policies:');
  const { data: policies, error: policyError } = await supabaseAdmin
    .rpc('get_policies', { table_name: 'users' })
    .catch(() => null);

  if (policies) {
    console.log('✅ RLS policies found for users table');
  } else {
    console.log('⚠️  Could not check RLS policies (may need custom function)');
  }

  console.log('\n' + '=' .repeat(50));
  console.log('📊 Summary:');
  console.log('   OneHealth portal is accessible at: http://localhost:4000');
  console.log('   Login page: http://localhost:4000/auth/login');
  console.log(`   Test credentials: ${testEmail} / ${testPassword}`);
  console.log('\n✨ Testing complete!');
}

// Run the test
testAuthentication().catch(console.error);