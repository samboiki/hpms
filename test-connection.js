import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0MTA0MTcsImV4cCI6MjA0Njk4NjQxN30.xI_EgYOIxU_VfPkHeyQcmvdTEKdLs3y1AgbIqVPQzLU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Test if we can reach the database
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Database error:', error);
    } else {
      console.log('✅ Database connection successful!');
      console.log('Found patients:', data?.length || 0);
    }

    // Check auth status
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('✅ User is authenticated:', session.user.email);
    } else {
      console.log('❌ No active session - you need to log in');
    }
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testConnection();