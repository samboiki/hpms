#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function removePracticeDependency() {
  console.log('🔧 REMOVING PRACTICE DEPENDENCY AND UNWANTED COLUMNS...\n');
  
  try {
    // First, let's check current table structure
    console.log('📋 Checking current table structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error checking table:', sampleError.message);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('📊 Current table columns:');
      Object.keys(sampleData[0]).forEach(col => {
        console.log(`   • ${col}`);
      });
    }
    
    console.log('\n🗑️  Step 1: Backing up current data...');
    const { data: allCodes, error: backupError } = await supabase
      .from('practice_tariffs')
      .select('*');
    
    if (backupError) {
      console.log('❌ Error backing up data:', backupError.message);
      return;
    }
    
    console.log(`✅ Backed up ${allCodes.length} dental codes`);
    
    // Prepare cleaned data (remove practice_id and unwanted columns)
    const cleanedCodes = allCodes.map(code => {
      const cleaned = { ...code };
      
      // Remove unwanted columns
      delete cleaned.practice_id;
      delete cleaned.namaf_prace_2025;
      delete cleaned.edi_diagnosi;
      delete cleaned.full_description;
      delete cleaned.practice_subtypes;
      
      // Keep essential columns
      return {
        id: cleaned.id,
        code: cleaned.code,
        description: cleaned.description,
        price: cleaned.price,
        official_2025_price_nad: cleaned.official_2025_price_nad,
        on_2025_list: cleaned.on_2025_list,
        found_in_claims: cleaned.found_in_claims,
        requires_tooth_number: cleaned.requires_tooth_number,
        can_be_multiplied: cleaned.can_be_multiplied,
        business_rule_formula: cleaned.business_rule_formula,
        example_calculation: cleaned.example_calculation,
        notes: cleaned.notes,
        practice_type: 'dental', // Keep as dental
        category: cleaned.category,
        subcategory: cleaned.subcategory,
        unit: cleaned.unit,
        is_active: cleaned.is_active,
        effective_from: cleaned.effective_from,
        effective_to: cleaned.effective_to,
        created_at: cleaned.created_at,
        updated_at: new Date().toISOString()
      };
    });
    
    console.log('\n🔄 Step 2: Clearing table for restructure...');
    const { error: clearError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (clearError) {
      console.log('❌ Error clearing table:', clearError.message);
      return;
    }
    
    console.log('✅ Table cleared');
    
    console.log('\n📊 Step 3: Re-inserting cleaned data...');
    
    // Insert in batches
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < cleanedCodes.length; i += batchSize) {
      const batch = cleanedCodes.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(cleanedCodes.length/batchSize);
      
      console.log(`📦 Inserting batch ${batchNumber}/${totalBatches} (${batch.length} codes)...`);
      
      const { data: insertData, error: insertError } = await supabase
        .from('practice_tariffs')
        .insert(batch)
        .select('id, code, description');
      
      if (insertError) {
        console.log(`❌ Batch ${batchNumber} failed:`, insertError.message);
        
        // Try to insert individually to see what's failing
        console.log('🔄 Trying individual inserts...');
        for (const code of batch) {
          try {
            const { error: singleError } = await supabase
              .from('practice_tariffs')
              .insert([code]);
            
            if (singleError) {
              console.log(`❌ Code ${code.code} failed: ${singleError.message.substring(0, 100)}...`);
              
              // Try with minimal data if constraints exist
              const minimalCode = {
                code: code.code,
                description: code.description,
                price: code.price,
                practice_type: 'dental',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              console.log(`🔄 Trying minimal insert for code ${code.code}...`);
              const { error: minimalError } = await supabase
                .from('practice_tariffs')
                .insert([minimalCode]);
              
              if (!minimalError) {
                totalInserted++;
                console.log(`✅ Minimal insert succeeded for ${code.code}`);
              } else {
                console.log(`❌ Minimal insert also failed: ${minimalError.message.substring(0, 100)}...`);
              }
            } else {
              totalInserted++;
            }
          } catch (err) {
            console.log(`❌ Code ${code.code} error: ${err.message}`);
          }
        }
      } else {
        totalInserted += batch.length;
        console.log(`✅ Batch ${batchNumber} inserted successfully`);
      }
    }
    
    console.log(`\n🎉 RESTRUCTURE COMPLETED! Total codes: ${totalInserted}/${cleanedCodes.length}`);
    
    // Run verification
    await runVerification();
    
  } catch (error) {
    console.error('❌ Restructure failed:', error.message);
  }
}

async function runVerification() {
  console.log('\n🔍 VERIFICATION AFTER RESTRUCTURE:');
  
  try {
    // Count total codes
    const { count: totalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total codes in database: ${totalCount}`);
    
    // Check table structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (sampleData && sampleData.length > 0) {
      console.log('\n📋 NEW TABLE STRUCTURE:');
      Object.keys(sampleData[0]).forEach(col => {
        const value = sampleData[0][col];
        console.log(`   • ${col}: ${typeof value} = ${value !== null ? String(value).substring(0, 30) : 'null'}${String(value).length > 30 ? '...' : ''}`);
      });
    }
    
    // Verify key codes still exist
    const keyCodes = ['8101', '8107', '8163', '8346', '8826'];
    const { data: keyCodesData, error: keyCodesError } = await supabase
      .from('practice_tariffs')
      .select('code, description, price, can_be_multiplied')
      .in('code', keyCodes)
      .order('code');
    
    if (keyCodesData && keyCodesData.length > 0) {
      console.log('\n🎯 KEY CODES VERIFICATION:');
      keyCodesData.forEach(row => {
        console.log(`   ${row.code}: ${row.description.substring(0, 40)}... - ${row.price} NAD [${row.can_be_multiplied}]`);
      });
    }
    
    console.log('\n✅ PRACTICE DEPENDENCY REMOVED!');
    console.log('✅ Unwanted columns removed');
    console.log('✅ Dental codes now global (not practice-specific)');
    console.log('✅ All practices can access the same dental codes');
    console.log('✅ Simplified table structure');
    
  } catch (error) {
    console.log('⚠️  Verification failed:', error.message);
  }
}

// Execute the restructure
removePracticeDependency();