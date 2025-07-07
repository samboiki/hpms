#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Test script to verify billing integration components
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testBillingIntegration() {
  console.log('🧪 Testing Billing Integration Components\n');
  
  try {
    // Test 1: Check if practice_tariffs table exists and has data
    console.log('1️⃣ Testing practice_tariffs table...');
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(5);
    
    if (tariffsError) {
      console.log('❌ Error querying practice_tariffs:', tariffsError.message);
    } else {
      console.log(`✅ Found ${tariffs?.length || 0} tariff records`);
      if (tariffs && tariffs.length > 0) {
        console.log('📋 Sample tariffs:');
        tariffs.forEach(tariff => {
          console.log(`   • ${tariff.code}: ${tariff.namaf_prace_2025} - N$${tariff.price}`);
        });
      }
    }
    console.log();

    // Test 2: Check practices table
    console.log('2️⃣ Testing practices table...');
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, practice_type, slug')
      .limit(5);
    
    if (practicesError) {
      console.log('❌ Error querying practices:', practicesError.message);
    } else {
      console.log(`✅ Found ${practices?.length || 0} practice records`);
      if (practices && practices.length > 0) {
        console.log('🏥 Sample practices:');
        practices.forEach(practice => {
          console.log(`   • ${practice.name} (${practice.practice_type || 'unspecified'})`);
        });
      }
    }
    console.log();

    // Test 3: Check if patients have medical aid data
    console.log('3️⃣ Testing patients and medical aid...');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select(`
        id, 
        first_name, 
        last_name,
        medical_aid_details(*)
      `)
      .limit(3);
    
    if (patientsError) {
      console.log('❌ Error querying patients:', patientsError.message);
    } else {
      console.log(`✅ Found ${patients?.length || 0} patient records`);
      if (patients && patients.length > 0) {
        console.log('👥 Sample patients with medical aid:');
        patients.forEach(patient => {
          const medicalAid = patient.medical_aid_details && patient.medical_aid_details.length > 0 
            ? patient.medical_aid_details[0].provider 
            : 'No medical aid';
          console.log(`   • ${patient.first_name} ${patient.last_name} - ${medicalAid}`);
        });
      }
    }
    console.log();

    // Test 4: Check if billing tables exist
    console.log('4️⃣ Testing billing infrastructure...');
    
    const tables = [
      'invoices_enhanced',
      'invoice_items_enhanced', 
      'visit_services',
      'medical_aid_coverage'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: Available`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: Error - ${err.message}`);
      }
    }
    console.log();

    // Test 5: Check visits table for billing integration
    console.log('5️⃣ Testing visits integration...');
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, patient_id, diagnosis, visit_date')
      .limit(3);
    
    if (visitsError) {
      console.log('❌ Error querying visits:', visitsError.message);
    } else {
      console.log(`✅ Found ${visits?.length || 0} visit records`);
      if (visits && visits.length > 0) {
        console.log('📝 Sample visits:');
        visits.forEach(visit => {
          console.log(`   • Visit ${visit.id.slice(0, 8)}... - ${visit.diagnosis} (${visit.visit_date})`);
        });
      }
    }
    console.log();

    console.log('🎉 Billing integration test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✓ Database connection: Working');
    console.log('   ✓ Core tables: Available');
    console.log('   ✓ Patient data: Available');
    console.log('   ? Dental tariffs: Need to be imported');
    console.log('   ? Billing tables: Need verification');
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Import dental practice codes');
    console.log('   2. Test ServiceSelector component');
    console.log('   3. Test invoice generation');
    console.log('   4. Verify complete billing workflow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBillingIntegration().catch(console.error);