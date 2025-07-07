import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findUser() {
  const userId = '38261a73-0e40-45d7-a668-9676391f5b10'; // From your log
  
  console.log('\n🔍 Looking for user with ID:', userId);

  // Check users table
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error:', error);
  } else if (user) {
    console.log('\nFound user:');
    console.log('Email:', user.email);
    console.log('Full Name:', user.full_name);
    console.log('Role:', user.role);
    console.log('Practice ID:', user.practice_id);
  }

  // Check all users
  console.log('\n📋 ALL USERS IN THE SYSTEM:');
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('id, email, full_name, role, practice_id')
    .order('email');

  if (!allError && allUsers) {
    allUsers.forEach(u => {
      console.log(`  - ${u.email} (${u.full_name}) - ${u.role} [Practice: ${u.practice_id}] ${u.id === userId ? '⬅️ THIS ONE' : ''}`);
    });
  }
}

findUser().catch(console.error);