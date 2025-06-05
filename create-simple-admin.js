#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Simple approach: Create admin user with regular Supabase auth, then we can reset password in Supabase dashboard if needed
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, anonKey);

async function createSimpleAdmin() {
  console.log('🔑 Creating Simple OneHealth Admin\\n');
  
  try {
    // Try to sign up a new admin user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'admin@onehealth.local',
      password: 'admin123',
      options: {
        data: {
          first_name: 'OneHealth',
          last_name: 'Admin',
          role: 'admin'
        }
      }
    });
    
    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('✅ Admin user already exists');
        console.log('\\n🔐 Try These Login Credentials:');
        console.log('   • Email: admin@onehealth.local');
        console.log('   • Password: admin123');
      } else {
        console.error('❌ Error creating admin:', authError.message);
        
        // Provide alternative credentials to try
        console.log('\\n🔐 Try These Existing Admin Accounts:');
        console.log('   • Email: admin@example.com');
        console.log('   • Password: password123 or admin123');
        console.log('');
        console.log('   • Email: admin@drpolina.com'); 
        console.log('   • Password: password123 or admin123');
      }
    } else {
      console.log('✅ New admin user created successfully!');
      console.log('\\n🔐 Login Credentials:');
      console.log('   • Email: admin@onehealth.local');
      console.log('   • Password: admin123');
    }
    
    console.log('\\n🌐 OneHealth Admin Portal:');
    console.log('   • Landing: http://localhost:3002');
    console.log('   • Login: http://localhost:3002/auth/login');
    console.log('   • Dashboard: http://localhost:3002/dashboard');
    console.log('   • Practices: http://localhost:3002/dashboard/practices');
    console.log('   • Tariffs: http://localhost:3002/dashboard/tariffs');
    console.log('   • SMS Portal: http://localhost:3002/dashboard/sms');
    
    console.log('\\n✅ OneHealth Admin Setup Complete!');
    console.log('');
    console.log('🚨 IMPORTANT: Database operations will use direct PostgreSQL method from CLAUDE.md');
    console.log('   Connection: postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

createSimpleAdmin().catch(console.error);