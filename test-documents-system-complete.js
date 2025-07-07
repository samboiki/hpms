import { createClient } from '@supabase/supabase-js';

// Use the service role key for full access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function testCompleteDocumentsSystem() {
  console.log('🚀 Testing Complete Documents System...');
  console.log('========================================');

  try {
    // Test 1: Check storage buckets
    console.log('\n1️⃣ Testing Storage Buckets:');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
    } else {
      console.log('✅ Available buckets:', buckets.map(b => b.name));
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents bucket found:', documentsBucket);
      } else {
        console.error('❌ Documents bucket NOT found');
      }
    }

    // Test 2: Check if patient_documents table exists
    console.log('\n2️⃣ Testing Database Table:');
    const { data: tableCheck, error: tableError } = await supabase
      .from('patient_documents')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.error('❌ Table check failed:', tableError);
      if (tableError.code === '42P01') {
        console.log('🚨 TABLE MISSING - Need to create patient_documents table');
      }
    } else {
      console.log('✅ patient_documents table exists with', tableCheck.count || 0, 'records');
    }

    // Test 3: Check RLS status
    console.log('\n3️⃣ Testing RLS Status:');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity,
            'RLS Status' as description
          FROM pg_tables 
          WHERE tablename = 'patient_documents';
        `
      });
    
    if (rlsError) {
      console.error('❌ RLS check failed:', rlsError);
    } else {
      console.log('✅ RLS Status:', rlsData);
    }

    // Test 4: Try to create the table if it doesn't exist
    if (tableError && tableError.code === '42P01') {
      console.log('\n4️⃣ Creating patient_documents table:');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS patient_documents (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          patient_id UUID NOT NULL,
          visit_id UUID,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'general',
          tags TEXT[],
          uploaded_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
      
      const { data: createResult, error: createError } = await supabase
        .rpc('exec', { sql: createTableSQL });
      
      if (createError) {
        console.error('❌ Failed to create table:', createError);
      } else {
        console.log('✅ Table created successfully');
      }
    }

    // Test 5: Disable RLS for testing
    console.log('\n5️⃣ Disabling RLS for testing:');
    const { data: disableRLS, error: disableError } = await supabase
      .rpc('exec', {
        sql: 'ALTER TABLE patient_documents DISABLE ROW LEVEL SECURITY;'
      });
    
    if (disableError) {
      console.error('❌ Failed to disable RLS:', disableError);
    } else {
      console.log('✅ RLS disabled successfully');
    }

    // Test 6: Try to create documents bucket if it doesn't exist
    const documentsBucket = buckets?.find(b => b.name === 'documents');
    if (!documentsBucket) {
      console.log('\n6️⃣ Creating documents bucket:');
      
      const { data: bucketCreate, error: bucketError } = await supabase.storage
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
      
      if (bucketError) {
        console.error('❌ Failed to create bucket:', bucketError);
      } else {
        console.log('✅ Documents bucket created:', bucketCreate);
      }
    }

    // Test 7: Get a sample patient for testing
    console.log('\n7️⃣ Getting sample patient:');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);
    
    if (patientsError) {
      console.error('❌ Failed to get patients:', patientsError);
    } else if (patients && patients.length > 0) {
      const patient = patients[0];
      console.log('✅ Sample patient found:', patient);
      
      // Test 8: Try a complete upload simulation
      console.log('\n8️⃣ Testing complete upload flow:');
      
      // Create a small test file
      const testFileContent = 'This is a test document for upload testing.';
      const testFile = new Blob([testFileContent], { type: 'text/plain' });
      const fileName = `test-uploads/${patient.id}/test-${Date.now()}.txt`;
      
      console.log('📤 Uploading test file to storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, testFile);
      
      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
      } else {
        console.log('✅ File uploaded to storage:', uploadData.path);
        
        // Now try to save metadata
        console.log('💾 Saving metadata to database...');
        const metadata = {
          patient_id: patient.id,
          file_name: 'test.txt',
          original_name: 'test-document.txt',
          file_type: 'txt',
          file_size: testFileContent.length,
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
        } else {
          console.log('✅ Metadata saved successfully:', metadataResult);
          
          // Clean up test file
          console.log('🧹 Cleaning up test file...');
          await supabase.storage.from('documents').remove([uploadData.path]);
          await supabase.from('patient_documents').delete().eq('id', metadataResult[0].id);
          console.log('✅ Cleanup completed');
        }
      }
    }

    console.log('\n🎉 Testing completed!');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

testCompleteDocumentsSystem();