import { createClient } from '@supabase/supabase-js';

// Test with both service role and anon key
const serviceSupabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

const anonSupabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkBucketNames() {
  console.log('🔍 Checking bucket names with different access levels...');
  console.log('=========================================================');

  // Test with service role
  console.log('\n1️⃣ Checking with service role...');
  try {
    const { data: serviceBuckets, error: serviceError } = await serviceSupabase.storage.listBuckets();
    
    if (serviceError) {
      console.error('❌ Service role bucket check failed:', serviceError);
    } else {
      console.log('✅ Service role buckets:', serviceBuckets.map(b => `"${b.name}"`));
      
      // Check exact names
      serviceBuckets.forEach(bucket => {
        console.log(`   - Bucket: "${bucket.name}" (${bucket.name.length} chars)`);
        if (bucket.name === 'documents') {
          console.log('     ✅ Matches "documents" exactly');
        }
        if (bucket.name === 'Documents') {
          console.log('     ✅ Matches "Documents" exactly');
        }
      });
    }
  } catch (error) {
    console.error('💥 Service role test failed:', error);
  }

  // Test with anon key (simulating frontend)
  console.log('\n2️⃣ Checking with anon key (frontend simulation)...');
  try {
    const { data: anonBuckets, error: anonError } = await anonSupabase.storage.listBuckets();
    
    if (anonError) {
      console.error('❌ Anon key bucket check failed:', anonError);
    } else {
      console.log('✅ Anon key buckets:', anonBuckets.map(b => `"${b.name}"`));
      
      // Check if anon can see different buckets than service role
      const documentsFound = anonBuckets.find(b => b.name === 'documents');
      if (documentsFound) {
        console.log('   ✅ "documents" bucket visible to anon key');
      } else {
        console.log('   ❌ "documents" bucket NOT visible to anon key');
      }
    }
  } catch (error) {
    console.error('💥 Anon key test failed:', error);
  }

  // Test with authenticated user
  console.log('\n3️⃣ Checking with authenticated user...');
  try {
    const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
      email: 'admin@onehealth.local',
      password: 'admin123'
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError);
    } else if (authData.user) {
      console.log('✅ User authenticated:', authData.user.email);
      
      const { data: authBuckets, error: authBucketsError } = await anonSupabase.storage.listBuckets();
      
      if (authBucketsError) {
        console.error('❌ Authenticated bucket check failed:', authBucketsError);
      } else {
        console.log('✅ Authenticated user buckets:', authBuckets.map(b => `"${b.name}"`));
        
        const documentsFound = authBuckets.find(b => b.name === 'documents');
        if (documentsFound) {
          console.log('   ✅ "documents" bucket visible to authenticated user');
          
          // Test actual upload capability
          console.log('\n4️⃣ Testing upload capability...');
          const testContent = 'Test bucket access';
          const testFile = new Blob([testContent], { type: 'text/plain' });
          const fileName = `bucket-test/${Date.now()}.txt`;
          
          const { data: uploadData, error: uploadError } = await anonSupabase.storage
            .from('documents')
            .upload(fileName, testFile);
          
          if (uploadError) {
            console.error('❌ Upload test failed:', uploadError);
            console.error('   Error details:', {
              message: uploadError.message,
              statusCode: uploadError.statusCode,
              error: uploadError.error
            });
          } else {
            console.log('✅ Upload test successful:', uploadData.path);
            
            // Clean up
            await anonSupabase.storage.from('documents').remove([uploadData.path]);
            console.log('🧹 Test file cleaned up');
          }
        } else {
          console.log('   ❌ "documents" bucket NOT visible to authenticated user');
        }
      }
      
      // Sign out
      await anonSupabase.auth.signOut();
    }
  } catch (error) {
    console.error('💥 Authenticated test failed:', error);
  }

  console.log('\n📋 Summary:');
  console.log('- Check which buckets are visible to each access level');
  console.log('- Verify exact bucket name spelling and case');
  console.log('- Test upload capability with authenticated user');
}

checkBucketNames();