#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 SERVICE ROLE CONFIGURATION
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableStructure() {
  console.log('🔍 CHECKING PRACTICE_TARIFFS TABLE STRUCTURE\n');
  
  try {
    // Get a sample record to see available columns
    const { data: sampleRecord, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      throw new Error(`Failed to fetch sample: ${sampleError.message}`);
    }
    
    if (sampleRecord && sampleRecord.length > 0) {
      console.log('📋 Available columns:');
      const columns = Object.keys(sampleRecord[0]);
      columns.forEach(col => {
        const value = sampleRecord[0][col];
        const type = typeof value;
        console.log(`   • ${col}: ${type} (example: ${value})`);
      });
      
      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(sampleRecord[0], null, 2));
    } else {
      console.log('❌ No records found in practice_tariffs table');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

// Execute check
try {
  await checkTableStructure();
} catch (error) {
  console.error('Script error:', error.message);
}