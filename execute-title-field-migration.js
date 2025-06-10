import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Use service role for database changes
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function addTitleField() {
  console.log('🔧 Adding title field to patient_documents table...');
  console.log('====================================================');

  try {
    // Method 1: Try direct column addition
    console.log('1️⃣ Adding title column...');
    
    // Add title column
    const addColumnResponse = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`
      },
      body: JSON.stringify({
        query: 'ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS title TEXT;'
      })
    });

    console.log('Column addition response:', addColumnResponse.status);

    // Method 2: Test insertion with title field
    console.log('\n2️⃣ Testing title field functionality...');
    
    // Get a sample patient
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
    
    if (patientsError || !patients || patients.length === 0) {
      console.log('❌ No patients found for testing');
      return;
    }
    
    const patient = patients[0];
    console.log('👤 Using patient:', patient);

    // Test inserting a record with title
    const testRecord = {
      patient_id: patient.id,
      file_name: 'test.txt',
      original_name: 'test-file.txt',
      title: 'Test Document Title',
      file_type: 'txt',
      file_size: 100,
      mime_type: 'text/plain',
      storage_path: 'test/path/test.txt',
      description: 'Test record with title field',
      category: 'general'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('patient_documents')
      .insert([testRecord])
      .select();
    
    if (insertError) {
      console.error('❌ Insert with title failed:', insertError);
      
      // Check if it's because column doesn't exist
      if (insertError.message.includes('column "title" of relation "patient_documents" does not exist')) {
        console.log('🚨 Title column does not exist - need manual SQL execution');
        console.log('\n📋 MANUAL STEP REQUIRED:');
        console.log('Go to Supabase Dashboard > SQL Editor and execute:');
        console.log('ALTER TABLE patient_documents ADD COLUMN title TEXT;');
      }
    } else {
      console.log('✅ Insert with title successful:', insertData);
      
      // Clean up test record
      await supabase.from('patient_documents').delete().eq('id', insertData[0].id);
      console.log('🧹 Test record cleaned up');
      
      console.log('\n🎉 Title field is working correctly!');
    }

    // Method 3: Check table structure
    console.log('\n3️⃣ Checking table structure...');
    
    // Query information schema to see current columns
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'patient_documents')
      .order('ordinal_position');
    
    if (columnsError) {
      console.log('⚠️ Could not check table structure:', columnsError.message);
    } else {
      console.log('📋 Current table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      const titleColumn = columns.find(col => col.column_name === 'title');
      if (titleColumn) {
        console.log('✅ Title column exists!');
      } else {
        console.log('❌ Title column missing');
      }
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

addTitleField();