import { createClient } from '@supabase/supabase-js';

// Use service role for full database access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function fixBucketVisibility() {
  console.log('🔧 Fixing documents bucket visibility...');
  console.log('========================================');

  try {
    // 1. First, check current bucket status
    console.log('1️⃣ Checking current bucket configuration...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return;
    }
    
    const documentsBucket = buckets.find(b => b.name === 'documents');
    if (!documentsBucket) {
      console.error('❌ Documents bucket not found');
      return;
    }
    
    console.log('📋 Current documents bucket config:', {
      name: documentsBucket.name,
      public: documentsBucket.public,
      fileSizeLimit: documentsBucket.file_size_limit,
      allowedMimeTypes: documentsBucket.allowed_mime_types?.length || 'All types'
    });

    // 2. Update bucket to be public (this will make it visible)
    console.log('\n2️⃣ Making documents bucket public...');
    const { data: updateData, error: updateError } = await supabase.storage
      .updateBucket('documents', { public: true });
    
    if (updateError) {
      console.error('❌ Failed to update bucket:', updateError);
    } else {
      console.log('✅ Bucket updated to public');
    }

    // 3. Test visibility after update
    console.log('\n3️⃣ Testing bucket visibility after update...');
    
    const testSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );

    // Test with anon key
    const { data: anonBuckets, error: anonError } = await testSupabase.storage.listBuckets();
    
    if (anonError) {
      console.error('❌ Anon bucket check failed:', anonError);
    } else {
      console.log('✅ Anon can now see buckets:', anonBuckets.map(b => b.name));
      const documentsVisible = anonBuckets.find(b => b.name === 'documents');
      if (documentsVisible) {
        console.log('   ✅ documents bucket is now visible!');
      } else {
        console.log('   ❌ documents bucket still not visible');
      }
    }

    // Test with authenticated user
    console.log('\n4️⃣ Testing with authenticated user...');
    const { data: authData, error: authError } = await testSupabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError);
    } else if (authData.user) {
      console.log('✅ User authenticated:', authData.user.email);
      
      const { data: authBuckets, error: authBucketsError } = await testSupabase.storage.listBuckets();
      
      if (authBucketsError) {
        console.error('❌ Authenticated bucket check failed:', authBucketsError);
      } else {
        console.log('✅ Authenticated user can see buckets:', authBuckets.map(b => b.name));
        
        const documentsFound = authBuckets.find(b => b.name === 'documents');
        if (documentsFound) {
          console.log('   ✅ documents bucket visible to authenticated user');
          
          // Test upload
          console.log('\n5️⃣ Testing upload...');
          const testContent = 'Test upload after bucket fix';
          const testFile = new Blob([testContent], { type: 'text/plain' });
          const fileName = `upload-test/${Date.now()}.txt`;
          
          const { data: uploadData, error: uploadError } = await testSupabase.storage
            .from('documents')
            .upload(fileName, testFile);
          
          if (uploadError) {
            console.error('❌ Upload failed:', uploadError);
          } else {
            console.log('✅ Upload successful:', uploadData.path);
            console.log('🎉 Document uploads are now working!');
            
            // Clean up
            await testSupabase.storage.from('documents').remove([uploadData.path]);
            console.log('🧹 Test file cleaned up');
          }
        } else {
          console.log('   ❌ documents bucket still not visible');
        }
      }
      
      // Sign out
      await testSupabase.auth.signOut();
    }

    console.log('\n📋 Results:');
    console.log('- Bucket visibility should now be fixed');
    console.log('- Document uploads should work in the frontend');
    console.log('- Try uploading a document in the app now');

  } catch (error) {
    console.error('💥 Fix failed:', error);
  }
}

fixBucketVisibility();