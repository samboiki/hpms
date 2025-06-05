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

async function createOneHealthAdminUsers() {
  console.log('🏥 Creating OneHealth Admin Users (bolt.new method)\\n');
  
  const adminUsers = [
    {
      email: 'admin@onehealth.na',
      password: 'OneHealth2025!',
      userData: {
        first_name: 'OneHealth',
        last_name: 'Administrator',
        role: 'super_admin',
        practice_id: null // Super admin across all practices
      }
    },
    {
      email: 'manager@onehealth.na',
      password: 'Manager2025!',
      userData: {
        first_name: 'Practice',
        last_name: 'Manager',
        role: 'admin',
        practice_id: null
      }
    }
  ];
  
  try {
    for (const admin of adminUsers) {
      console.log(`👤 Creating user: ${admin.email}`);
      
      // Create auth user using service role (bypasses RLS)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
        user_metadata: admin.userData
      });
      
      if (authError) {
        console.error(`❌ Error creating auth user ${admin.email}:`, authError.message);
        continue;
      }
      
      console.log(`✅ Auth user created: ${authUser.user.id}`);
      
      // Create profile in users table using service role
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: admin.email,
          first_name: admin.userData.first_name,
          last_name: admin.userData.last_name,
          role: admin.userData.role,
          practice_id: admin.userData.practice_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error(`❌ Error creating profile for ${admin.email}:`, profileError.message);
      } else {
        console.log(`✅ Profile created for ${admin.email}`);
      }
      
      console.log('');
    }
    
    console.log('🎉 OneHealth Admin Users Created!\\n');
    console.log('📋 Login Credentials:');
    console.log('');
    
    adminUsers.forEach(admin => {
      console.log(`🔐 ${admin.userData.first_name} ${admin.userData.last_name} (${admin.userData.role})`);
      console.log(`   • Email: ${admin.email}`);
      console.log(`   • Password: ${admin.password}`);
      console.log('');
    });
    
    console.log('🌐 OneHealth Access URLs:');
    console.log('   • Landing Page: http://localhost:3002');
    console.log('   • Login Page: http://localhost:3002/auth/login');
    console.log('   • Dashboard: http://localhost:3002/dashboard');
    console.log('   • Practices: http://localhost:3002/dashboard/practices');
    console.log('');
    console.log('🚀 SUCCESS: OneHealth admin users created using bolt.new-style service role access!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

createOneHealthAdminUsers().catch(console.error);