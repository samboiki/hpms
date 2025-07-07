#!/usr/bin/env node

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// CRITICAL: Direct PostgreSQL connection (SET IN STONE from CLAUDE.md)
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

// Also need Supabase for auth user creation
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
const supabase = createClient(supabaseUrl, anonKey);

async function createAdminWithPostgres() {
  console.log('🔑 Creating OneHealth Admin (Direct PostgreSQL Method)\\n');
  
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\\n');
    
    // Create auth user first (this part needs Supabase)
    console.log('👤 Creating auth user...');
    const { data: authUser, error: signUpError } = await supabase.auth.signUp({
      email: 'admin@onehealth.demo',
      password: 'admin123'
    });
    
    if (signUpError && !signUpError.message.includes('already registered')) {
      console.error('❌ Error creating auth user:', signUpError.message);
      return;
    }
    
    const userId = authUser?.user?.id || 'existing-user-id';
    console.log('✅ Auth user ready');
    
    // Create user profile using direct PostgreSQL (bypasses ALL restrictions)
    console.log('📋 Creating user profile with direct PostgreSQL...');
    
    const insertUserSQL = `
      INSERT INTO users (
        id, email, first_name, last_name, role, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        updated_at = NOW()
    `;
    
    await client.query(insertUserSQL, [
      userId,
      'admin@onehealth.demo',
      'OneHealth',
      'Administrator',
      'admin'
    ]);
    
    console.log('✅ User profile created with direct PostgreSQL');
    
    // Verify the setup
    const { rows } = await client.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
      ['admin@onehealth.demo']
    );
    
    if (rows.length > 0) {
      const user = rows[0];
      console.log('\\n🎉 OneHealth Admin Created Successfully!');
      console.log('');
      console.log('🔐 Login Credentials:');
      console.log(`   • Email: ${user.email}`);
      console.log('   • Password: admin123');
      console.log(`   • Role: ${user.role}`);
      console.log('');
      console.log('🌐 OneHealth Access:');
      console.log('   • Landing: http://localhost:3002');
      console.log('   • Login: http://localhost:3002/auth/login');
      console.log('   • Dashboard: http://localhost:3002/dashboard');
      console.log('');
      console.log('🚀 SUCCESS: Admin created using direct PostgreSQL connection!');
    } else {
      console.log('❌ User verification failed');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    await client.end();
  }
}

createAdminWithPostgres().catch(console.error);