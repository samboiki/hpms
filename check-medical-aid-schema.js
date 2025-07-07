// Check actual medical_aid_details table schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  try {
    console.log('🔍 Checking medical_aid_details table schema...');
    
    // Get a sample record to see actual field names
    const { data: sampleRecords, error } = await supabase
      .from('medical_aid_details')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ Error fetching sample record:', error);
      return;
    }
    
    if (!sampleRecords || sampleRecords.length === 0) {
      console.log('❌ No records found in medical_aid_details table');
      return;
    }
    
    const sampleRecord = sampleRecords[0];
    console.log('✅ Sample record structure:');
    console.log('Fields available:', Object.keys(sampleRecord));
    
    // Check specific fields we're concerned about
    const fieldsToCheck = [
      'member_number',
      'membership_number', 
      'relationship_to_main',
      'relationship_to_main_member',
      'medical_aid_provider_id',
      'provider_id'
    ];
    
    console.log('\\n🔍 Field check:');
    fieldsToCheck.forEach(field => {
      const exists = field in sampleRecord;
      console.log(`  ${field}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkSchema();