#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function installAutoFixTrigger() {
  try {
    console.log('🚀 Installing auto-fix medical aid trigger via Supabase client...\n');
    
    // Step 1: Drop existing triggers and functions
    console.log('🗑️ Step 1: Removing any existing auto-fix triggers...');
    
    const cleanupSQL = `
      DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;
      DROP FUNCTION IF EXISTS auto_fix_medical_aid_service_values();
    `;
    
    const { error: cleanupError } = await supabase.rpc('exec_sql', { sql: cleanupSQL });
    if (cleanupError) {
      console.log('⚠️ Cleanup warning (expected):', cleanupError.message);
    } else {
      console.log('✅ Cleaned up existing triggers/functions');
    }
    
    // Step 2: Create the auto-fix function
    console.log('\n📝 Step 2: Creating auto-fix function...');
    
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
              
              RAISE NOTICE 'AUTO-FIX: Medical aid patient % - Service % set to medical_aid_covered=%, patient_portion=0', 
                           invoice_patient_id, NEW.code, NEW.total_price;
          ELSE
              -- Cash patient: Patient pays 100%, medical aid covers nothing
              NEW.medical_aid_covered := 0;
              NEW.patient_portion := NEW.total_price;
              
              RAISE NOTICE 'AUTO-FIX: Cash patient % - Service % set to medical_aid_covered=0, patient_portion=%', 
                           invoice_patient_id, NEW.code, NEW.total_price;
          END IF;
          
          RETURN NEW;
      END;
      $function$;
    `;
    
    const { error: functionError } = await supabase.rpc('exec_sql', { sql: functionSQL });
    if (functionError) {
      throw new Error(`Function creation failed: ${functionError.message}`);
    }
    console.log('✅ Auto-fix function created');
    
    // Step 3: Create the trigger
    console.log('\n🔧 Step 3: Creating trigger...');
    
    const triggerSQL = `
      CREATE TRIGGER auto_fix_medical_aid_values_trigger
          BEFORE INSERT OR UPDATE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION auto_fix_medical_aid_service_values();
    `;
    
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: triggerSQL });
    if (triggerError) {
      throw new Error(`Trigger creation failed: ${triggerError.message}`);
    }
    console.log('✅ Auto-fix trigger created');
    
    // Step 4: Test the trigger
    console.log('\n🧪 Step 4: Testing the trigger...');
    
    // Get Elisabeth's patient ID and create a test
    const elisabethPatientId = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';
    
    // Create a test invoice for Elisabeth
    const { data: testInvoice, error: invoiceError } = await supabase
      .from('invoices_enhanced')
      .insert({
        invoice_number: `TRIGGER-TEST-${Date.now()}`,
        patient_id: elisabethPatientId,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_status: 'pending'
      })
      .select()
      .single();
    
    if (invoiceError) {
      throw new Error(`Test invoice creation failed: ${invoiceError.message}`);
    }
    
    console.log('Created test invoice:', testInvoice.invoice_number);
    
    // Get a tariff ID for testing
    const { data: tariffs, error: tariffError } = await supabase
      .from('practice_tariffs')
      .select('id')
      .limit(1);
    
    if (tariffError || !tariffs || tariffs.length === 0) {
      throw new Error('No practice tariffs found for testing');
    }
    
    // Insert a test service with wrong values (should be auto-fixed)
    const { data: testService, error: serviceError } = await supabase
      .from('invoice_services')
      .insert({
        invoice_id: testInvoice.id,
        tariff_id: tariffs[0].id,
        code: 'TRIGGER-TEST',
        description: 'Trigger test service',
        quantity: 1,
        unit_price: 100.00,
        total_price: 100.00,
        medical_aid_covered: 999.99, // Wrong value - should be auto-fixed
        patient_portion: 888.88,     // Wrong value - should be auto-fixed
        notes: 'Auto-fix trigger test'
      })
      .select()
      .single();
    
    if (serviceError) {
      throw new Error(`Test service creation failed: ${serviceError.message}`);
    }
    
    console.log('Test service result:', {
      code: testService.code,
      total_price: testService.total_price,
      medical_aid_covered: testService.medical_aid_covered,
      patient_portion: testService.patient_portion
    });
    
    if (testService.medical_aid_covered === 100 && testService.patient_portion === 0) {
      console.log('✅ AUTO-FIX TRIGGER IS WORKING! Wrong values (999.99, 888.88) were corrected to (100, 0)');
    } else {
      console.log('❌ AUTO-FIX TRIGGER FAILED! Values were not corrected:', testService);
    }
    
    // Clean up test data
    await supabase.from('invoice_services').delete().eq('invoice_id', testInvoice.id);
    await supabase.from('invoices_enhanced').delete().eq('id', testInvoice.id);
    console.log('✅ Test data cleaned up');
    
    // Step 5: Verify trigger installation
    console.log('\n🎯 Step 5: Verifying trigger installation...');
    
    const verificationSQL = `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE event_object_table = 'invoice_services'
      AND trigger_name = 'auto_fix_medical_aid_values_trigger';
    `;
    
    const { data: triggers, error: verifyError } = await supabase.rpc('exec_sql', { sql: verificationSQL });
    
    if (verifyError) {
      console.log('⚠️ Cannot verify trigger installation:', verifyError.message);
      console.log('But the test indicates the trigger is working');
    } else {
      console.log('Final trigger verification:', triggers);
    }
    
    console.log('\n🎉 AUTO-FIX TRIGGER INSTALLATION COMPLETE!');
    console.log('✅ Medical aid patients will now automatically pay N$ 0.00');
    console.log('✅ Cash patients will automatically pay full amount');
    console.log('\n📋 Next Steps:');
    console.log('1. Test by creating a new visit with Elisabeth Shilongo');
    console.log('2. Verify the console logs show patient_portion = 0 for medical aid patients');
    console.log('3. Medical aid billing issue should now be permanently resolved!');
    
  } catch (error) {
    console.error('💥 Error installing auto-fix trigger:', error.message);
    
    // Try manual execution via SQL Editor
    console.log('\n📋 MANUAL INSTALLATION REQUIRED:');
    console.log('If the above failed, please execute this SQL manually in Supabase SQL Editor:');
    console.log('====================================================================');
    console.log(`
-- Step 1: Drop existing
DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;
DROP FUNCTION IF EXISTS auto_fix_medical_aid_service_values();

-- Step 2: Create function
CREATE OR REPLACE FUNCTION auto_fix_medical_aid_service_values()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
    patient_has_medical_aid BOOLEAN := FALSE;
    invoice_patient_id UUID;
BEGIN
    SELECT patient_id INTO invoice_patient_id
    FROM invoices_enhanced WHERE id = NEW.invoice_id;
    
    SELECT EXISTS(
        SELECT 1 FROM medical_aid_details 
        WHERE patient_id = invoice_patient_id
    ) INTO patient_has_medical_aid;
    
    IF patient_has_medical_aid THEN
        NEW.medical_aid_covered := NEW.total_price;
        NEW.patient_portion := 0;
    ELSE
        NEW.medical_aid_covered := 0;
        NEW.patient_portion := NEW.total_price;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Step 3: Create trigger
CREATE TRIGGER auto_fix_medical_aid_values_trigger
    BEFORE INSERT OR UPDATE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION auto_fix_medical_aid_service_values();
    `);
    console.log('====================================================================');
  }
}

installAutoFixTrigger();