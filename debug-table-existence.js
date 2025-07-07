import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function debugTableExistence() {
  console.log('🔍 Debugging table existence...');

  try {
    // Check if table exists by trying to query it
    console.log('1️⃣ Checking if patient_documents table exists...');
    const { data, error } = await supabase
      .from('patient_documents')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Table query error:', error);
      
      if (error.code === '42P01') {
        console.log('🚨 TABLE DOES NOT EXIST - Creating it now...');
        
        // Create the table
        const createTableQuery = `
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
          
          -- Disable RLS for testing
          ALTER TABLE patient_documents DISABLE ROW LEVEL SECURITY;
          
          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
          CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON patient_documents(created_at);
        `;
        
        // We'll use a simpler approach - create via direct SQL
        const { error: createError } = await supabase.rpc('sql', {
          query: createTableQuery
        });
        
        if (createError) {
          console.error('❌ Failed to create table via RPC:', createError);
          
          // Try alternative approach
          console.log('🔄 Trying alternative table creation...');
          
          // Use the auth admin API to execute SQL
          const response = await fetch(`https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
            },
            body: JSON.stringify({ sql: createTableQuery })
          });
          
          if (response.ok) {
            console.log('✅ Table created via direct API call');
          } else {
            const errorText = await response.text();
            console.error('❌ Direct API call failed:', errorText);
          }
        } else {
          console.log('✅ Table created successfully');
        }
        
        // Try the query again
        console.log('🔄 Retrying table query...');
        const { data: retryData, error: retryError } = await supabase
          .from('patient_documents')
          .select('*')
          .limit(1);
        
        if (retryError) {
          console.error('❌ Retry failed:', retryError);
        } else {
          console.log('✅ Table is now accessible:', retryData?.length || 0, 'records');
        }
      }
    } else {
      console.log('✅ Table exists with', data?.length || 0, 'records');
    }

    // Test storage bucket access
    console.log('\n2️⃣ Testing storage bucket access...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
    } else {
      console.log('✅ Available buckets:', buckets.map(b => b.name));
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents bucket found and accessible');
        console.log('📋 Bucket details:', {
          public: documentsBucket.public,
          fileSizeLimit: documentsBucket.file_size_limit,
          allowedMimeTypes: documentsBucket.allowed_mime_types
        });
      }
    }

    // Test a sample upload
    console.log('\n3️⃣ Testing sample upload...');
    const testContent = 'Test file for debugging';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const fileName = `debug-test/${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, testFile);
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
    } else {
      console.log('✅ Upload successful:', uploadData.path);
      
      // Clean up
      await supabase.storage.from('documents').remove([uploadData.path]);
      console.log('✅ Cleanup completed');
    }

  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugTableExistence();