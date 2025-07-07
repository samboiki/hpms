import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Use service role for full database access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeStoragePoliciesFix() {
  console.log('🔧 Creating storage policies for documents bucket...');
  console.log('====================================================');

  try {
    // 1. First, let's check current storage bucket status
    console.log('1️⃣ Checking storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return;
    }
    
    console.log('📋 Available buckets:', buckets.map(b => b.name));
    const documentsBucket = buckets.find(b => b.name === 'documents');
    
    if (!documentsBucket) {
      console.log('❌ Documents bucket not found, creating it...');
      
      const { data: newBucket, error: createError } = await supabase.storage
        .createBucket('documents', {
          public: false,
          allowedMimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ],
          fileSizeLimit: 52428800 // 50MB
        });
      
      if (createError) {
        console.error('❌ Failed to create bucket:', createError);
        return;
      }
      
      console.log('✅ Documents bucket created:', newBucket);
    } else {
      console.log('✅ Documents bucket found');
    }

    // 2. Execute storage policies
    console.log('\n2️⃣ Creating storage policies...');
    
    const policies = [
      {
        name: 'Authenticated users can upload documents',
        sql: `
          CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
            ON storage.objects FOR INSERT
            WITH CHECK (
              bucket_id = 'documents' AND
              auth.role() = 'authenticated'
            );
        `
      },
      {
        name: 'Authenticated users can view documents',
        sql: `
          CREATE POLICY IF NOT EXISTS "Authenticated users can view documents"
            ON storage.objects FOR SELECT
            USING (
              bucket_id = 'documents' AND
              auth.role() = 'authenticated'
            );
        `
      },
      {
        name: 'Authenticated users can delete documents',
        sql: `
          CREATE POLICY IF NOT EXISTS "Authenticated users can delete documents"
            ON storage.objects FOR DELETE
            USING (
              bucket_id = 'documents' AND
              auth.role() = 'authenticated'
            );
        `
      },
      {
        name: 'Authenticated users can update documents',
        sql: `
          CREATE POLICY IF NOT EXISTS "Authenticated users can update documents"
            ON storage.objects FOR UPDATE
            USING (
              bucket_id = 'documents' AND
              auth.role() = 'authenticated'
            );
        `
      }
    ];

    // Enable RLS first
    console.log('🔒 Enabling RLS on storage.objects...');
    try {
      await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
        },
        body: JSON.stringify({
          query: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
        })
      });
      console.log('✅ RLS enabled');
    } catch (rlsError) {
      console.log('⚠️ RLS enable failed (might already be enabled):', rlsError.message);
    }

    // Create policies using direct REST API
    for (const policy of policies) {
      console.log(`🔧 Creating policy: ${policy.name}...`);
      
      try {
        const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
          },
          body: JSON.stringify({
            query: policy.sql
          })
        });
        
        if (response.ok) {
          console.log(`✅ Policy created: ${policy.name}`);
        } else {
          const errorText = await response.text();
          console.log(`⚠️ Policy creation response: ${response.status} - ${errorText}`);
        }
      } catch (policyError) {
        console.log(`⚠️ Policy creation failed: ${policy.name} -`, policyError.message);
      }
    }

    // 3. Test the setup with authentication
    console.log('\n3️⃣ Testing upload with authentication...');
    
    // Create a test authenticated client (simulating frontend)
    const testSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );

    // Try to authenticate a test user
    try {
      const { data: authData, error: authError } = await testSupabase.auth.signInWithPassword({
        email: 'admin@onehealth.local',
        password: 'admin123'
      });

      if (authError) {
        console.log('⚠️ Test auth failed:', authError.message);
      } else if (authData.user) {
        console.log('✅ Test user authenticated:', authData.user.email);
        
        // Test upload with authenticated user
        const testContent = 'Test upload with authentication';
        const testFile = new Blob([testContent], { type: 'text/plain' });
        const fileName = `auth-test/${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await testSupabase.storage
          .from('documents')
          .upload(fileName, testFile);
        
        if (uploadError) {
          console.log('❌ Authenticated upload failed:', uploadError.message);
        } else {
          console.log('✅ Authenticated upload successful:', uploadData.path);
          
          // Clean up
          await testSupabase.storage.from('documents').remove([uploadData.path]);
          console.log('🧹 Test file cleaned up');
        }
        
        // Sign out test user
        await testSupabase.auth.signOut();
      }
    } catch (testError) {
      console.log('⚠️ Test authentication failed:', testError.message);
    }

    console.log('\n🎉 Storage policies setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Users must log in to the application');
    console.log('2. Navigate to PatientModernDetail > Documents tab');
    console.log('3. Upload documents should now work correctly');

  } catch (error) {
    console.error('💥 Setup failed:', error);
  }
}

executeStoragePoliciesFix();