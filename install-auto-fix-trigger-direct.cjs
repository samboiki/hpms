#!/usr/bin/env node

const { Client } = require('pg');

// Direct PostgreSQL connection (bolt.new style)
const client = new Client({
  host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'T@ngisasa200',
  ssl: { rejectUnauthorized: false }
});

async function installAutoFixTrigger() {
  try {
    console.log('🚀 Installing auto-fix medical aid trigger (direct PostgreSQL)...\n');
    
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Step 1: Check existing triggers
    console.log('\n📋 Step 1: Checking existing triggers...');
    
    const existingTriggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing, event_object_table
      FROM information_schema.triggers 
      WHERE event_object_table = 'invoice_services'
      ORDER BY trigger_name;
    `);
    
    console.log('Existing triggers on invoice_services:', existingTriggers.rows);
    
    // Step 2: Drop any existing auto-fix triggers
    console.log('\n🗑️ Step 2: Removing any existing auto-fix triggers...');
    
    await client.query(`DROP TRIGGER IF EXISTS auto_fix_medical_aid_values_trigger ON invoice_services;`);
    await client.query(`DROP FUNCTION IF EXISTS auto_fix_medical_aid_service_values();`);
    
    console.log('✅ Cleaned up existing triggers/functions');
    
    // Step 3: Create the auto-fix function
    console.log('\n📝 Step 3: Creating auto-fix function...');
    
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
    
    await client.query(functionSQL);
    console.log('✅ Auto-fix function created');
    
    // Step 4: Create the trigger
    console.log('\n🔧 Step 4: Creating trigger...');
    
    const triggerSQL = `
      CREATE TRIGGER auto_fix_medical_aid_values_trigger
          BEFORE INSERT OR UPDATE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION auto_fix_medical_aid_service_values();
    `;
    
    await client.query(triggerSQL);
    console.log('✅ Auto-fix trigger created');
    
    // Step 5: Test the trigger
    console.log('\n🧪 Step 5: Testing the trigger...');
    
    // Get Elisabeth's patient ID and create a test
    const elisabethPatientId = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';
    
    // Create a test invoice for Elisabeth
    const testInvoiceResult = await client.query(`
      INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        issue_date,
        due_date,
        payment_status
      ) VALUES (
        'TRIGGER-TEST-' || extract(epoch from now()),
        $1,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'pending'
      ) RETURNING id, invoice_number;
    `, [elisabethPatientId]);
    
    const testInvoice = testInvoiceResult.rows[0];
    console.log('Created test invoice:', testInvoice.invoice_number);
    
    // Insert a test service with wrong values (should be auto-fixed)
    const testServiceResult = await client.query(`
      INSERT INTO invoice_services (
        invoice_id,
        tariff_id,
        code,
        description,
        quantity,
        unit_price,
        total_price,
        medical_aid_covered,
        patient_portion,
        notes
      ) VALUES (
        $1,
        (SELECT id FROM practice_tariffs LIMIT 1),
        'TRIGGER-TEST',
        'Trigger test service',
        1,
        100.00,
        100.00,
        999.99,
        888.88,
        'Auto-fix trigger test'
      ) RETURNING code, total_price, medical_aid_covered, patient_portion;
    `, [testInvoice.id]);
    
    const testService = testServiceResult.rows[0];
    console.log('Test service result:', testService);
    
    if (testService.medical_aid_covered === 100 && testService.patient_portion === 0) {
      console.log('✅ AUTO-FIX TRIGGER IS WORKING! Wrong values (999.99, 888.88) were corrected to (100, 0)');
    } else {
      console.log('❌ AUTO-FIX TRIGGER FAILED! Values were not corrected:', testService);
    }
    
    // Clean up test data
    await client.query(`DELETE FROM invoice_services WHERE invoice_id = $1`, [testInvoice.id]);
    await client.query(`DELETE FROM invoices_enhanced WHERE id = $1`, [testInvoice.id]);
    console.log('✅ Test data cleaned up');
    
    // Step 6: Verify final trigger state
    console.log('\n🎯 Step 6: Final verification...');
    
    const finalTriggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE event_object_table = 'invoice_services'
      AND trigger_name = 'auto_fix_medical_aid_values_trigger';
    `);
    
    console.log('Final trigger verification:', finalTriggers.rows);
    
    if (finalTriggers.rows.length > 0) {
      console.log('\n🎉 AUTO-FIX TRIGGER SUCCESSFULLY INSTALLED!');
      console.log('✅ Medical aid patients will now automatically pay N$ 0.00');
      console.log('✅ Cash patients will automatically pay full amount');
      console.log('\n🧪 Next: Test by creating a new visit with Elisabeth Shilongo');
    } else {
      console.log('\n❌ TRIGGER INSTALLATION FAILED!');
    }
    
  } catch (error) {
    console.error('💥 Error installing auto-fix trigger:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

installAutoFixTrigger();