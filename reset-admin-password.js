#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// CRITICAL: Always use service role for database operations (from CLAUDE.md)
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminPassword() {
  console.log('🔑 Resetting OneHealth Admin Password (bolt.new method)\\n');
  
  try {
    // Get the admin user ID
    const { data: users, error: getUserError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', 'admin@onehealth.na')
      .single();
    
    if (getUserError || !users) {
      console.log('⚠️  OneHealth admin not found, trying alternative...');
      
      // Try with general admin
      const { data: altUsers, error: altError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('email', 'admin@example.com')
        .single();
      
      if (altError || !altUsers) {
        console.log('❌ No admin users found');
        return;
      }
      
      const { error: resetError } = await supabase.auth.admin.updateUserById(altUsers.id, {
        password: 'admin123'
      });
      
      if (resetError) {
        console.error('❌ Error resetting password:', resetError.message);
      } else {
        console.log('✅ Password reset successful!');
        console.log('');
        console.log('🔐 OneHealth Admin Login:');
        console.log(`   • Email: ${altUsers.email}`);
        console.log('   • Password: admin123');
        console.log('');
        console.log('🌐 Access OneHealth at: http://localhost:3002/auth/login');
      }
      
    } else {
      // Reset OneHealth admin password
      const { error: resetError } = await supabase.auth.admin.updateUserById(users.id, {
        password: 'OneHealth2025!'
      });
      
      if (resetError) {
        console.error('❌ Error resetting password:', resetError.message);
      } else {
        console.log('✅ Password reset successful!');
        console.log('');
        console.log('🔐 OneHealth Admin Login:');
        console.log(`   • Email: ${users.email}`);
        console.log('   • Password: OneHealth2025!');
        console.log('');
        console.log('🌐 Access OneHealth at: http://localhost:3002/auth/login');
      }
    }
    
  } catch (error) {
    console.error('❌ Password reset failed:', error.message);
  }
}

resetAdminPassword().catch(console.error);