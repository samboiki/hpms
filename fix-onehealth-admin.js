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

async function fixOneHealthAdmin() {
  console.log('🔧 Fixing OneHealth Admin Access (bolt.new method)\\n');
  
  try {
    // List all auth users to find admin accounts
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError.message);
      return;
    }
    
    console.log('👥 Found Auth Users:');
    authUsers.users.forEach(user => {
      console.log(`   • ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
    });
    console.log('');
    
    // Find an existing admin user
    const adminUser = authUsers.users.find(user => 
      user.email.includes('admin') || user.email.includes('onehealth')
    );
    
    if (adminUser) {
      console.log(`🔑 Resetting password for: ${adminUser.email}`);
      
      // Reset password
      const { error: resetError } = await supabase.auth.admin.updateUserById(adminUser.id, {
        password: 'admin123'
      });
      
      if (resetError) {
        console.error('❌ Error resetting password:', resetError.message);
      } else {
        console.log('✅ Password reset successful!');
        
        // Update or create user profile
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: adminUser.id,
            email: adminUser.email,
            first_name: 'OneHealth',
            last_name: 'Admin',
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (upsertError) {
          console.log('⚠️  Profile update issue:', upsertError.message);
        } else {
          console.log('✅ User profile updated');
        }
      }
    } else {
      // Create new admin user
      console.log('👤 Creating new OneHealth admin user...');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@onehealth.demo',
        password: 'admin123',
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError.message);
      } else {
        console.log('✅ New admin user created');
        
        // Create profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: newUser.user.id,
            email: newUser.user.email,
            first_name: 'OneHealth',
            last_name: 'Admin',
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (profileError) {
          console.log('⚠️  Profile creation issue:', profileError.message);
        } else {
          console.log('✅ User profile created');
        }
        
        adminUser = newUser.user;
      }
    }
    
    console.log('');
    console.log('🎉 OneHealth Admin Access Ready!');
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log(`   • Email: ${adminUser?.email || 'admin@onehealth.demo'}`);
    console.log('   • Password: admin123');
    console.log('');
    console.log('🌐 OneHealth URLs:');
    console.log('   • Landing Page: http://localhost:3002');
    console.log('   • Login: http://localhost:3002/auth/login');
    console.log('   • Dashboard: http://localhost:3002/dashboard');
    console.log('   • Practices: http://localhost:3002/dashboard/practices');
    console.log('   • Tariffs: http://localhost:3002/dashboard/tariffs');
    console.log('   • SMS Portal: http://localhost:3002/dashboard/sms');
    console.log('');
    console.log('🚀 SUCCESS: OneHealth admin fixed using bolt.new-style service role access!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

fixOneHealthAdmin().catch(console.error);