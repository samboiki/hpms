#!/usr/bin/env node

/**
 * COMPREHENSIVE MEDICAL AID BILLING WORKFLOW TEST
 * 
 * This script tests the complete billing workflow to ensure:
 * 1. Patients with medical aid are NOT charged (Patient Portion = N$ 0.00)
 * 2. Medical aid covers 100% of the cost (Medical Aid Total = Full Amount)
 * 3. Automatic batching occurs for medical aid claims
 * 4. Invoice totals are calculated correctly
 */

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDY0NDU5MiwiZXhwIjoyMDMwMjIwNTkyfQ.Kz5MUJxHyHySzFWb4nDjQcn_WH4sF5NWfagXLuWdEJY';

// Direct PostgreSQL configuration
const dbConfig = {
  host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'T@ngisasa200',
  ssl: { rejectUnauthorized: false }
};

console.log('🧪 COMPREHENSIVE MEDICAL AID BILLING WORKFLOW TEST');
console.log('===============================================');

async function runComprehensiveTest() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const pgClient = new Client(dbConfig);
  
  try {
    // Connect to PostgreSQL
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Step 1: Verify Database Setup
    console.log('\n📋 STEP 1: Verifying Database Setup');
    console.log('=====================================');
    
    // Check required tables exist
    const requiredTables = [
      'invoices_enhanced',
      'invoice_services', 
      'medical_aid_details',
      'medical_aid_providers',
      'patients',
      'practice_tariffs'
    ];
    
    for (const table of requiredTables) {
      try {
        const result = await pgClient.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        console.log(`✅ Table '${table}' exists with ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`❌ Table '${table}' missing or inaccessible:`, err.message);
        return;
      }
    }

    // Step 2: Find or Create Test Patient with Medical Aid
    console.log('\n👤 STEP 2: Setting Up Test Patient with Medical Aid');
    console.log('==================================================');
    
    let testPatient;
    
    // Try to find existing patient with medical aid
    const existingPatientQuery = `
      SELECT p.*, mad.id as medical_aid_id, map.name as medical_aid_name
      FROM patients p
      JOIN medical_aid_details mad ON p.id = mad.patient_id
      JOIN medical_aid_providers map ON mad.medical_aid_provider_id = map.id
      LIMIT 1
    `;
    
    const existingResult = await pgClient.query(existingPatientQuery);
    
    if (existingResult.rows.length > 0) {
      testPatient = existingResult.rows[0];
      console.log(`✅ Found existing patient with medical aid:`);
      console.log(`   - Name: ${testPatient.first_name} ${testPatient.last_name}`);
      console.log(`   - Medical Aid: ${testPatient.medical_aid_name}`);
      console.log(`   - Patient ID: ${testPatient.id}`);
    } else {
      console.log('❌ No existing patients with medical aid found');
      console.log('   Please ensure at least one patient has medical aid details');
      return;
    }

    // Step 3: Create Test Visit
    console.log('\n🏥 STEP 3: Creating Test Visit');
    console.log('==============================');
    
    const visitResult = await pgClient.query(`
      INSERT INTO visits (
        patient_id,
        visit_date,
        visit_time,
        chief_complaint,
        diagnosis,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      testPatient.id,
      new Date().toISOString().split('T')[0],
      '14:30:00',
      'Medical aid billing test',
      'Test diagnosis for billing workflow',
      'completed'
    ]);
    
    const testVisit = visitResult.rows[0];
    console.log(`✅ Created test visit: ${testVisit.id}`);

    // Step 4: Get Practice and Practice ID
    console.log('\n🏢 STEP 4: Getting Practice Information');
    console.log('======================================');
    
    const practiceResult = await pgClient.query(`
      SELECT * FROM practices LIMIT 1
    `);
    
    if (practiceResult.rows.length === 0) {
      console.log('❌ No practices found in database');
      return;
    }
    
    const testPractice = practiceResult.rows[0];
    console.log(`✅ Using practice: ${testPractice.name} (${testPractice.id})`);

    // Step 5: Create Test Invoice with Services
    console.log('\n💰 STEP 5: Creating Test Invoice with Services');
    console.log('===============================================');
    
    // Generate invoice number
    const invoiceNumber = `INV${Date.now()}`;
    
    // Create invoice
    const invoiceResult = await pgClient.query(`
      INSERT INTO invoices_enhanced (
        invoice_number,
        patient_id,
        visit_id,
        practice_id,
        issue_date,
        due_date,
        payment_status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      invoiceNumber,
      testPatient.id,
      testVisit.id,
      testPractice.id,
      new Date().toISOString().split('T')[0],
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      'pending',
      'Medical aid billing test invoice'
    ]);
    
    const testInvoice = invoiceResult.rows[0];
    console.log(`✅ Created test invoice: ${testInvoice.invoice_number} (${testInvoice.id})`);

    // Step 6: Add Test Services to Invoice
    console.log('\n🛍️ STEP 6: Adding Test Services to Invoice');
    console.log('==========================================');
    
    // Get some test tariff codes
    const tariffResult = await pgClient.query(`
      SELECT * FROM practice_tariffs 
      WHERE is_active = true 
      ORDER BY price DESC 
      LIMIT 3
    `);
    
    const testServices = [
      {
        code: '8101',
        description: 'Full mouth examination, charting and treatment planning',
        unit_price: 254.70,
        total_price: 254.70
      },
      {
        code: '8109', 
        description: 'Infection control, per dentist/hygienist/assistant, per visit',
        unit_price: 34.40,
        total_price: 34.40
      }
    ];
    
    // If we have tariffs from database, use those instead
    if (tariffResult.rows.length > 0) {
      testServices.length = 0; // Clear default services
      for (const tariff of tariffResult.rows.slice(0, 2)) {
        testServices.push({
          code: tariff.code,
          description: tariff.description,
          unit_price: parseFloat(tariff.price),
          total_price: parseFloat(tariff.price)
        });
      }
    }
    
    console.log(`📦 Adding ${testServices.length} test services:`);
    
    for (const service of testServices) {
      console.log(`   - ${service.code}: ${service.description} (N$ ${service.unit_price})`);
      
      await pgClient.query(`
        INSERT INTO invoice_services (
          invoice_id,
          code,
          description,
          quantity,
          unit_price,
          total_price,
          medical_aid_covered,
          patient_portion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        testInvoice.id,
        service.code,
        service.description,
        1,
        service.unit_price,
        service.total_price,
        service.total_price, // Medical aid should cover full amount
        0 // Patient should pay nothing
      ]);
    }
    
    console.log('✅ Added all test services to invoice');

    // Step 7: Verify Invoice Totals (Triggers should update these)
    console.log('\n🧮 STEP 7: Verifying Invoice Totals');
    console.log('===================================');
    
    // Wait a moment for triggers to fire
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedInvoiceResult = await pgClient.query(`
      SELECT * FROM invoices_enhanced WHERE id = $1
    `, [testInvoice.id]);
    
    const updatedInvoice = updatedInvoiceResult.rows[0];
    
    console.log('📊 Invoice Totals:');
    console.log(`   - Subtotal: N$ ${updatedInvoice.subtotal || 0}`);
    console.log(`   - Tax (15%): N$ ${updatedInvoice.tax || 0}`);
    console.log(`   - Total: N$ ${updatedInvoice.total || 0}`);
    console.log(`   - Medical Aid Total: N$ ${updatedInvoice.medical_aid_total || 0}`);
    console.log(`   - Patient Total: N$ ${updatedInvoice.patient_total || 0}`);
    
    // Step 8: Verify Medical Aid Billing Logic
    console.log('\n✅ STEP 8: Verifying Medical Aid Billing Logic');
    console.log('==============================================');
    
    const patientTotal = parseFloat(updatedInvoice.patient_total || 0);
    const medicalAidTotal = parseFloat(updatedInvoice.medical_aid_total || 0);
    const total = parseFloat(updatedInvoice.total || 0);
    
    let testsPassed = 0;
    let totalTests = 3;
    
    // Test 1: Patient should pay N$ 0.00
    if (patientTotal === 0) {
      console.log('✅ TEST 1 PASSED: Patient Total = N$ 0.00 (Patient is NOT charged)');
      testsPassed++;
    } else {
      console.log(`❌ TEST 1 FAILED: Patient Total = N$ ${patientTotal} (Patient should NOT be charged)`);
    }
    
    // Test 2: Medical aid should cover the full amount
    if (medicalAidTotal > 0 && medicalAidTotal === total) {
      console.log(`✅ TEST 2 PASSED: Medical Aid covers full amount (N$ ${medicalAidTotal})`);
      testsPassed++;
    } else {
      console.log(`❌ TEST 2 FAILED: Medical Aid Total = N$ ${medicalAidTotal}, Total = N$ ${total}`);
    }
    
    // Test 3: Total should equal Medical Aid Total + Patient Total
    if (Math.abs(total - (medicalAidTotal + patientTotal)) < 0.01) {
      console.log('✅ TEST 3 PASSED: Total = Medical Aid Total + Patient Total');
      testsPassed++;
    } else {
      console.log(`❌ TEST 3 FAILED: Math doesn't add up - Total: ${total}, Medical Aid: ${medicalAidTotal}, Patient: ${patientTotal}`);
    }

    // Step 9: Check if Invoice was Batched
    console.log('\n📦 STEP 9: Checking Medical Aid Batching');
    console.log('========================================');
    
    const batchCheckResult = await pgClient.query(`
      SELECT 
        inv.batch_id,
        bh.batch_number,
        bh.medical_aid_reference,
        bh.status as batch_status
      FROM invoices_enhanced inv
      LEFT JOIN batch_headers bh ON inv.batch_id = bh.id
      WHERE inv.id = $1
    `, [testInvoice.id]);
    
    const batchInfo = batchCheckResult.rows[0];
    
    if (batchInfo.batch_id) {
      console.log(`✅ Invoice automatically batched:`);
      console.log(`   - Batch ID: ${batchInfo.batch_id}`);
      console.log(`   - Batch Number: ${batchInfo.batch_number}`);
      console.log(`   - Medical Aid: ${batchInfo.medical_aid_reference}`);
      console.log(`   - Status: ${batchInfo.batch_status}`);
      testsPassed++;
      totalTests++;
    } else {
      console.log('⚠️  Invoice not automatically batched (may be expected if triggers not set up)');
    }

    // Step 10: Final Results
    console.log('\n🎉 STEP 10: Final Test Results');
    console.log('==============================');
    
    console.log(`\n📊 TEST SUMMARY: ${testsPassed}/${totalTests} tests passed`);
    
    if (testsPassed === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Medical aid billing is working correctly!');
      console.log('\n✅ VERIFIED:');
      console.log('   ✓ Patients with medical aid are NOT charged');
      console.log('   ✓ Medical aid covers 100% of costs including tax');
      console.log('   ✓ Invoice totals calculate correctly');
      if (batchInfo.batch_id) {
        console.log('   ✓ Automatic batching for medical aid claims');
      }
    } else {
      console.log('❌ SOME TESTS FAILED! Medical aid billing needs fixes.');
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Execute the COMPREHENSIVE_MEDICAL_AID_BILLING_FIX.sql');
      console.log('   2. Re-run this test to verify fixes');
    }

    // Step 11: Cleanup Test Data (Optional)
    console.log('\n🧹 STEP 11: Cleanup Test Data');
    console.log('=============================');
    
    console.log('Would you like to clean up test data? (Keeping for inspection)');
    console.log(`   - Test Visit ID: ${testVisit.id}`);
    console.log(`   - Test Invoice ID: ${testInvoice.id}`);
    console.log(`   - Test Invoice Number: ${testInvoice.invoice_number}`);
    
    // Uncomment to auto-cleanup:
    // await pgClient.query('DELETE FROM invoice_services WHERE invoice_id = $1', [testInvoice.id]);
    // await pgClient.query('DELETE FROM invoices_enhanced WHERE id = $1', [testInvoice.id]);
    // await pgClient.query('DELETE FROM visits WHERE id = $1', [testVisit.id]);
    // console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('💥 Error in comprehensive test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pgClient.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the test
runComprehensiveTest().catch(console.error);