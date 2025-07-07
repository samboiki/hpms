#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 CORRECT SERVICE ROLE CONFIGURATION
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function serviceRoleDentalImport() {
  console.log('🦷 SERVICE ROLE: Importing dental tariffs...\n');
  
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
    
    // Get all practices
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name');
    
    if (practicesError) {
      throw new Error(`Failed to fetch practices: ${practicesError.message}`);
    }
    
    console.log(`📋 Found ${practices.length} practices`);
    
    if (practices.length === 0) {
      console.log('❌ No practices found. Creating default practice...');
      
      const { data: newPractice, error: createError } = await supabase
        .from('practices')
        .insert([{
          name: 'Default Dental Practice',
          slug: 'default-dental',
          email: 'admin@dentalpractice.com',
          phone: '+264-61-123456',
          address: '123 Main Street',
          city: 'Windhoek',
          practice_type: 'dental'
        }])
        .select()
        .single();
      
      if (createError) {
        throw new Error(`Failed to create practice: ${createError.message}`);
      }
      
      practices.push(newPractice);
      console.log('✅ Default practice created');
    }
    
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
    
    // Comprehensive dental tariffs data
    const dentalTariffs = [
      // Consultations & Examinations
      { code: '8101', price: 450.00, name: 'Oral Health Assessment', description: 'Comprehensive oral health assessment including medical history and treatment planning', category: 'Consultation', subcategory: 'Examination', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'moderate' },
      { code: '8102', price: 350.00, name: 'Limited Oral Examination', description: 'Problem-focused oral examination for specific complaint', category: 'Consultation', subcategory: 'Examination', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'simple' },
      { code: '8103', price: 500.00, name: 'Emergency Oral Examination', description: 'Emergency examination for acute dental problems', category: 'Emergency', subcategory: 'Examination', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'moderate' },
      { code: '8104', price: 200.00, name: 'Follow-up Examination', description: 'Routine follow-up examination post-treatment', category: 'Consultation', subcategory: 'Follow-up', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'simple' },
      
      // Diagnostic Procedures
      { code: '8201', price: 180.00, name: 'Intraoral Radiograph (Single)', description: 'Single periapical or bitewing radiograph', category: 'Diagnostic', subcategory: 'Radiography', multiplication_rule: 'YES', tooth_number_required: false, unit: 'per_film', complexity: 'simple' },
      { code: '8202', price: 320.00, name: 'Bitewing Radiographs (Set)', description: 'Full mouth bitewing radiographic series', category: 'Diagnostic', subcategory: 'Radiography', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_set', complexity: 'moderate' },
      { code: '8203', price: 850.00, name: 'Panoramic Radiograph', description: 'Panoramic radiographic examination', category: 'Diagnostic', subcategory: 'Radiography', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'moderate' },
      { code: '8204', price: 2500.00, name: 'CBCT Scan (Limited)', description: 'Cone beam computed tomography - limited area', category: 'Diagnostic', subcategory: 'Advanced Imaging', multiplication_rule: 'SOMETIMES', tooth_number_required: false, unit: 'per_scan', complexity: 'complex' },
      { code: '8205', price: 4200.00, name: 'CBCT Scan (Full Mouth)', description: 'Cone beam computed tomography - full mouth', category: 'Diagnostic', subcategory: 'Advanced Imaging', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_scan', complexity: 'complex' },
      
      // Preventive Services
      { code: '8301', price: 650.00, name: 'Professional Dental Cleaning', description: 'Prophylaxis including scaling and polishing', category: 'Preventive', subcategory: 'Cleaning', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'simple' },
      { code: '8302', price: 380.00, name: 'Fluoride Treatment', description: 'Professional fluoride application', category: 'Preventive', subcategory: 'Fluoride', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_treatment', complexity: 'simple' },
      { code: '8303', price: 450.00, name: 'Dental Sealant', description: 'Pit and fissure sealant application per tooth', category: 'Preventive', subcategory: 'Sealants', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'simple' },
      { code: '8304', price: 1200.00, name: 'Deep Cleaning (Per Quadrant)', description: 'Scaling and root planing per quadrant', category: 'Preventive', subcategory: 'Deep Cleaning', multiplication_rule: 'YES', tooth_number_required: false, unit: 'per_quadrant', complexity: 'moderate' },
      { code: '8305', price: 580.00, name: 'Oral Hygiene Instruction', description: 'Comprehensive oral hygiene education and instruction', category: 'Preventive', subcategory: 'Education', multiplication_rule: 'NO', tooth_number_required: false, unit: 'per_visit', complexity: 'simple' },
      
      // Restorative Dentistry - Amalgam Fillings
      { code: '8401', price: 850.00, name: 'Amalgam Filling (1 Surface)', description: 'Amalgam restoration - single surface', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'simple' },
      { code: '8402', price: 1200.00, name: 'Amalgam Filling (2 Surfaces)', description: 'Amalgam restoration - two surfaces', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8403', price: 1500.00, name: 'Amalgam Filling (3+ Surfaces)', description: 'Amalgam restoration - three or more surfaces', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      
      // Restorative Dentistry - Composite Fillings
      { code: '8404', price: 1200.00, name: 'Composite Filling (1 Surface)', description: 'Composite resin restoration - single surface', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8405', price: 1600.00, name: 'Composite Filling (2 Surfaces)', description: 'Composite resin restoration - two surfaces', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8406', price: 2000.00, name: 'Composite Filling (3+ Surfaces)', description: 'Composite resin restoration - three or more surfaces', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8407', price: 2800.00, name: 'Large Composite Restoration', description: 'Large composite restoration with cusp coverage', category: 'Restorative', subcategory: 'Fillings', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      
      // Endodontic Treatment
      { code: '8501', price: 2800.00, name: 'Root Canal - Anterior Tooth', description: 'Endodontic treatment - anterior tooth', category: 'Endodontic', subcategory: 'Root Canal', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8502', price: 3500.00, name: 'Root Canal - Premolar', description: 'Endodontic treatment - premolar tooth', category: 'Endodontic', subcategory: 'Root Canal', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8503', price: 4200.00, name: 'Root Canal - Molar', description: 'Endodontic treatment - molar tooth', category: 'Endodontic', subcategory: 'Root Canal', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8504', price: 1800.00, name: 'Pulpotomy', description: 'Partial pulp removal - vital pulpotomy', category: 'Endodontic', subcategory: 'Pulp Treatment', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8505', price: 1200.00, name: 'Pulp Capping (Direct)', description: 'Direct pulp capping procedure', category: 'Endodontic', subcategory: 'Pulp Treatment', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8506', price: 800.00, name: 'Pulp Capping (Indirect)', description: 'Indirect pulp capping procedure', category: 'Endodontic', subcategory: 'Pulp Treatment', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'simple' },
      
      // Prosthodontic Services - Crowns
      { code: '8601', price: 8500.00, name: 'Crown - Porcelain Fused to Metal', description: 'Single crown - porcelain fused to metal', category: 'Prosthodontic', subcategory: 'Crowns', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8602', price: 12000.00, name: 'Crown - All Ceramic', description: 'Single crown - all ceramic/porcelain', category: 'Prosthodontic', subcategory: 'Crowns', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8603', price: 15000.00, name: 'Crown - Zirconia', description: 'Single crown - zirconia', category: 'Prosthodontic', subcategory: 'Crowns', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'complex' },
      { code: '8604', price: 6500.00, name: 'Crown - Stainless Steel', description: 'Stainless steel crown (usually pediatric)', category: 'Prosthodontic', subcategory: 'Crowns', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'moderate' },
      { code: '8605', price: 3500.00, name: 'Crown - Temporary', description: 'Temporary crown while permanent is being made', category: 'Prosthodontic', subcategory: 'Crowns', multiplication_rule: 'YES', tooth_number_required: true, unit: 'per_tooth', complexity: 'simple' }
    ];
    
    // Insert tariffs for each practice
    console.log('📊 Inserting dental tariffs...');
    let totalInserted = 0;
    
    for (const practice of practices) {
      const tariffsForPractice = dentalTariffs.map(tariff => ({
        ...tariff,
        practice_id: practice.id,
        is_active: true
      }));
      
      const { data: insertedTariffs, error: insertError } = await supabase
        .from('practice_tariffs')
        .insert(tariffsForPractice)
        .select('id');
      
      if (insertError) {
        console.error(`❌ Failed to insert tariffs for ${practice.name}:`, insertError.message);
        continue;
      }
      
      totalInserted += insertedTariffs.length;
      console.log(`✅ Inserted ${insertedTariffs.length} tariffs for ${practice.name}`);
    }
    
    // Generate summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('practice_tariffs')
      .select('category')
      .or('code.like.8%,code.like.9%');
    
    if (!summaryError) {
      const categoryCount = summaryData.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n📊 Import Summary:');
      console.log('==================');
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`${category}: ${count} procedures`);
      });
    }
    
    console.log('\n🎉 IMPORT COMPLETE!');
    console.log(`✅ ${totalInserted} dental tariff records imported`);
    console.log(`✅ Applied to ${practices.length} practices`);
    console.log('✅ All tariffs are now available in the ServiceSelector component');
    
  } catch (error) {
    console.error('❌ Service role import failed:', error.message);
    
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

// Execute the import
try {
  await serviceRoleDentalImport();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing required modules...');
    console.log('Run: npm install @supabase/supabase-js');
    console.log('Then run this script again');
  } else {
    console.error('Execution error:', error.message);
  }
}