#!/usr/bin/env node

// Direct SQL execution using Supabase client
import { createClient } from '@supabase/supabase-js';

// Environment variables from .env file
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeSQL() {
  console.log('🚀 Executing SQL to add contact columns to departments table...');

  try {
    // First, let's check if the departments table exists by trying to query it
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (deptError) {
      console.error('❌ Error checking departments table:', deptError);
      return;
    }

    console.log('✅ Departments table exists');

    // Check if we have sample data to see the current structure
    if (deptData && deptData.length > 0) {
      console.log('📊 Sample department record columns:', Object.keys(deptData[0]));

      const hasContactEmail = 'contact_email' in deptData[0];
      const hasContactPhone = 'contact_phone' in deptData[0];

      if (hasContactEmail && hasContactPhone) {
        console.log('✅ Both contact_email and contact_phone columns already exist!');
        return;
      }
    } else {
      console.log('ℹ️ No sample data available to check column structure');
    }

    console.log('ℹ️ Need to add columns. Attempting to execute ALTER TABLE...');

    // Since we can't execute DDL directly with the anon key, let's try using a function
    // This would normally require a function to be created in Supabase that can execute DDL
    console.log('⚠️ Note: DDL operations require service role key or database function.');
    console.log('📝 SQL that needs to be executed:');
    console.log('ALTER TABLE departments');
    console.log('ADD COLUMN IF NOT EXISTS contact_email TEXT,');
    console.log('ADD COLUMN IF NOT EXISTS contact_phone TEXT;');

    console.log('\n🔧 Please execute this SQL directly in Supabase Dashboard > SQL Editor');
    console.log('🌐 URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the function
executeSQL().then(() => {
  console.log('🏁 Script completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});