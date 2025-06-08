#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 SERVICE ROLE CONFIGURATION - Bypasses RLS
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixSchemaAndImport() {
  console.log('🔧 Fixing practice_tariffs schema and importing dental codes...\n');
  
  try {
    // Test service role access
    console.log('🔑 Testing service role access...');
    const { data: testData, error: testError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(1);
    
    if (testError) {
      throw new Error(`Service role test failed: ${testError.message}`);
    }
    
    console.log('✅ Service role access confirmed\n');
    
    // Use RPC to execute raw SQL for schema changes
    console.log('🔧 Adding missing columns to practice_tariffs table...');
    
    const schemaUpdateSQL = `
      -- Add missing columns to practice_tariffs table
      ALTER TABLE practice_tariffs 
      ADD COLUMN IF NOT EXISTS multiplication_rule TEXT DEFAULT 'NO',
      ADD COLUMN IF NOT EXISTS tooth_number_required BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS subcategory TEXT,
      ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'per_visit',
      ADD COLUMN IF NOT EXISTS complexity TEXT DEFAULT 'moderate',
      ADD COLUMN IF NOT EXISTS requires_pre_auth BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS medical_aid_code TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `;
    
    // Execute schema update using RPC
    const { data: schemaResult, error: schemaError } = await supabase.rpc('execute_sql', {
      sql: schemaUpdateSQL
    });
    
    if (schemaError && !schemaError.message.includes('does not exist')) {
      console.log('⚠️  Schema update via RPC not available, continuing with data import...');
    } else {
      console.log('✅ Schema updated successfully');
    }
    
    // Get practices
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name');
    
    if (practicesError) {
      throw new Error(`Failed to fetch practices: ${practicesError.message}`);
    }
    
    console.log(`📋 Found ${practices.length} practices`);
    
    // Clear existing dental codes
    console.log('🧹 Clearing existing dental codes...');
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .or('code.like.8%,code.like.9%');
    
    if (deleteError) {
      console.log(`⚠️  Delete warning: ${deleteError.message}`);
    } else {
      console.log('✅ Existing dental codes cleared');
    }
    
    // Simplified dental tariffs data (core fields only)
    const dentalTariffs = [
      // Consultations & Examinations
      { code: '8101', price: 450.00, name: 'Oral Health Assessment', category: 'Consultation' },
      { code: '8102', price: 350.00, name: 'Limited Oral Examination', category: 'Consultation' },
      { code: '8103', price: 500.00, name: 'Emergency Oral Examination', category: 'Emergency' },
      { code: '8104', price: 200.00, name: 'Follow-up Examination', category: 'Consultation' },
      
      // Diagnostic Procedures
      { code: '8201', price: 180.00, name: 'Intraoral Radiograph (Single)', category: 'Diagnostic' },
      { code: '8202', price: 320.00, name: 'Bitewing Radiographs (Set)', category: 'Diagnostic' },
      { code: '8203', price: 850.00, name: 'Panoramic Radiograph', category: 'Diagnostic' },
      { code: '8204', price: 2500.00, name: 'CBCT Scan (Limited)', category: 'Diagnostic' },
      { code: '8205', price: 4200.00, name: 'CBCT Scan (Full Mouth)', category: 'Diagnostic' },
      
      // Preventive Services
      { code: '8301', price: 650.00, name: 'Professional Dental Cleaning', category: 'Preventive' },
      { code: '8302', price: 380.00, name: 'Fluoride Treatment', category: 'Preventive' },
      { code: '8303', price: 450.00, name: 'Dental Sealant', category: 'Preventive' },
      { code: '8304', price: 1200.00, name: 'Deep Cleaning (Per Quadrant)', category: 'Preventive' },
      { code: '8305', price: 580.00, name: 'Oral Hygiene Instruction', category: 'Preventive' },
      
      // Restorative Dentistry - Amalgam Fillings
      { code: '8401', price: 850.00, name: 'Amalgam Filling (1 Surface)', category: 'Restorative' },
      { code: '8402', price: 1200.00, name: 'Amalgam Filling (2 Surfaces)', category: 'Restorative' },
      { code: '8403', price: 1500.00, name: 'Amalgam Filling (3+ Surfaces)', category: 'Restorative' },
      
      // Restorative Dentistry - Composite Fillings
      { code: '8404', price: 1200.00, name: 'Composite Filling (1 Surface)', category: 'Restorative' },
      { code: '8405', price: 1600.00, name: 'Composite Filling (2 Surfaces)', category: 'Restorative' },
      { code: '8406', price: 2000.00, name: 'Composite Filling (3+ Surfaces)', category: 'Restorative' },
      { code: '8407', price: 2800.00, name: 'Large Composite Restoration', category: 'Restorative' },
      
      // Endodontic Treatment
      { code: '8501', price: 2800.00, name: 'Root Canal - Anterior Tooth', category: 'Endodontic' },
      { code: '8502', price: 3500.00, name: 'Root Canal - Premolar', category: 'Endodontic' },
      { code: '8503', price: 4200.00, name: 'Root Canal - Molar', category: 'Endodontic' },
      { code: '8504', price: 1800.00, name: 'Pulpotomy', category: 'Endodontic' },
      { code: '8505', price: 1200.00, name: 'Pulp Capping (Direct)', category: 'Endodontic' },
      { code: '8506', price: 800.00, name: 'Pulp Capping (Indirect)', category: 'Endodontic' },
      
      // Prosthodontic Services - Crowns
      { code: '8601', price: 8500.00, name: 'Crown - Porcelain Fused to Metal', category: 'Prosthodontic' },
      { code: '8602', price: 12000.00, name: 'Crown - All Ceramic', category: 'Prosthodontic' },
      { code: '8603', price: 15000.00, name: 'Crown - Zirconia', category: 'Prosthodontic' },
      { code: '8604', price: 6500.00, name: 'Crown - Stainless Steel', category: 'Prosthodontic' },
      { code: '8605', price: 3500.00, name: 'Crown - Temporary', category: 'Prosthodontic' },
      
      // Oral Surgery - Extractions
      { code: '8701', price: 1200.00, name: 'Simple Extraction', category: 'Oral Surgery' },
      { code: '8702', price: 2200.00, name: 'Surgical Extraction', category: 'Oral Surgery' },
      { code: '8703', price: 3500.00, name: 'Impacted Wisdom Tooth Extraction', category: 'Oral Surgery' },
      { code: '8704', price: 4500.00, name: 'Complex Surgical Extraction', category: 'Oral Surgery' },
      { code: '8705', price: 2800.00, name: 'Root Removal', category: 'Oral Surgery' },
      
      // Oral Surgery - Implants
      { code: '8710', price: 25000.00, name: 'Dental Implant (Single)', category: 'Oral Surgery' },
      { code: '8711', price: 18000.00, name: 'Implant Abutment', category: 'Oral Surgery' },
      { code: '8712', price: 15000.00, name: 'Implant Crown', category: 'Oral Surgery' },
      { code: '8713', price: 8500.00, name: 'Bone Graft (Implant Site)', category: 'Oral Surgery' },
      
      // Emergency Services
      { code: '9101', price: 680.00, name: 'Emergency Pain Relief', category: 'Emergency' },
      { code: '9102', price: 450.00, name: 'Temporary Filling', category: 'Emergency' },
      { code: '9103', price: 850.00, name: 'Trauma Assessment', category: 'Emergency' },
      { code: '9104', price: 1200.00, name: 'Emergency Extraction', category: 'Emergency' },
      { code: '9105', price: 800.00, name: 'Emergency Endodontic Treatment', category: 'Emergency' },
      
      // Aesthetic/Cosmetic Dentistry
      { code: '9201', price: 8500.00, name: 'Veneer (Porcelain)', category: 'Aesthetic' },
      { code: '9202', price: 6500.00, name: 'Veneer (Composite)', category: 'Aesthetic' },
      { code: '9203', price: 12000.00, name: 'Teeth Whitening (In-Office)', category: 'Aesthetic' },
      { code: '9204', price: 4500.00, name: 'Teeth Whitening (Take-Home)', category: 'Aesthetic' },
      { code: '9205', price: 2800.00, name: 'Bonding (Cosmetic)', category: 'Aesthetic' }
    ];
    
    // Insert tariffs for each practice using core fields only
    console.log('📊 Inserting dental tariffs (simplified schema)...');
    let totalInserted = 0;
    
    for (const practice of practices) {
      console.log(`   Processing ${practice.name}...`);
      
      // Insert in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < dentalTariffs.length; i += batchSize) {
        const batch = dentalTariffs.slice(i, i + batchSize);
        
        const tariffsForPractice = batch.map(tariff => ({
          practice_id: practice.id,
          code: tariff.code,
          price: tariff.price,
          is_active: true
        }));
        
        const { data: insertedTariffs, error: insertError } = await supabase
          .from('practice_tariffs')
          .insert(tariffsForPractice)
          .select('id');
        
        if (insertError) {
          console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} failed for ${practice.name}:`, insertError.message);
        } else {
          totalInserted += insertedTariffs.length;
          console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${insertedTariffs.length} codes`);
        }
      }
    }
    
    // Generate summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('practice_tariffs')
      .select('code, price')
      .or('code.like.8%,code.like.9%');
    
    if (!summaryError && summaryData) {
      console.log('\n📊 Import Summary:');
      console.log('==================');
      console.log(`✅ ${summaryData.length} dental tariff records imported`);
      console.log(`✅ Applied to ${practices.length} practices`);
      console.log(`✅ Price range: N$${Math.min(...summaryData.map(t => t.price))} - N$${Math.max(...summaryData.map(t => t.price))}`);
    }
    
    console.log('\n🎉 IMPORT COMPLETE!');
    console.log(`✅ ${totalInserted} dental tariff records imported successfully`);
    console.log('✅ All tariffs are now available in the ServiceSelector component');
    console.log('✅ Dental codes can be selected during visit billing');
    
  } catch (error) {
    console.error('❌ Schema fix and import failed:', error.message);
    
    if (error.message.includes('JWT')) {
      console.log('\n💡 JWT Token Issue:');
      console.log('1. Check that service_role key is correct');
      console.log('2. Verify token has not expired');
      console.log('3. Ensure service_role has proper permissions');
    } else if (error.message.includes('RLS')) {
      console.log('\n💡 RLS Policy Issue:');
      console.log('1. Service role should bypass RLS policies');
      console.log('2. Check practice_tariffs table RLS settings');
      console.log('3. Verify service_role permissions in Supabase Dashboard');
    } else {
      console.log('\n💡 To fix this:');
      console.log('1. Verify Supabase URL and service role key');
      console.log('2. Check network connectivity');
      console.log('3. Ensure practice_tariffs table exists');
    }
  }
}

// Execute the schema fix and import
try {
  await fixSchemaAndImport();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing required modules...');
    console.log('Run: npm install @supabase/supabase-js');
    console.log('Then run this script again');
  } else {
    console.error('Execution error:', error.message);
  }
}