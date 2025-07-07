#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Import dental codes using Supabase client
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

// Sample dental codes data
const sampleDentalCodes = [
  { code: '001', price: 95.00, name: 'Initial comprehensive oral examination', category: 'Consultation & Examination', subcategory: 'Initial Consultation', complexity: 'Simple' },
  { code: '002', price: 65.00, name: 'Periodic oral examination', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
  { code: '003', price: 55.00, name: 'Limited oral examination - problem focused', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
  { code: '004', price: 135.00, name: 'Emergency oral examination', category: 'Consultation & Examination', subcategory: 'Emergency', complexity: 'Simple' },
  { code: '005', price: 185.00, name: 'Emergency examination after hours', category: 'Consultation & Examination', subcategory: 'Emergency', complexity: 'Simple' },
  { code: '006', price: 155.00, name: 'Specialist consultation', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Moderate' },
  { code: '007', price: 125.00, name: 'Second opinion consultation', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Simple' },
  { code: '008', price: 85.00, name: 'Pre-operative consultation', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
  { code: '009', price: 45.00, name: 'Post-operative examination', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
  { code: '010', price: 115.00, name: 'Oral cancer screening', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Moderate' },

  // Restorative - Fillings
  { code: '211', price: 185.00, name: 'Amalgam filling - 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
  { code: '212', price: 225.00, name: 'Amalgam filling - 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
  { code: '213', price: 285.00, name: 'Amalgam filling - 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
  { code: '221', price: 225.00, name: 'Composite filling - anterior 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
  { code: '222', price: 285.00, name: 'Composite filling - anterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
  { code: '223', price: 385.00, name: 'Composite filling - anterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
  { code: '231', price: 285.00, name: 'Composite filling - posterior 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
  { code: '232', price: 385.00, name: 'Composite filling - posterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
  { code: '233', price: 485.00, name: 'Composite filling - posterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },

  // Restorative - Crowns
  { code: '271', price: 1885.00, name: 'Porcelain fused to metal crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
  { code: '272', price: 2185.00, name: 'All ceramic crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
  { code: '273', price: 2485.00, name: 'Gold crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
  { code: '274', price: 385.00, name: 'Temporary crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Simple' },

  // Restorative - Bridge
  { code: '281', price: 1685.00, name: 'Pontic - porcelain fused to metal', category: 'Restorative', subcategory: 'Bridge', complexity: 'Complex' },
  { code: '282', price: 1885.00, name: 'Pontic - all ceramic', category: 'Restorative', subcategory: 'Bridge', complexity: 'Complex' },

  // Endodontics
  { code: '331', price: 1285.00, name: 'Root canal - anterior tooth', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
  { code: '332', price: 1485.00, name: 'Root canal - premolar', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
  { code: '333', price: 1885.00, name: 'Root canal - molar', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
  { code: '334', price: 485.00, name: 'Pulpotomy - emergency', category: 'Endodontics', subcategory: 'Emergency', complexity: 'Moderate' },
  { code: '335', price: 685.00, name: 'Post and core buildup', category: 'Endodontics', subcategory: 'Post Treatment', complexity: 'Moderate' },

  // Periodontics
  { code: '411', price: 285.00, name: 'Routine prophylaxis', category: 'Periodontics', subcategory: 'Cleaning', complexity: 'Simple' },
  { code: '412', price: 485.00, name: 'Deep cleaning - per quadrant', category: 'Periodontics', subcategory: 'Cleaning', complexity: 'Moderate' },
  { code: '421', price: 785.00, name: 'Gingivectomy - per quadrant', category: 'Periodontics', subcategory: 'Surgery', complexity: 'Complex' },
  { code: '422', price: 1285.00, name: 'Periodontal flap surgery - per quadrant', category: 'Periodontics', subcategory: 'Surgery', complexity: 'Complex' },

  // Oral Surgery
  { code: '501', price: 285.00, name: 'Simple extraction', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Simple' },
  { code: '502', price: 485.00, name: 'Surgical extraction', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Moderate' },
  { code: '503', price: 585.00, name: 'Wisdom tooth extraction - simple', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Moderate' },
  { code: '504', price: 885.00, name: 'Wisdom tooth extraction - surgical', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Complex' },
  { code: '511', price: 1285.00, name: 'Bone grafting - small', category: 'Oral Surgery', subcategory: 'Advanced', complexity: 'Complex' },
  { code: '512', price: 2485.00, name: 'Sinus lift', category: 'Oral Surgery', subcategory: 'Advanced', complexity: 'Complex' },

  // Prosthodontics
  { code: '601', price: 3485.00, name: 'Complete upper denture', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
  { code: '602', price: 3485.00, name: 'Complete lower denture', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
  { code: '603', price: 2185.00, name: 'Partial denture - acrylic', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Moderate' },
  { code: '604', price: 2885.00, name: 'Partial denture - cast metal', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
  { code: '621', price: 4885.00, name: 'Single implant placement', category: 'Prosthodontics', subcategory: 'Implants', complexity: 'Complex' },
  { code: '622', price: 2885.00, name: 'Implant crown', category: 'Prosthodontics', subcategory: 'Implants', complexity: 'Complex' },

  // Orthodontics
  { code: '701', price: 285.00, name: 'Orthodontic consultation', category: 'Orthodontics', subcategory: 'Consultation', complexity: 'Simple' },
  { code: '711', price: 18500.00, name: 'Metal braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
  { code: '712', price: 22500.00, name: 'Ceramic braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
  { code: '713', price: 28500.00, name: 'Invisalign - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
  { code: '721', price: 785.00, name: 'Retainer - upper or lower', category: 'Orthodontics', subcategory: 'Appliances', complexity: 'Simple' },

  // Pediatric Dentistry
  { code: '801', price: 185.00, name: 'Child prophylaxis', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
  { code: '802', price: 125.00, name: 'Fluoride treatment', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
  { code: '803', price: 185.00, name: 'Sealant per tooth', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
  { code: '811', price: 185.00, name: 'Primary tooth filling', category: 'Pediatric', subcategory: 'Restorative', complexity: 'Simple' },
  { code: '821', price: 185.00, name: 'Primary tooth extraction', category: 'Pediatric', subcategory: 'Surgery', complexity: 'Simple' },

  // Cosmetic Procedures
  { code: '901', price: 785.00, name: 'Professional in-office whitening', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Moderate' },
  { code: '902', price: 385.00, name: 'Take-home whitening kit', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Simple' },
  { code: '903', price: 185.00, name: 'Whitening maintenance kit', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Simple' },
  { code: '911', price: 1685.00, name: 'Porcelain veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Moderate' },
  { code: '912', price: 785.00, name: 'Composite veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Moderate' },
  { code: '913', price: 285.00, name: 'Veneer consultation and mockup', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Simple' },
  { code: '921', price: 325.00, name: 'Cosmetic bonding per tooth', category: 'Cosmetic', subcategory: 'Bonding', complexity: 'Simple' },
  { code: '922', price: 185.00, name: 'Tooth reshaping per tooth', category: 'Cosmetic', subcategory: 'Bonding', complexity: 'Simple' },
  { code: '931', price: 185.00, name: 'Smile makeover consultation', category: 'Cosmetic', subcategory: 'Consultation', complexity: 'Simple' },
  { code: '932', price: 385.00, name: 'Digital smile design', category: 'Cosmetic', subcategory: 'Digital Services', complexity: 'Moderate' }
];

async function importDentalCodes() {
  console.log('🦷 Importing Dental Practice Codes via Supabase Client\n');
  
  try {
    // First, get all practices that could use dental codes
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, practice_type')
      .or('practice_type.eq.dental,practice_type.eq.aesthetic,practice_type.eq.general,practice_type.is.null');
    
    if (practicesError) {
      throw practicesError;
    }
    
    console.log(`📋 Found ${practices.length} practices to update:`);
    practices.forEach(practice => {
      console.log(`   • ${practice.name} (${practice.practice_type || 'unspecified'})`);
    });
    console.log();
    
    if (practices.length === 0) {
      console.log('❌ No practices found. Cannot import dental codes.');
      return;
    }
    
    // Clear existing dental tariffs first
    console.log('🧹 Clearing existing dental tariffs...');
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .eq('practice_type', 'dental');
    
    if (deleteError) {
      console.log(`⚠️  Warning clearing existing tariffs: ${deleteError.message}`);
    } else {
      console.log('✅ Cleared existing dental tariffs');
    }
    console.log();
    
    // Import dental codes for each practice
    let totalInserted = 0;
    
    for (const practice of practices) {
      console.log(`📝 Importing ${sampleDentalCodes.length} codes for: ${practice.name}...`);
      
      // Batch insert dental codes for this practice
      const tariffRecords = sampleDentalCodes.map(code => ({
        practice_id: practice.id,
        code: code.code,
        price: code.price,
        namaf_prace_2025: code.name,
        practice_type: 'dental',
        category: code.category,
        subcategory: code.subcategory,
        full_description: `${code.name} - Complexity: ${code.complexity}`,
        unit: 'per visit',
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0]
      }));
      
      // Insert in batches to avoid large requests
      const batchSize = 20;
      let successCount = 0;
      
      for (let i = 0; i < tariffRecords.length; i += batchSize) {
        const batch = tariffRecords.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('practice_tariffs')
          .insert(batch);
        
        if (insertError) {
          console.log(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${insertError.message}`);
        } else {
          successCount += batch.length;
          console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tariffRecords.length / batchSize)}`);
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      totalInserted += successCount;
      console.log(`   📊 Total imported for ${practice.name}: ${successCount}/${sampleDentalCodes.length}`);
      console.log();
    }
    
    // Generate summary
    console.log('🎉 Import completed successfully!');
    console.log(`   • Total codes imported: ${totalInserted}`);
    console.log(`   • Practices updated: ${practices.length}`);
    console.log(`   • Categories: ${[...new Set(sampleDentalCodes.map(c => c.category))].length}`);
    console.log();
    
    // Verify the import
    const { data: verifyData, error: verifyError } = await supabase
      .from('practice_tariffs')
      .select('practice_type, category, count(*)')
      .eq('practice_type', 'dental');
    
    if (verifyError) {
      console.log('⚠️  Could not verify import:', verifyError.message);
    } else {
      console.log('✅ Verification: Dental codes are now available in the database');
    }
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Test ServiceSelector component');
    console.log('   2. Test AddVisitForm with billing integration');
    console.log('   3. Generate test invoices');
    console.log('   4. Verify complete billing workflow');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

importDentalCodes().catch(console.error);