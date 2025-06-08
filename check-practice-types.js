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

async function checkPracticeTypes() {
  console.log('🔍 CHECKING CURRENT PRACTICE TYPES\n');
  
  try {
    // Get all practices with their types and dental code counts
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, slug, practice_type, practice_subtypes');
    
    if (practicesError) {
      throw new Error(`Failed to fetch practices: ${practicesError.message}`);
    }
    
    console.log(`📋 Current Practice Setup:`);
    console.log('=========================');
    
    for (const practice of practices) {
      console.log(`\n🏥 ${practice.name}`);
      console.log(`   Slug: ${practice.slug}`);
      console.log(`   Type: ${practice.practice_type || 'none'}`);
      console.log(`   Subtypes: ${practice.practice_subtypes || 'none'}`);
      
      // Count dental codes for this practice
      const { data: codeCount, error: countError } = await supabase
        .from('practice_tariffs')
        .select('id', { count: 'exact' })
        .eq('practice_id', practice.id)
        .eq('practice_type', 'dental')
        .or('code.like.8%,code.like.9%');
      
      if (!countError) {
        const shouldHave = (practice.practice_type === 'dental' || practice.practice_type === 'aesthetic') ? 80 : 0;
        const status = codeCount.length === shouldHave ? '✅' : '❌';
        console.log(`   ${status} Dental codes: ${codeCount.length} (expected: ${shouldHave})`);
      }
    }
    
    // Show summary by type
    console.log('\n📊 Summary by Practice Type:');
    console.log('============================');
    
    const typeGroups = {};
    practices.forEach(practice => {
      const type = practice.practice_type || 'none';
      if (!typeGroups[type]) {
        typeGroups[type] = [];
      }
      typeGroups[type].push(practice);
    });
    
    Object.entries(typeGroups).forEach(([type, practiceList]) => {
      console.log(`\n🏷️  ${type.toUpperCase()} (${practiceList.length} practices):`);
      practiceList.forEach(p => {
        console.log(`   • ${p.name}`);
      });
    });
    
    // Recommendations
    console.log('\n💡 Recommendations for ServiceSelector:');
    console.log('======================================');
    
    const dentalPractices = practices.filter(p => p.practice_type === 'dental' || p.practice_type === 'aesthetic');
    const medicalPractices = practices.filter(p => p.practice_type === 'medical');
    
    console.log(`✅ DENTAL/AESTHETIC practices (${dentalPractices.length}): Show dental codes (8xxx, 9xxx)`);
    dentalPractices.forEach(p => console.log(`   - ${p.name}`));
    
    console.log(`\n🏥 MEDICAL practices (${medicalPractices.length}): Show general medical codes (need to be added)`);
    medicalPractices.forEach(p => console.log(`   - ${p.name}`));
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Update ServiceSelector to filter by practice type');
    console.log('2. Only show dental codes for dental/aesthetic practices');
    console.log('3. Add general medical tariff codes for medical practices');
    console.log('4. Test ServiceSelector with practice-specific filtering');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

// Execute check
try {
  await checkPracticeTypes();
} catch (error) {
  console.error('Script error:', error.message);
}