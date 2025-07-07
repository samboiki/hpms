#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTriggerStatus() {
  try {
    console.log('🔍 CHECKING AUTO-FIX TRIGGER STATUS');
    console.log('===================================\n');
    
    // Check if triggers exist
    console.log('📋 Checking for auto-fix triggers...');
    
    const { data: triggers, error: triggerError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          trigger_name,
          event_manipulation,
          action_timing,
          event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'invoice_services'
        ORDER BY trigger_name;
      `
    });
    
    if (triggerError) {
      console.log('⚠️ Cannot check triggers directly, trying alternative method...');
      console.log('This might mean RLS is blocking the query or the method is not available');
    } else {
      console.log('Found triggers on invoice_services table:', triggers);
      
      const autoFixTrigger = triggers?.find(t => t.trigger_name === 'auto_fix_medical_aid_values_trigger');
      if (autoFixTrigger) {
        console.log('✅ AUTO-FIX TRIGGER FOUND:', autoFixTrigger);
      } else {
        console.log('❌ AUTO-FIX TRIGGER NOT FOUND');
        console.log('Available triggers:', triggers?.map(t => t.trigger_name));
      }
    }
    
    // Let's test the most recent invoice that failed
    console.log('\n🔍 Checking the most recent failed invoice (INV250694292)...');
    
    const { data: recentServices, error: servicesError } = await supabase
      .from('invoice_services')
      .select('*')
      .eq('invoice_id', 'ab9d0ea5-f01f-4433-8fa2-e8f2ed2ef4c2')
      .order('created_at', { ascending: false });
    
    if (servicesError) {
      console.error('❌ Error fetching recent services:', servicesError);
    } else {
      console.log('Recent services from failed invoice:', recentServices);
      
      recentServices?.forEach((service, i) => {
        console.log(`Service ${i+1}: ${service.code}`);
        console.log(`  Total: N$ ${service.total_price}`);
        console.log(`  Medical Aid Covered: N$ ${service.medical_aid_covered}`);
        console.log(`  Patient Portion: N$ ${service.patient_portion}`);
        
        if (service.patient_portion > 0) {
          console.log(`  ❌ PROBLEM: Medical aid patient charged N$ ${service.patient_portion}`);
        } else {
          console.log(`  ✅ CORRECT: Patient pays N$ 0.00`);
        }
      });
    }
    
    // Check Elisabeth's medical aid status in database
    console.log('\n🔍 Verifying Elisabeth\'s medical aid status...');
    
    const elisabethPatientId = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';
    
    const { data: medicalAid, error: maError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .eq('patient_id', elisabethPatientId);
    
    if (maError) {
      console.error('❌ Error checking medical aid:', maError);
    } else {
      console.log('Elisabeth medical aid status:', medicalAid);
      
      if (medicalAid && medicalAid.length > 0) {
        console.log('✅ Elisabeth HAS medical aid in database');
        console.log('Provider:', medicalAid[0].provider);
        console.log('Membership:', medicalAid[0].membership_number);
      } else {
        console.log('❌ Elisabeth has NO medical aid in database (this would be the problem)');
      }
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('The auto-fix trigger is likely not installed or not working.');
    console.log('We need to install it through Supabase SQL Editor manually.');
    console.log('\n📋 MANUAL INSTALLATION REQUIRED:');
    console.log('Execute the contents of MANUAL_AUTO_FIX_TRIGGER.sql in Supabase SQL Editor');
    
  } catch (error) {
    console.error('💥 Error checking trigger status:', error.message);
  }
}

checkTriggerStatus();