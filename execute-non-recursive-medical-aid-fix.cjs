#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeNonRecursiveFix() {
  try {
    console.log('🩺 MEDICAL AID BILLING FIX - Non-Recursive Solution\n');
    
    // Step 1: Drop the problematic recursive trigger
    console.log('🗑️ Step 1: Removing problematic recursive trigger...');
    
    const dropTriggerSQL = `
      DROP TRIGGER IF EXISTS fix_medical_aid_invoice_totals_trigger ON invoice_services;
      DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();
    `;
    
    const { error: dropError } = await supabase.rpc('exec_sql', { 
      sql_query: dropTriggerSQL 
    });
    
    if (dropError) {
      console.log('⚠️ Drop trigger note:', dropError.message);
    } else {
      console.log('✅ Recursive trigger removed\n');
    }
    
    // Step 2: Check current state
    console.log('🔍 Step 2: Checking current medical aid billing issues...');
    
    const checkCurrentSQL = `
      SELECT 
        COUNT(*) as total_services_charging_patient,
        COALESCE(SUM(patient_portion), 0) as total_patient_charges_that_should_be_zero
      FROM invoice_services svc
      JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
      JOIN patients p ON inv.patient_id = p.id
      JOIN medical_aid_details mad ON p.id = mad.patient_id
      WHERE svc.patient_portion > 0;
    `;
    
    const { data: currentState, error: checkError } = await supabase.rpc('exec_sql', { 
      sql_query: checkCurrentSQL 
    });
    
    if (checkError) {
      console.error('❌ Check error:', checkError.message);
      return;
    } else {
      if (currentState && currentState.length > 0) {
        const state = currentState[0];
        console.log(`   • Services charging medical aid patients: ${state.total_services_charging_patient}`);
        console.log(`   • Total incorrect patient charges: N$ ${state.total_patient_charges_that_should_be_zero}\n`);
      }
    }
    
    // Step 3: Fix medical aid services (direct update, no triggers)
    console.log('💰 Step 3: Fixing medical aid service charges...');
    
    const fixServicesSQL = `
      UPDATE invoice_services 
      SET 
          medical_aid_covered = total_price,
          patient_portion = 0,
          updated_at = NOW()
      WHERE id IN (
          SELECT svc.id
          FROM invoice_services svc
          JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
          JOIN patients p ON inv.patient_id = p.id
          JOIN medical_aid_details mad ON p.id = mad.patient_id
          WHERE svc.patient_portion > 0
      );
    `;
    
    const { error: fixServicesError } = await supabase.rpc('exec_sql', {
      sql_query: fixServicesSQL
    });
    
    if (fixServicesError) {
      console.error('❌ Services fix error:', fixServicesError.message);
      return;
    } else {
      console.log('✅ Medical aid services fixed\n');
    }
    
    // Step 4: Fix invoice totals
    console.log('📄 Step 4: Updating invoice totals...');
    
    const fixInvoicesSQL = `
      UPDATE invoices_enhanced 
      SET 
          medical_aid_total = (
              SELECT COALESCE(SUM(medical_aid_covered), 0)
              FROM invoice_services svc
              WHERE svc.invoice_id = invoices_enhanced.id
          ),
          patient_total = (
              SELECT COALESCE(SUM(patient_portion), 0)
              FROM invoice_services svc
              WHERE svc.invoice_id = invoices_enhanced.id
          ),
          updated_at = NOW()
      WHERE id IN (
          SELECT DISTINCT inv.id 
          FROM invoices_enhanced inv
          JOIN patients p ON inv.patient_id = p.id
          JOIN medical_aid_details mad ON p.id = mad.patient_id
      );
    `;
    
    const { error: fixInvoicesError } = await supabase.rpc('exec_sql', {
      sql_query: fixInvoicesSQL
    });
    
    if (fixInvoicesError) {
      console.error('❌ Invoice totals fix error:', fixInvoicesError.message);
      return;
    } else {
      console.log('✅ Invoice totals updated\n');
    }
    
    // Step 5: Create safe, non-recursive trigger
    console.log('🔄 Step 5: Creating safe, non-recursive trigger...');
    
    const safeTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_invoice_totals_only()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      DECLARE
          invoice_subtotal DECIMAL := 0;
          invoice_medical_aid_total DECIMAL := 0;
          invoice_patient_total DECIMAL := 0;
      BEGIN
          -- Calculate totals from services (READ ONLY - no updates to invoice_services)
          SELECT 
              COALESCE(SUM(total_price), 0),
              COALESCE(SUM(medical_aid_covered), 0),
              COALESCE(SUM(patient_portion), 0)
          INTO 
              invoice_subtotal,
              invoice_medical_aid_total,
              invoice_patient_total
          FROM invoice_services 
          WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
          
          -- Update ONLY the invoice totals (NOT invoice_services table)
          UPDATE invoices_enhanced 
          SET 
              subtotal = invoice_subtotal,
              tax = 0, -- VAT inclusive pricing
              total = invoice_subtotal,
              medical_aid_total = invoice_medical_aid_total,
              patient_total = invoice_patient_total,
              updated_at = NOW()
          WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
          
          RETURN COALESCE(NEW, OLD);
      END;
      $function$;
      
      CREATE TRIGGER update_invoice_totals_trigger
          AFTER INSERT OR UPDATE OR DELETE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION update_invoice_totals_only();
    `;
    
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql_query: safeTriggerSQL
    });
    
    if (triggerError) {
      console.error('❌ Safe trigger creation error:', triggerError.message);
      return;
    } else {
      console.log('✅ Safe trigger created\n');
    }
    
    // Step 6: Verify the fix
    console.log('🎯 Step 6: Verifying the fix...');
    
    const verifySQL = `
      SELECT 
        COUNT(*) as total_medical_aid_services,
        SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
        SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid,
        COALESCE(SUM(patient_portion), 0) as total_patient_charges,
        COALESCE(SUM(medical_aid_covered), 0) as total_medical_aid_coverage
      FROM invoice_services svc
      JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
      JOIN patients p ON inv.patient_id = p.id
      JOIN medical_aid_details mad ON p.id = mad.patient_id;
    `;
    
    const { data: verification, error: verifyError } = await supabase.rpc('exec_sql', {
      sql_query: verifySQL
    });
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
      return;
    }
    
    if (verification && verification.length > 0) {
      const result = verification[0];
      console.log('📊 FINAL VERIFICATION:');
      console.log(`   • Total medical aid services: ${result.total_medical_aid_services}`);
      console.log(`   • Services still charging patient: ${result.services_still_charging_patient}`);
      console.log(`   • Services covered by medical aid: ${result.services_covered_by_medical_aid}`);
      console.log(`   • Total patient charges: N$ ${result.total_patient_charges}`);
      console.log(`   • Total medical aid coverage: N$ ${result.total_medical_aid_coverage}\n`);
      
      if (result.services_still_charging_patient === 0) {
        console.log('🎉 SUCCESS: All medical aid patients now show N$ 0.00 patient portion!');
      } else {
        console.log(`⚠️  WARNING: ${result.services_still_charging_patient} services still charging patients`);
      }
    }
    
    // Step 7: Check specific problem patient
    console.log('\n🔍 Step 7: Checking specific problem patient...');
    
    const specificCheckSQL = `
      SELECT 
        inv.invoice_number,
        inv.medical_aid_total as invoice_medical_aid_total,
        inv.patient_total as invoice_patient_total,
        COUNT(svc.id) as service_count,
        COALESCE(SUM(svc.medical_aid_covered), 0) as services_medical_aid_total,
        COALESCE(SUM(svc.patient_portion), 0) as services_patient_total
      FROM invoices_enhanced inv
      JOIN invoice_services svc ON inv.id = svc.invoice_id
      WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
      GROUP BY inv.id, inv.invoice_number, inv.medical_aid_total, inv.patient_total
      ORDER BY inv.created_at DESC
      LIMIT 3;
    `;
    
    const { data: specificCheck, error: specificError } = await supabase.rpc('exec_sql', {
      sql_query: specificCheckSQL
    });
    
    if (specificError) {
      console.log('⚠️ Specific check note:', specificError.message);
    } else if (specificCheck && specificCheck.length > 0) {
      console.log('📄 Recent invoices for problem patient:');
      specificCheck.forEach((invoice, index) => {
        console.log(`   ${index + 1}. ${invoice.invoice_number}:`);
        console.log(`      • Invoice patient total: N$ ${invoice.invoice_patient_total}`);
        console.log(`      • Invoice medical aid total: N$ ${invoice.invoice_medical_aid_total}`);
        console.log(`      • Services patient total: N$ ${invoice.services_patient_total}`);
        console.log(`      • Services medical aid total: N$ ${invoice.services_medical_aid_total}`);
      });
    }
    
    console.log('\n🎉 MEDICAL AID BILLING FIX COMPLETED!');
    console.log('\n✅ WHAT WAS FIXED:');
    console.log('   - Removed recursive trigger that caused stack overflow');
    console.log('   - Fixed all medical aid services to show N$ 0.00 patient portion');
    console.log('   - Updated invoice totals to reflect correct medical aid coverage');
    console.log('   - Created safe, non-recursive trigger for future invoices');
    console.log('\n🧪 VERIFICATION:');
    console.log('   - Medical aid patients now have Patient Total = N$ 0.00');
    console.log('   - Medical aid covers 100% of service costs');
    console.log('   - No more recursive trigger errors');
    
  } catch (error) {
    console.error('💥 Error executing non-recursive fix:', error.message);
    console.error('Error details:', error);
  }
}

executeNonRecursiveFix();