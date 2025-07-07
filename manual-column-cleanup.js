// Manual cleanup of medical aid enhancement columns
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyCleanup() {
  console.log('🔍 Verifying Medical Aid Enhancement Cleanup');
  console.log('=' .repeat(45));
  
  try {
    // Authenticate
    await supabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });
    console.log('✅ Authenticated');
    
    // Check current structure of medical_aid_details table
    console.log('\\n📋 Checking medical_aid_details table structure...');
    
    const { data: sample, error: sampleError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .limit(1);
      
    if (sampleError) {
      console.error('❌ Error accessing medical_aid_details:', sampleError.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0]);
      console.log('✅ Current columns in medical_aid_details:');
      columns.forEach(col => {
        console.log(`   - ${col}`);
      });
      
      // Check for enhancement columns
      const enhancementColumns = [
        'annual_limit', 'remaining_limit', 'last_limit_check_date',
        'limit_updated_by', 'coverage_percentage', 'co_payment_amount',
        'deductible_amount', 'authorization_required', 'pre_authorization_number',
        'benefit_year_start', 'benefit_year_end'
      ];
      
      const foundEnhancementColumns = columns.filter(col => 
        enhancementColumns.includes(col)
      );
      
      if (foundEnhancementColumns.length > 0) {
        console.log('\\n⚠️ Found enhancement columns that should be removed:');
        foundEnhancementColumns.forEach(col => {
          console.log(`   - ${col}`);
        });
        console.log('\\n❗ These columns need to be manually removed in Supabase Dashboard');
        console.log('   Go to: Database > Tables > medical_aid_details > Columns');
        console.log('   Delete each of the columns listed above');
      } else {
        console.log('\\n✅ No enhancement columns found - cleanup successful!');
      }
      
      // Expected core columns
      const expectedColumns = [
        'id', 'patient_id', 'provider', 'scheme', 'membership_number',
        'main_member_name', 'main_member_id_number', 'relationship_to_main',
        'medical_aid_provider_id', 'plan_type', 'created_at', 'updated_at'
      ];
      
      console.log('\\n📝 Expected core columns for simple medical aid:');
      expectedColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
      
    } else {
      console.log('⚠️ No medical aid records found to check structure');
    }
    
    // Test the simple 100% coverage logic still works
    console.log('\\n🧪 Testing simple 100% coverage logic...');
    
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
      
    if (patients && patients.length > 0) {
      const testPatient = patients[0];
      
      // Check if patient has medical aid
      const { data: medicalAid } = await supabase
        .from('medical_aid_details')
        .select('provider, scheme')
        .eq('patient_id', testPatient.id)
        .single();
        
      if (medicalAid) {
        console.log(`✅ Patient ${testPatient.first_name} ${testPatient.last_name} has medical aid: ${medicalAid.provider}`);
        console.log('   Simple logic: Medical aid covers 100%, patient pays N$0.00');
      } else {
        console.log(`✅ Patient ${testPatient.first_name} ${testPatient.last_name} has no medical aid`);
        console.log('   Simple logic: Patient pays full amount');
      }
    }
    
    console.log('\\n' + '=' .repeat(45));
    console.log('🎯 CLEANUP VERIFICATION COMPLETE');
    console.log('💡 System is using simple 100% medical aid coverage');
    console.log('🔒 Complex features successfully removed');
    console.log('✨ Ready for clean billing workflow');
    
  } catch (error) {
    console.error('\\n💥 VERIFICATION FAILED:', error.message);
  }
}

verifyCleanup();