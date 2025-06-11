import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkUserSchema() {
  try {
    // Login first
    await supabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });
    
    // Check users table schema
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error querying users table:', error);
    } else {
      console.log('✅ Users table accessible');
      if (data && data.length > 0) {
        console.log('Available columns:', Object.keys(data[0]).join(', '));
        console.log('Sample user data:', data[0]);
      } else {
        console.log('No users found in table');
      }
    }
    
    // Also check auth.users
    const { data: authUser } = await supabase.auth.getUser();
    console.log('\n✅ Auth user structure:');
    console.log('User ID:', authUser.user?.id);
    console.log('Email:', authUser.user?.email);
    console.log('Available auth user fields:', Object.keys(authUser.user || {}));
    
  } catch (err) {
    console.error('Connection error:', err);
  }
}

checkUserSchema();