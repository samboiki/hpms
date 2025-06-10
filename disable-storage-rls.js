import { createClient } from '@supabase/supabase-js';

// Use service role for full database access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function disableStorageRLS() {
  console.log('🔧 Disabling storage RLS for document uploads...');
  console.log('=================================================');

  try {
    // Method 1: Try using Supabase management API
    console.log('1️⃣ Attempting to disable RLS via management API...');
    
    try {
      const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
        },
        body: JSON.stringify({
          query: 'ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;'
        })
      });

      if (response.ok) {
        console.log('✅ RLS disabled successfully via API');
      } else {
        const errorText = await response.text();
        console.log('⚠️ API method failed:', response.status, errorText);
      }
    } catch (apiError) {
      console.log('⚠️ API method failed:', apiError.message);
    }

    // Method 2: Test the current state by trying an upload
    console.log('\n2️⃣ Testing current upload capability...');
    
    // Test with authenticated user
    const testSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );

    // Authenticate test user
    const { data: authData, error: authError } = await testSupabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });

    if (authError) {
      console.log('❌ Test auth failed:', authError.message);
    } else if (authData.user) {
      console.log('✅ Test user authenticated:', authData.user.email);
      
      // Test upload
      const testContent = 'Test upload to verify RLS disabled';
      const testFile = new Blob([testContent], { type: 'text/plain' });
      const fileName = `rls-test/${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await testSupabase.storage
        .from('documents')
        .upload(fileName, testFile);
      
      if (uploadError) {
        console.log('❌ Upload still failing:', uploadError.message);
        console.log('🔧 RLS is likely still enabled - need manual intervention');
        
        console.log('\n📋 MANUAL FIX REQUIRED:');
        console.log('1. Go to Supabase Dashboard > SQL Editor');
        console.log('2. Execute: ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;');
        console.log('3. Try document upload again');
        
      } else {
        console.log('✅ Upload successful:', uploadData.path);
        console.log('🎉 Document uploads are now working!');
        
        // Clean up
        await testSupabase.storage.from('documents').remove([uploadData.path]);
        console.log('🧹 Test file cleaned up');
      }
      
      // Sign out
      await testSupabase.auth.signOut();
    }

    // Method 3: Show the bucket configuration
    console.log('\n3️⃣ Current bucket configuration...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log('❌ Failed to list buckets:', bucketsError);
    } else {
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('📋 Documents bucket config:', {
          name: documentsBucket.name,
          public: documentsBucket.public,
          fileSizeLimit: documentsBucket.file_size_limit,
          allowedMimeTypes: documentsBucket.allowed_mime_types?.length || 'All types'
        });
      }
    }

  } catch (error) {
    console.error('💥 Process failed:', error);
  }
}

disableStorageRLS();