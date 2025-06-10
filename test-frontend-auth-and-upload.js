import { createClient } from '@supabase/supabase-js';

// Use anon key (same as frontend)
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function testFrontendAuthAndUpload() {
  console.log('🧪 Testing frontend authentication and upload flow...');
  console.log('=====================================================');

  try {
    // 1. Check current authentication status
    console.log('1️⃣ Checking current auth status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Auth check failed:', authError.message);
    } else if (user) {
      console.log('✅ User authenticated:', user.email, user.id);
    } else {
      console.log('⚠️ No user authenticated');
      console.log('This is likely the issue - frontend needs to authenticate first');
    }

    // 2. Test table access without authentication
    console.log('\n2️⃣ Testing table access without auth...');
    const { data: tableData, error: tableError } = await supabase
      .from('patient_documents')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Table access failed:', tableError.message);
    } else {
      console.log('✅ Table accessible without auth:', tableData?.length || 0, 'records');
    }

    // 3. Test storage access without authentication
    console.log('\n3️⃣ Testing storage access without auth...');
    const testContent = 'Test file without auth';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const fileName = `unauth-test/${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, testFile);
    
    if (uploadError) {
      console.log('❌ Storage upload failed:', uploadError.message);
      console.log('This might be why frontend uploads are failing');
    } else {
      console.log('✅ Storage upload works without auth:', uploadData.path);
      
      // Clean up
      await supabase.storage.from('documents').remove([uploadData.path]);
      console.log('🧹 Cleaned up test file');
    }

    // 4. Try to authenticate as a test user
    console.log('\n4️⃣ Testing authentication flow...');
    
    // Get a sample user
    const serviceSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
    );
    
    const { data: users, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, email, role')
      .limit(1);
    
    if (usersError) {
      console.log('❌ Failed to get users:', usersError.message);
    } else if (users && users.length > 0) {
      console.log('👤 Sample user found:', users[0]);
      
      // Check if this user exists in auth.users
      const { data: authUsers, error: authUsersError } = await serviceSupabase.auth.admin.listUsers();
      
      if (authUsersError) {
        console.log('❌ Failed to list auth users:', authUsersError.message);
      } else {
        console.log('🔑 Auth users count:', authUsers.users.length);
        const matchingAuthUser = authUsers.users.find(u => u.email === users[0].email);
        if (matchingAuthUser) {
          console.log('✅ Matching auth user found:', matchingAuthUser.email);
        } else {
          console.log('⚠️ No matching auth user found for:', users[0].email);
          console.log('This explains why authentication might be failing');
        }
      }
    }

    // 5. Test what happens when we set the session manually (simulate login)
    console.log('\n5️⃣ Simulating logged-in state...');
    
    // Get patient for testing
    const { data: patients, error: patientsError } = await serviceSupabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
    
    if (patientsError || !patients || patients.length === 0) {
      console.log('❌ No patients found for testing');
      return;
    }
    
    const patient = patients[0];
    console.log('👤 Using patient:', patient);

    // Test complete flow with anon key
    console.log('📤 Testing upload with anon key...');
    const anonTestContent = 'Test upload with anon key';
    const anonTestFile = new Blob([anonTestContent], { type: 'text/plain' });
    const anonFileName = `anon-test/${patient.id}/${Date.now()}.txt`;
    
    // Upload to storage
    const { data: anonUploadData, error: anonUploadError } = await supabase.storage
      .from('documents')
      .upload(anonFileName, anonTestFile);
    
    if (anonUploadError) {
      console.log('❌ Anon storage upload failed:', anonUploadError.message);
    } else {
      console.log('✅ Anon storage upload successful:', anonUploadData.path);
      
      // Try to save metadata with anon key
      const anonMetadata = {
        patient_id: patient.id,
        file_name: 'anon-test.txt',
        original_name: 'anon-test-file.txt',
        file_type: 'txt',
        file_size: anonTestContent.length,
        mime_type: 'text/plain',
        storage_path: anonUploadData.path,
        description: 'Test with anon key',
        category: 'general'
      };
      
      const { data: anonMetadataResult, error: anonMetadataError } = await supabase
        .from('patient_documents')
        .insert([anonMetadata])
        .select();
      
      if (anonMetadataError) {
        console.log('❌ Anon metadata save failed:', anonMetadataError.message);
        console.log('🔧 This is the root cause of the frontend issue!');
        
        // Clean up storage
        await supabase.storage.from('documents').remove([anonUploadData.path]);
      } else {
        console.log('✅ Anon metadata save successful:', anonMetadataResult);
        
        // Clean up
        await supabase.storage.from('documents').remove([anonUploadData.path]);
        await serviceSupabase.from('patient_documents').delete().eq('id', anonMetadataResult[0].id);
        console.log('🧹 Cleaned up test data');
      }
    }

    console.log('\n📋 FINDINGS:');
    console.log('- Storage upload may work with anon key');
    console.log('- Database insert likely fails with anon key due to RLS');
    console.log('- Frontend needs proper user authentication');
    console.log('- DocumentUploadModal should check auth status before upload');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testFrontendAuthAndUpload();