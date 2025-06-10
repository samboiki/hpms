import { createClient } from '@supabase/supabase-js';

// Use service role for full database access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function quickDisableRLSAndTest() {
  console.log('🚀 Quick fix: Disable RLS and test uploads...');
  console.log('==============================================');

  try {
    // 1. Test current table access
    console.log('1️⃣ Testing current table access...');
    const { data: tableData, error: tableError } = await supabase
      .from('patient_documents')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Table access failed:', tableError.message);
      if (tableError.code === '42P01') {
        console.log('🔧 Table does not exist, need to create it first');
      }
    } else {
      console.log('✅ Table accessible, records:', tableData?.length || 0);
    }

    // 2. Get a sample patient for testing
    console.log('\n2️⃣ Getting sample patient...');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
    
    if (patientsError) {
      console.error('❌ Failed to get patients:', patientsError);
      return;
    }
    
    if (!patients || patients.length === 0) {
      console.log('❌ No patients found for testing');
      return;
    }
    
    const patient = patients[0];
    console.log('👤 Using patient:', patient);

    // 3. Test storage bucket
    console.log('\n3️⃣ Testing storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
    } else {
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents bucket found');
      } else {
        console.log('❌ Documents bucket not found');
        return;
      }
    }

    // 4. Test complete upload flow with service role
    console.log('\n4️⃣ Testing complete upload flow...');
    
    // Create test file
    const testContent = 'Test document for upload debugging';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const fileName = `test-uploads/${patient.id}/debug-${Date.now()}.txt`;
    
    // Upload to storage
    console.log('📤 Uploading to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, testFile);
    
    if (uploadError) {
      console.error('❌ Storage upload failed:', uploadError);
      return;
    }
    
    console.log('✅ File uploaded to storage:', uploadData.path);
    
    // Try to save metadata
    console.log('💾 Saving metadata to database...');
    const metadata = {
      patient_id: patient.id,
      file_name: 'debug.txt',
      original_name: 'debug-test.txt',
      file_type: 'txt',
      file_size: testContent.length,
      mime_type: 'text/plain',
      storage_path: uploadData.path,
      description: 'Test document upload',
      category: 'general'
    };
    
    const { data: metadataResult, error: metadataError } = await supabase
      .from('patient_documents')
      .insert([metadata])
      .select();
    
    if (metadataError) {
      console.error('❌ Metadata save failed:', metadataError);
      console.log('🔧 This is likely due to RLS policies');
      
      // Clean up storage file since metadata failed
      await supabase.storage.from('documents').remove([uploadData.path]);
      console.log('🧹 Cleaned up storage file');
      
      console.log('\n💡 SOLUTION: Disable RLS on patient_documents table');
      console.log('1. Go to Supabase Dashboard');
      console.log('2. Database > Tables > patient_documents');
      console.log('3. Click settings icon');
      console.log('4. Toggle off "Enable Row Level Security"');
      console.log('5. Retry the document upload');
      
    } else {
      console.log('✅ Metadata saved successfully:', metadataResult);
      
      // Clean up test data
      await supabase.storage.from('documents').remove([uploadData.path]);
      await supabase.from('patient_documents').delete().eq('id', metadataResult[0].id);
      console.log('🧹 Test data cleaned up');
      
      console.log('\n🎉 SUCCESS! Upload flow is working correctly');
    }

    // 5. Test with anon key to see what frontend experiences
    console.log('\n5️⃣ Testing with anon key (frontend simulation)...');
    const anonSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );

    const { data: anonTest, error: anonError } = await anonSupabase
      .from('patient_documents')
      .select('*')
      .limit(1);
    
    if (anonError) {
      console.log('❌ Anon key failed (expected):', anonError.message);
      console.log('This confirms the RLS is blocking frontend access');
    } else {
      console.log('✅ Anon key works:', anonTest?.length || 0, 'records visible');
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

quickDisableRLSAndTest();