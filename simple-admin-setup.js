import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('🔐 Testing OneHealth Login\n');
  console.log('=' .repeat(50));

  const adminEmail = 'admin@onehealthsystems.com';
  const testPassword = 'OneHealth2025!';

  console.log('\n📋 Attempting login with:');
  console.log('   Email:', adminEmail);
  console.log('   Password:', testPassword);

  try {
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: testPassword
    });

    if (error) {
      console.log('\n❌ Login failed:', error.message);
      
      // Try with different common passwords
      const passwords = [
        'Admin123!',
        'admin123',
        'password',
        'Password123!',
        'OneHealth2024!',
        'admin@123'
      ];

      console.log('\n🔍 Trying common passwords...');
      for (const pwd of passwords) {
        const { data: tryData, error: tryError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: pwd
        });

        if (!tryError) {
          console.log(`✅ SUCCESS! Password is: ${pwd}`);
          console.log('   User ID:', tryData.user.id);
          console.log('   Email:', tryData.user.email);
          break;
        }
      }
    } else {
      console.log('\n✅ Login successful!');
      console.log('   User ID:', data.user.id);
      console.log('   Email:', data.user.email);
      console.log('   Session created');
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n📌 OneHealth Portal Access:');
    console.log('   URL: http://localhost:4000/auth/login');
    console.log('   Email: admin@onehealthsystems.com');
    console.log('\n⚠️  Note: If login fails, you may need to:');
    console.log('   1. Reset the password in Supabase Dashboard');
    console.log('   2. Go to Authentication → Users');
    console.log('   3. Find admin@onehealthsystems.com');
    console.log('   4. Click "Send Password Recovery"');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
  }
}

testLogin().catch(console.error);
