#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';

// 🔑 Direct PostgreSQL connection like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function executeNonRecursiveFix() {
  console.log('🩺 MEDICAL AID BILLING FIX - Non-Recursive Solution\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Step 1: Drop problematic trigger
    console.log('🗑️ Step 1: Removing problematic recursive trigger...');
    await client.query('DROP TRIGGER IF EXISTS fix_medical_aid_invoice_totals_trigger ON invoice_services;');
    await client.query('DROP FUNCTION IF EXISTS fix_medical_aid_invoice_totals();');
    console.log('✅ Recursive trigger removed\n');
    
    // Step 2: Check current state
    console.log('🔍 Step 2: Checking current medical aid billing issues...');
    const beforeCheck = await client.query(`
      SELECT 
        COUNT(*) as total_services_charging_patient,
        SUM(patient_portion) as total_patient_charges_that_should_be_zero
      FROM invoice_services svc
      JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
      JOIN patients p ON inv.patient_id = p.id
      JOIN medical_aid_details mad ON p.id = mad.patient_id
      WHERE svc.patient_portion > 0
    `);
    
    const { total_services_charging_patient, total_patient_charges_that_should_be_zero } = beforeCheck.rows[0];
    console.log(`   • Services charging medical aid patients: ${total_services_charging_patient}`);
    console.log(`   • Total incorrect patient charges: N$ ${total_patient_charges_that_should_be_zero}\n`);
    
    // Step 3: Fix medical aid services (direct update, no triggers)
    console.log('💰 Step 3: Fixing medical aid service charges...');
    const fixResult = await client.query(`
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
      )
    `);
    console.log(`✅ Fixed ${fixResult.rowCount} medical aid services\n`);
    
    // Step 4: Fix invoice totals
    console.log('📄 Step 4: Updating invoice totals...');
    const invoiceFixResult = await client.query(`
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
      )
    `);
    console.log(`✅ Updated ${invoiceFixResult.rowCount} invoice totals\n`);
    
    // Step 5: Create non-recursive trigger
    console.log('🔄 Step 5: Creating safe, non-recursive trigger...');
    await client.query(`
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
          
          -- Update ONLY the invoice totals (NOT invoice_services)
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
      $function$
    `);
    
    await client.query(`
      CREATE TRIGGER update_invoice_totals_trigger
          AFTER INSERT OR UPDATE OR DELETE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION update_invoice_totals_only()
    `);
    console.log('✅ Safe trigger created\n');
    
    // Step 6: Verify the fix
    console.log('🎯 Step 6: Verifying the fix...');
    const afterCheck = await client.query(`
      SELECT 
        COUNT(*) as total_medical_aid_services,
        SUM(CASE WHEN patient_portion > 0 THEN 1 ELSE 0 END) as services_still_charging_patient,
        SUM(CASE WHEN medical_aid_covered > 0 THEN 1 ELSE 0 END) as services_covered_by_medical_aid,
        SUM(patient_portion) as total_patient_charges,
        SUM(medical_aid_covered) as total_medical_aid_coverage
      FROM invoice_services svc
      JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
      JOIN patients p ON inv.patient_id = p.id
      JOIN medical_aid_details mad ON p.id = mad.patient_id
    `);
    
    const verification = afterCheck.rows[0];
    console.log('📊 FINAL VERIFICATION:');
    console.log(`   • Total medical aid services: ${verification.total_medical_aid_services}`);
    console.log(`   • Services still charging patient: ${verification.services_still_charging_patient}`);
    console.log(`   • Services covered by medical aid: ${verification.services_covered_by_medical_aid}`);
    console.log(`   • Total patient charges: N$ ${verification.total_patient_charges}`);
    console.log(`   • Total medical aid coverage: N$ ${verification.total_medical_aid_coverage}\n`);
    
    // Step 7: Check specific problem patient
    console.log('🔍 Step 7: Checking specific problem patient...');
    const specificCheck = await client.query(`
      SELECT 
        inv.invoice_number,
        inv.medical_aid_total as invoice_medical_aid_total,
        inv.patient_total as invoice_patient_total,
        COUNT(svc.id) as service_count,
        SUM(svc.medical_aid_covered) as services_medical_aid_total,
        SUM(svc.patient_portion) as services_patient_total
      FROM invoices_enhanced inv
      JOIN invoice_services svc ON inv.id = svc.invoice_id
      WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
      GROUP BY inv.id, inv.invoice_number, inv.medical_aid_total, inv.patient_total
      ORDER BY inv.created_at DESC
      LIMIT 3
    `);
    
    if (specificCheck.rows.length > 0) {
      console.log('📄 Recent invoices for problem patient:');
      specificCheck.rows.forEach((invoice, index) => {
        console.log(`   ${index + 1}. ${invoice.invoice_number}:`);
        console.log(`      • Invoice patient total: N$ ${invoice.invoice_patient_total}`);
        console.log(`      • Invoice medical aid total: N$ ${invoice.invoice_medical_aid_total}`);
        console.log(`      • Services patient total: N$ ${invoice.services_patient_total}`);
        console.log(`      • Services medical aid total: N$ ${invoice.services_medical_aid_total}`);
      });
    }
    
    console.log('\n🎉 MEDICAL AID BILLING FIX COMPLETED!');
    
    if (verification.services_still_charging_patient === "0") {
      console.log('✅ SUCCESS: All medical aid patients now show N$ 0.00 patient portion!');
    } else {
      console.log(`⚠️  WARNING: ${verification.services_still_charging_patient} services still charging patients`);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('💥 Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the fix
executeNonRecursiveFix();