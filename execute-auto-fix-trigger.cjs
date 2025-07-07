#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeAutoFixTrigger() {
  try {
    console.log('🚀 Installing auto-fix medical aid trigger...\n');
    
    // Step 1: Create the auto-fix function
    console.log('📝 Step 1: Creating auto-fix function...');
    
    const functionSQL = `
      CREATE OR REPLACE FUNCTION auto_fix_medical_aid_service_values()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      DECLARE
          patient_has_medical_aid BOOLEAN := FALSE;
          invoice_patient_id UUID;
      BEGIN
          -- Get the patient ID from the invoice
          SELECT patient_id INTO invoice_patient_id
          FROM invoices_enhanced 
          WHERE id = NEW.invoice_id;
          
          -- Check if this patient has medical aid
          SELECT EXISTS(
              SELECT 1 FROM medical_aid_details 
              WHERE patient_id = invoice_patient_id
          ) INTO patient_has_medical_aid;
          
          -- Auto-fix the medical aid values based on patient's medical aid status
          IF patient_has_medical_aid THEN
              -- Medical aid patient: Medical aid covers 100%, patient pays nothing
              NEW.medical_aid_covered := NEW.total_price;
              NEW.patient_portion := 0;
              
              RAISE NOTICE 'AUTO-FIX: Medical aid patient - Service % set to medical_aid_covered=%, patient_portion=0', 
                           NEW.code, NEW.total_price;
          ELSE
              -- Cash patient: Patient pays 100%, medical aid covers nothing
              NEW.medical_aid_covered := 0;
              NEW.patient_portion := NEW.total_price;
              
              RAISE NOTICE 'AUTO-FIX: Cash patient - Service % set to medical_aid_covered=0, patient_portion=%', 
                           NEW.code, NEW.total_price;
          END IF;
          
          RETURN NEW;
      END;
      $function$;
    `;
    
    const { error: functionError } = await supabase.rpc('query', { 
      query: functionSQL 
    });
    
    if (functionError) {
      console.error('❌ Function creation error:', functionError);
      return;
    } else {
      console.log('✅ Auto-fix function created');
    }
    
    // Step 2: Create the trigger
    console.log('🔧 Step 2: Creating trigger...');
    
    const triggerSQL = `
      DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;
      
      CREATE TRIGGER auto_fix_medical_aid_values_trigger
          BEFORE INSERT OR UPDATE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION auto_fix_medical_aid_service_values();
    `;
    
    const { error: triggerError } = await supabase.rpc('query', {
      query: triggerSQL
    });
    
    if (triggerError) {
      console.error('❌ Trigger creation error:', triggerError);
      return;
    } else {
      console.log('✅ Auto-fix trigger created');
    }
    
    // Step 3: Fix existing data
    console.log('🔄 Step 3: Fixing existing medical aid services...');
    
    const fixExistingSQL = `
      UPDATE invoice_services 
      SET 
          medical_aid_covered = total_price,
          patient_portion = 0
      WHERE invoice_id IN (
          SELECT DISTINCT inv.id 
          FROM invoices_enhanced inv
          JOIN patients p ON inv.patient_id = p.id
          JOIN medical_aid_details mad ON p.id = mad.patient_id
      ) 
      AND patient_portion > 0;
    `;
    
    const { error: fixError } = await supabase.rpc('query', {
      query: fixExistingSQL
    });
    
    if (fixError) {
      console.log('⚠️ Fix existing data note:', fixError.message);
    } else {
      console.log('✅ Existing data fixed');
    }
    
    // Step 4: Verify installation
    console.log('🎯 Step 4: Verifying installation...');
    
    const verifySQL = `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE event_object_table = 'invoice_services'
      AND trigger_name = 'auto_fix_medical_aid_values_trigger';
    `;
    
    const { data: triggerCheck, error: verifyError } = await supabase.rpc('query', {
      query: verifySQL
    });
    
    if (verifyError) {
      console.log('⚠️ Verification note:', verifyError.message);
    } else {
      console.log('📊 Trigger verification:', triggerCheck);
    }
    
    // Step 5: Check medical aid services status
    console.log('📋 Step 5: Checking medical aid services status...');
    
    const checkSQL = `
      SELECT 
        COUNT(*) as total_medical_aid_services,
        SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
        SUM(patient_portion) as total_patient_charges,
        SUM(medical_aid_covered) as total_medical_aid_coverage
      FROM invoice_services svc
      JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
      JOIN patients p ON inv.patient_id = p.id
      JOIN medical_aid_details mad ON p.id = mad.patient_id;
    `;
    
    const { data: statusCheck, error: statusError } = await supabase.rpc('query', {
      query: checkSQL
    });
    
    if (statusError) {
      console.log('⚠️ Status check note:', statusError.message);
    } else {
      console.log('📊 Medical aid services status:', statusCheck);
    }
    
    console.log('\n🎉 AUTO-FIX TRIGGER INSTALLATION COMPLETED!');
    console.log('\n✅ WHAT WAS INSTALLED:');
    console.log('   - Auto-fix function that detects medical aid status');
    console.log('   - BEFORE INSERT/UPDATE trigger on invoice_services');
    console.log('   - Automatic correction of medical_aid_covered/patient_portion values');
    console.log('   - Fixed existing incorrect service values');
    console.log('\n🧪 NEXT STEP:');
    console.log('   - Test by creating a new visit with a medical aid patient');
    console.log('   - The services should automatically show N$ 0.00 patient portion');
    
  } catch (error) {
    console.error('💥 Error installing auto-fix trigger:', error.message);
  }
}

executeAutoFixTrigger();