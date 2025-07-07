#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableStructure() {
  console.log('🔍 CHECKING PRACTICE_TARIFFS TABLE STRUCTURE...\n');
  
  try {
    // Check if table exists and get sample data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error accessing table:', sampleError.message);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('📋 CURRENT TABLE STRUCTURE (from sample row):');
      const columns = Object.keys(sampleData[0]);
      columns.forEach(col => {
        const value = sampleData[0][col];
        const type = typeof value;
        console.log(`   • ${col}: ${type} = ${value}`);
      });
    } else {
      console.log('📋 Table exists but is empty');
    }
    
    // Try to get table info using raw SQL
    console.log('\n🔍 Trying to get column information...');
    
    // Use a simple query to check what's needed
    const { data: testInsert, error: testError } = await supabase
      .from('practice_tariffs')
      .insert({
        practice_id: 'e0716e54-f808-4905-a1f8-85090dd3d9e2',
        code: 9999,
        description: 'Test entry',
        // Try with minimal required fields first
      })
      .select();
    
    if (testError) {
      console.log('❌ Test insert error reveals required fields:');
      console.log(testError.message);
      console.log('Error code:', testError.code);
      console.log('Error details:', testError.details);
    } else {
      console.log('✅ Test insert successful - cleaning up...');
      await supabase
        .from('practice_tariffs')
        .delete()
        .eq('code', 9999);
    }
    
  } catch (error) {
    console.error('❌ Failed to check table structure:', error.message);
  }
}

checkTableStructure();