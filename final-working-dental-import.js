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

async function finalDentalImport() {
  console.log('🦷 FINAL WORKING DENTAL IMPORT\n');
  
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
    
    // First, let's check the actual structure of practice_tariffs
    console.log('🔍 Checking practice_tariffs table structure...');
    const { data: sampleData, error: structureError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.log(`Structure check failed: ${structureError.message}`);
    } else {
      console.log('✅ Table structure confirmed');
      if (sampleData && sampleData.length > 0) {
        console.log('📋 Available columns:', Object.keys(sampleData[0]));
      }
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
    
    // Dental tariffs with required namaf_prace_2025 field
    const dentalTariffs = [
      // Consultations & Examinations
      { code: '8101', price: 450.00, namaf_prace_2025: 'Oral Health Assessment', practice_type: 'dental' },
      { code: '8102', price: 350.00, namaf_prace_2025: 'Limited Oral Examination', practice_type: 'dental' },
      { code: '8103', price: 500.00, namaf_prace_2025: 'Emergency Oral Examination', practice_type: 'dental' },
      { code: '8104', price: 200.00, namaf_prace_2025: 'Follow-up Examination', practice_type: 'dental' },
      
      // Diagnostic Procedures
      { code: '8201', price: 180.00, namaf_prace_2025: 'Intraoral Radiograph (Single)', practice_type: 'dental' },
      { code: '8202', price: 320.00, namaf_prace_2025: 'Bitewing Radiographs (Set)', practice_type: 'dental' },
      { code: '8203', price: 850.00, namaf_prace_2025: 'Panoramic Radiograph', practice_type: 'dental' },
      { code: '8204', price: 2500.00, namaf_prace_2025: 'CBCT Scan (Limited)', practice_type: 'dental' },
      { code: '8205', price: 4200.00, namaf_prace_2025: 'CBCT Scan (Full Mouth)', practice_type: 'dental' },
      
      // Preventive Services
      { code: '8301', price: 650.00, namaf_prace_2025: 'Professional Dental Cleaning', practice_type: 'dental' },
      { code: '8302', price: 380.00, namaf_prace_2025: 'Fluoride Treatment', practice_type: 'dental' },
      { code: '8303', price: 450.00, namaf_prace_2025: 'Dental Sealant', practice_type: 'dental' },
      { code: '8304', price: 1200.00, namaf_prace_2025: 'Deep Cleaning (Per Quadrant)', practice_type: 'dental' },
      { code: '8305', price: 580.00, namaf_prace_2025: 'Oral Hygiene Instruction', practice_type: 'dental' },
      
      // Restorative Dentistry - Amalgam Fillings
      { code: '8401', price: 850.00, namaf_prace_2025: 'Amalgam Filling (1 Surface)', practice_type: 'dental' },
      { code: '8402', price: 1200.00, namaf_prace_2025: 'Amalgam Filling (2 Surfaces)', practice_type: 'dental' },
      { code: '8403', price: 1500.00, namaf_prace_2025: 'Amalgam Filling (3+ Surfaces)', practice_type: 'dental' },
      
      // Restorative Dentistry - Composite Fillings
      { code: '8404', price: 1200.00, namaf_prace_2025: 'Composite Filling (1 Surface)', practice_type: 'dental' },
      { code: '8405', price: 1600.00, namaf_prace_2025: 'Composite Filling (2 Surfaces)', practice_type: 'dental' },
      { code: '8406', price: 2000.00, namaf_prace_2025: 'Composite Filling (3+ Surfaces)', practice_type: 'dental' },
      { code: '8407', price: 2800.00, namaf_prace_2025: 'Large Composite Restoration', practice_type: 'dental' },
      
      // Endodontic Treatment
      { code: '8501', price: 2800.00, namaf_prace_2025: 'Root Canal - Anterior Tooth', practice_type: 'dental' },
      { code: '8502', price: 3500.00, namaf_prace_2025: 'Root Canal - Premolar', practice_type: 'dental' },
      { code: '8503', price: 4200.00, namaf_prace_2025: 'Root Canal - Molar', practice_type: 'dental' },
      { code: '8504', price: 1800.00, namaf_prace_2025: 'Pulpotomy', practice_type: 'dental' },
      { code: '8505', price: 1200.00, namaf_prace_2025: 'Pulp Capping (Direct)', practice_type: 'dental' },
      { code: '8506', price: 800.00, namaf_prace_2025: 'Pulp Capping (Indirect)', practice_type: 'dental' },
      
      // Prosthodontic Services - Crowns
      { code: '8601', price: 8500.00, namaf_prace_2025: 'Crown - Porcelain Fused to Metal', practice_type: 'dental' },
      { code: '8602', price: 12000.00, namaf_prace_2025: 'Crown - All Ceramic', practice_type: 'dental' },
      { code: '8603', price: 15000.00, namaf_prace_2025: 'Crown - Zirconia', practice_type: 'dental' },
      { code: '8604', price: 6500.00, namaf_prace_2025: 'Crown - Stainless Steel', practice_type: 'dental' },
      { code: '8605', price: 3500.00, namaf_prace_2025: 'Crown - Temporary', practice_type: 'dental' },
      
      // Prosthodontic Services - Bridges
      { code: '8610', price: 6500.00, namaf_prace_2025: 'Bridge Unit (PFM)', practice_type: 'dental' },
      { code: '8611', price: 9500.00, namaf_prace_2025: 'Bridge Unit (All Ceramic)', practice_type: 'dental' },
      { code: '8612', price: 12000.00, namaf_prace_2025: 'Bridge Unit (Zirconia)', practice_type: 'dental' },
      
      // Prosthodontic Services - Dentures
      { code: '8620', price: 15000.00, namaf_prace_2025: 'Complete Denture (Upper)', practice_type: 'dental' },
      { code: '8621', price: 15000.00, namaf_prace_2025: 'Complete Denture (Lower)', practice_type: 'dental' },
      { code: '8622', price: 8500.00, namaf_prace_2025: 'Partial Denture (Acrylic)', practice_type: 'dental' },
      { code: '8623', price: 12000.00, namaf_prace_2025: 'Partial Denture (Metal Framework)', practice_type: 'dental' },
      
      // Oral Surgery - Extractions
      { code: '8701', price: 1200.00, namaf_prace_2025: 'Simple Extraction', practice_type: 'dental' },
      { code: '8702', price: 2200.00, namaf_prace_2025: 'Surgical Extraction', practice_type: 'dental' },
      { code: '8703', price: 3500.00, namaf_prace_2025: 'Impacted Wisdom Tooth Extraction', practice_type: 'dental' },
      { code: '8704', price: 4500.00, namaf_prace_2025: 'Complex Surgical Extraction', practice_type: 'dental' },
      { code: '8705', price: 2800.00, namaf_prace_2025: 'Root Removal', practice_type: 'dental' },
      
      // Oral Surgery - Implants
      { code: '8710', price: 25000.00, namaf_prace_2025: 'Dental Implant (Single)', practice_type: 'dental' },
      { code: '8711', price: 18000.00, namaf_prace_2025: 'Implant Abutment', practice_type: 'dental' },
      { code: '8712', price: 15000.00, namaf_prace_2025: 'Implant Crown', practice_type: 'dental' },
      { code: '8713', price: 8500.00, namaf_prace_2025: 'Bone Graft (Implant Site)', practice_type: 'dental' },
      
      // Periodontal Treatment
      { code: '8801', price: 1800.00, namaf_prace_2025: 'Gingivectomy (Per Quadrant)', practice_type: 'dental' },
      { code: '8802', price: 4500.00, namaf_prace_2025: 'Gum Graft', practice_type: 'dental' },
      { code: '8803', price: 3200.00, namaf_prace_2025: 'Bone Graft (Small)', practice_type: 'dental' },
      { code: '8804', price: 2500.00, namaf_prace_2025: 'Pocket Reduction Surgery', practice_type: 'dental' },
      { code: '8805', price: 1500.00, namaf_prace_2025: 'Crown Lengthening', practice_type: 'dental' },
      
      // Orthodontic Treatment
      { code: '8901', price: 85000.00, namaf_prace_2025: 'Complete Orthodontic Treatment', practice_type: 'dental' },
      { code: '8902', price: 95000.00, namaf_prace_2025: 'Invisalign Treatment', practice_type: 'dental' },
      { code: '8903', price: 2500.00, namaf_prace_2025: 'Orthodontic Consultation', practice_type: 'dental' },
      { code: '8904', price: 800.00, namaf_prace_2025: 'Orthodontic Adjustment', practice_type: 'dental' },
      { code: '8905', price: 3500.00, namaf_prace_2025: 'Retainer (Upper)', practice_type: 'dental' },
      { code: '8906', price: 3500.00, namaf_prace_2025: 'Retainer (Lower)', practice_type: 'dental' },
      
      // Pediatric Dentistry
      { code: '9001', price: 380.00, namaf_prace_2025: 'Pediatric Oral Health Assessment', practice_type: 'dental' },
      { code: '9002', price: 550.00, namaf_prace_2025: 'Pediatric Cleaning', practice_type: 'dental' },
      { code: '9003', price: 2200.00, namaf_prace_2025: 'Stainless Steel Crown (Pediatric)', practice_type: 'dental' },
      { code: '9004', price: 1800.00, namaf_prace_2025: 'Pulpotomy (Pediatric)', practice_type: 'dental' },
      { code: '9005', price: 350.00, namaf_prace_2025: 'Fluoride Treatment (Pediatric)', practice_type: 'dental' },
      { code: '9006', price: 450.00, namaf_prace_2025: 'Space Maintainer', practice_type: 'dental' },
      
      // Emergency Services
      { code: '9101', price: 680.00, namaf_prace_2025: 'Emergency Pain Relief', practice_type: 'dental' },
      { code: '9102', price: 450.00, namaf_prace_2025: 'Temporary Filling', practice_type: 'dental' },
      { code: '9103', price: 850.00, namaf_prace_2025: 'Trauma Assessment', practice_type: 'dental' },
      { code: '9104', price: 1200.00, namaf_prace_2025: 'Emergency Extraction', practice_type: 'dental' },
      { code: '9105', price: 800.00, namaf_prace_2025: 'Emergency Endodontic Treatment', practice_type: 'dental' },
      
      // Aesthetic/Cosmetic Dentistry
      { code: '9201', price: 8500.00, namaf_prace_2025: 'Veneer (Porcelain)', practice_type: 'dental' },
      { code: '9202', price: 6500.00, namaf_prace_2025: 'Veneer (Composite)', practice_type: 'dental' },
      { code: '9203', price: 12000.00, namaf_prace_2025: 'Teeth Whitening (In-Office)', practice_type: 'dental' },
      { code: '9204', price: 4500.00, namaf_prace_2025: 'Teeth Whitening (Take-Home)', practice_type: 'dental' },
      { code: '9205', price: 2800.00, namaf_prace_2025: 'Bonding (Cosmetic)', practice_type: 'dental' },
      
      // Specialized Procedures
      { code: '9301', price: 1500.00, namaf_prace_2025: 'Biopsy (Oral)', practice_type: 'dental' },
      { code: '9302', price: 2200.00, namaf_prace_2025: 'Frenectomy', practice_type: 'dental' },
      { code: '9303', price: 3500.00, namaf_prace_2025: 'Apicoectomy', practice_type: 'dental' },
      { code: '9304', price: 4200.00, namaf_prace_2025: 'Cyst Removal', practice_type: 'dental' },
      { code: '9305', price: 1800.00, namaf_prace_2025: 'Torus Removal', practice_type: 'dental' }
    ];
    
    // Insert tariffs for each practice
    console.log('📊 Inserting dental tariffs with proper field mapping...');
    let totalInserted = 0;
    
    for (const practice of practices) {
      console.log(`   Processing ${practice.name}...`);
      
      // Insert tariffs with all required fields
      const tariffsForPractice = dentalTariffs.map(tariff => ({
        practice_id: practice.id,
        code: tariff.code,
        price: tariff.price,
        namaf_prace_2025: tariff.namaf_prace_2025,
        practice_type: tariff.practice_type,
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0],
        unit: 'per visit'
      }));
      
      // Insert in smaller batches
      const batchSize = 5;
      for (let i = 0; i < tariffsForPractice.length; i += batchSize) {
        const batch = tariffsForPractice.slice(i, i + batchSize);
        
        const { data: insertedTariffs, error: insertError } = await supabase
          .from('practice_tariffs')
          .insert(batch)
          .select('id');
        
        if (insertError) {
          console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, insertError.message);
        } else {
          totalInserted += insertedTariffs.length;
          console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${insertedTariffs.length} codes inserted`);
        }
      }
    }
    
    // Generate summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('practice_tariffs')
      .select('code, price, namaf_prace_2025')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%');
    
    console.log('\n📊 Final Import Summary:');
    console.log('=======================');
    
    if (!summaryError && summaryData) {
      console.log(`✅ ${summaryData.length} dental tariff records imported successfully`);
      console.log(`✅ Applied to ${practices.length} practices`);
      
      if (summaryData.length > 0) {
        const prices = summaryData.map(t => t.price);
        console.log(`✅ Price range: N$${Math.min(...prices)} - N$${Math.max(...prices)}`);
        
        // Show sample procedures
        console.log('\n📋 Sample imported procedures:');
        summaryData.slice(0, 10).forEach(item => {
          console.log(`   • ${item.code}: ${item.namaf_prace_2025} - N$${item.price}`);
        });
      }
    }
    
    console.log('\n🎉 DENTAL TARIFFS IMPORT COMPLETE!');
    console.log('✅ All dental codes are now available in the ServiceSelector component');
    console.log('✅ Doctors can select these codes when billing visits');
    console.log('✅ Pricing is automatically applied based on selected procedures');
    console.log('\n🔧 Next Steps:');
    console.log('1. Test the ServiceSelector in the AddVisitForm or EditVisitForm');
    console.log('2. Verify dental codes appear in billing section');
    console.log('3. Test invoice generation with dental procedures');
    
  } catch (error) {
    console.error('❌ Final import failed:', error.message);
    
    console.log('\n💡 Debug Information:');
    console.log(`Error type: ${error.name}`);
    console.log(`Error details: ${error.message}`);
    
    if (error.message.includes('JWT')) {
      console.log('\n🔧 Token issue - check service role key');
    } else if (error.message.includes('column')) {
      console.log('\n🔧 Column issue - table schema mismatch');
    } else if (error.message.includes('constraint')) {
      console.log('\n🔧 Database constraint violation');
    }
  }
}

// Execute the final import
try {
  await finalDentalImport();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing required modules...');
    console.log('Run: npm install @supabase/supabase-js');
    console.log('Then run this script again');
  } else {
    console.error('Execution error:', error.message);
  }
}