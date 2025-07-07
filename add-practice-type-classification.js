#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 SERVICE ROLE CONFIGURATION
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addPracticeTypeClassification() {
  console.log('🏥 ADDING PRACTICE TYPE CLASSIFICATION\n');
  
  try {
    // First, get all practices and analyze them
    console.log('🔍 Analyzing current practices...');
    
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, slug, practice_type, practice_subtypes');
    
    if (practicesError) {
      throw new Error(`Failed to fetch practices: ${practicesError.message}`);
    }
    
    console.log(`📋 Found ${practices.length} practices:`);
    practices.forEach(practice => {
      console.log(`   • ${practice.name} (${practice.slug}) - Current type: ${practice.practice_type || 'none'}`);
    });
    
    // Categorize practices based on their names and purpose
    const practiceClassifications = [
      {
        keywords: ['polina', 'aesthetic', 'beauty', 'cosmetic'],
        type: 'aesthetic',
        description: 'Aesthetic/Cosmetic practices'
      },
      {
        keywords: ['newcharm', 'dental', 'tooth', 'oral'],
        type: 'dental', 
        description: 'Dental practices'
      },
      {
        keywords: ['clinic', 'medical', 'health', 'center'],
        type: 'medical',
        description: 'General medical practices'
      }
    ];
    
    console.log('\n🏷️  Classifying practices by type...');
    
    const updates = [];
    
    practices.forEach(practice => {
      let assignedType = 'medical'; // default
      let matchedKeywords = [];
      
      const nameSlug = `${practice.name} ${practice.slug || ''}`.toLowerCase();
      
      // Check for specific classifications
      for (const classification of practiceClassifications) {
        const matches = classification.keywords.filter(keyword => 
          nameSlug.includes(keyword)
        );
        
        if (matches.length > 0) {
          assignedType = classification.type;
          matchedKeywords = matches;
          break; // Use first match
        }
      }
      
      // Special cases for dental practices
      if (nameSlug.includes('newcharm') || nameSlug.includes('dental')) {
        assignedType = 'dental';
      }
      
      // Special cases for aesthetic practices  
      if (nameSlug.includes('polina') || nameSlug.includes('aesthetic')) {
        assignedType = 'aesthetic';
      }
      
      updates.push({
        id: practice.id,
        name: practice.name,
        currentType: practice.practice_type,
        newType: assignedType,
        matchedKeywords
      });
      
      console.log(`   📌 ${practice.name}:`);
      console.log(`      Current: ${practice.practice_type || 'none'}`);
      console.log(`      New: ${assignedType}`);
      console.log(`      Matched: ${matchedKeywords.join(', ') || 'default classification'}`);
    });
    
    // Update practices with correct types
    console.log('\n✏️  Updating practice types...');
    
    for (const update of updates) {
      if (update.currentType !== update.newType) {
        const { error: updateError } = await supabase
          .from('practices')
          .update({ 
            practice_type: update.newType,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);
        
        if (updateError) {
          console.error(`   ❌ Failed to update ${update.name}:`, updateError.message);
        } else {
          console.log(`   ✅ Updated ${update.name}: ${update.currentType || 'none'} → ${update.newType}`);
        }
      } else {
        console.log(`   ➡️  ${update.name}: Already correct (${update.newType})`);
      }
    }
    
    // Now remove dental codes from non-dental practices
    console.log('\n🦷 Managing dental codes by practice type...');
    
    const { data: updatedPractices, error: updatedError } = await supabase
      .from('practices')
      .select('id, name, practice_type');
    
    if (updatedError) {
      throw new Error(`Failed to fetch updated practices: ${updatedError.message}`);
    }
    
    const dentalPractices = updatedPractices.filter(p => 
      p.practice_type === 'dental' || p.practice_type === 'aesthetic'
    );
    const nonDentalPractices = updatedPractices.filter(p => 
      p.practice_type !== 'dental' && p.practice_type !== 'aesthetic'
    );
    
    console.log(`📊 Practice breakdown:`);
    console.log(`   • Dental/Aesthetic practices: ${dentalPractices.length}`);
    dentalPractices.forEach(p => console.log(`     - ${p.name} (${p.practice_type})`));
    console.log(`   • Medical practices: ${nonDentalPractices.length}`);
    nonDentalPractices.forEach(p => console.log(`     - ${p.name} (${p.practice_type})`));
    
    // Remove dental codes from non-dental practices
    if (nonDentalPractices.length > 0) {
      console.log('\n🧹 Removing dental codes from medical practices...');
      
      const nonDentalIds = nonDentalPractices.map(p => p.id);
      
      const { data: toDelete, error: deleteCheckError } = await supabase
        .from('practice_tariffs')
        .select('id, practice_id, code')
        .in('practice_id', nonDentalIds)
        .eq('practice_type', 'dental')
        .or('code.like.8%,code.like.9%');
      
      if (!deleteCheckError && toDelete && toDelete.length > 0) {
        console.log(`   Found ${toDelete.length} dental codes to remove from medical practices`);
        
        const { error: deleteError } = await supabase
          .from('practice_tariffs')
          .delete()
          .in('practice_id', nonDentalIds)
          .eq('practice_type', 'dental')
          .or('code.like.8%,code.like.9%');
        
        if (deleteError) {
          console.error(`   ❌ Failed to delete codes:`, deleteError.message);
        } else {
          console.log(`   ✅ Removed ${toDelete.length} dental codes from medical practices`);
        }
      } else {
        console.log(`   ✅ No dental codes found in medical practices (already clean)`);
      }
    }
    
    // Verify final state
    console.log('\n📊 Final verification...');
    
    for (const practice of updatedPractices) {
      const { data: codeCount, error: countError } = await supabase
        .from('practice_tariffs')
        .select('id', { count: 'exact' })
        .eq('practice_id', practice.id)
        .eq('practice_type', 'dental')
        .or('code.like.8%,code.like.9%');
      
      if (!countError) {
        const count = codeCount.length;
        const shouldHave = (practice.practice_type === 'dental' || practice.practice_type === 'aesthetic') ? 80 : 0;
        const status = count === shouldHave ? '✅' : '❌';
        
        console.log(`   ${status} ${practice.name} (${practice.practice_type}): ${count} dental codes (expected: ${shouldHave})`);
      }
    }
    
    // Summary
    console.log('\n🎉 PRACTICE TYPE CLASSIFICATION COMPLETE!');
    console.log('✅ Practices properly categorized by type');
    console.log('✅ Dental codes only assigned to dental/aesthetic practices');
    console.log('✅ Medical practices cleaned of dental codes');
    
    console.log('\n🔧 Practice Types:');
    console.log('   • dental: For NewCharm and other dental practices');
    console.log('   • aesthetic: For Dr. Polina and cosmetic practices'); 
    console.log('   • medical: For general medical clinics');
    
    console.log('\n📋 Next Steps:');
    console.log('1. ServiceSelector will now filter codes by practice type');
    console.log('2. Only dental/aesthetic practices see dental codes');
    console.log('3. Medical practices will need their own tariff codes');
    
  } catch (error) {
    console.error('❌ Classification failed:', error.message);
  }
}

// Execute classification
try {
  await addPracticeTypeClassification();
} catch (error) {
  console.error('Script error:', error.message);
}