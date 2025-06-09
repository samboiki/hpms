#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkPracticeTariffsColumns() {
  console.log('🔍 Checking practice_tariffs table columns...\n');
  
  try {
    // Get a sample record to see all available columns
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .not('price', 'is', null)
      .limit(1);
    
    if (tariffsError) {
      console.log('❌ Error:', tariffsError.message);
      return;
    }
    
    if (tariffs && tariffs.length > 0) {
      console.log('✅ Found practice_tariffs record');
      console.log('📋 Available columns:');
      
      const record = tariffs[0];
      Object.keys(record).forEach(key => {
        const value = record[key];
        const type = typeof value;
        const displayValue = value === null ? 'null' : 
                           type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' :
                           value;
        console.log(`   • ${key}: ${displayValue} (${type})`);
      });
      
      // Test different possible description column names
      console.log('\n🔍 Testing description fields...');
      const possibleDescFields = ['description', 'namaf_prace_2025', 'name', 'title', 'service_name'];
      
      for (const field of possibleDescFields) {
        if (record[field] !== undefined) {
          console.log(`✅ ${field}: "${record[field]}"`);
        } else {
          console.log(`❌ ${field}: not found`);
        }
      }
      
      // Get a few more records with key fields for billing
      console.log('\n📋 Sample records for billing:');
      const { data: sampleTariffs } = await supabase
        .from('practice_tariffs')
        .select('id, code, description, price')
        .not('price', 'is', null)
        .limit(5);
      
      if (sampleTariffs) {
        sampleTariffs.forEach((tariff, i) => {
          console.log(`   ${i+1}. ${tariff.code}: ${tariff.description || 'No description'} - N$${tariff.price}`);
        });
      }
      
    } else {
      console.log('❌ No records found in practice_tariffs');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkPracticeTariffsColumns().catch(console.error);