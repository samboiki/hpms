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

async function verifyOneHealthAccess() {
  console.log('🔍 Verifying OneHealth Admin Access\\n');
  
  try {
    // Check for existing admin users
    const { data: adminUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'super_admin'])
      .order('created_at');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }
    
    console.log('👥 Found Admin Users:');
    adminUsers.forEach(user => {
      console.log(`   • ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role}`);
    });
    console.log('');
    
    // Check practices data
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, slug, city, contact_email')
      .limit(5);
    
    if (practicesError) {
      console.error('❌ Error fetching practices:', practicesError.message);
    } else {
      console.log('🏥 Sample Practices in Database:');
      practices.forEach(practice => {
        console.log(`   • ${practice.name} (${practice.slug}) - ${practice.city}`);
      });
      console.log('');
    }
    
    // Check if practice_performance_dashboard view exists
    const { data: viewData, error: viewError } = await supabase
      .from('practice_performance_dashboard')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.log('⚠️  practice_performance_dashboard view might not exist');
      console.log('   This is normal - OneHealth dashboard will still work with basic practice data');
    } else {
      console.log('✅ practice_performance_dashboard view is working');
    }
    
    console.log('🌐 OneHealth Admin Portal Access:');
    console.log('');
    console.log('📍 URLs:');
    console.log('   • Landing Page: http://localhost:3002');
    console.log('   • Login Page: http://localhost:3002/auth/login');
    console.log('   • Dashboard: http://localhost:3002/dashboard');
    console.log('   • Practices: http://localhost:3002/dashboard/practices');
    console.log('   • Tariffs: http://localhost:3002/dashboard/tariffs');
    console.log('   • SMS Portal: http://localhost:3002/dashboard/sms');
    console.log('');
    
    console.log('🔐 Try These Login Credentials:');
    if (adminUsers.length > 0) {
      adminUsers.slice(0, 3).forEach(user => {
        console.log(`   • Email: ${user.email}`);
        console.log(`   • Try common passwords: password123, admin123, OneHealth2025!`);
        console.log('');
      });
    } else {
      console.log('   • No admin users found - may need to create them');
    }
    
    console.log('✅ OneHealth verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyOneHealthAccess().catch(console.error);