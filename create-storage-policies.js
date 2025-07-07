import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Creating storage policies for patient media buckets...\n');

  // Create storage policies using the correct approach
  const createStoragePoliciesQuery = `
    -- Storage policies for patient-media bucket (objects table)
    CREATE POLICY IF NOT EXISTS "patient_media_upload_policy" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'patient-media' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_media_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'patient-media' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_media_update_policy" ON storage.objects
    FOR UPDATE USING (bucket_id = 'patient-media' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'patient-media' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_media_delete_policy" ON storage.objects
    FOR DELETE USING (bucket_id = 'patient-media' AND auth.role() = 'authenticated');

    -- Storage policies for patient-laboratory bucket
    CREATE POLICY IF NOT EXISTS "patient_lab_upload_policy" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'patient-laboratory' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_lab_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'patient-laboratory' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_lab_update_policy" ON storage.objects
    FOR UPDATE USING (bucket_id = 'patient-laboratory' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'patient-laboratory' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_lab_delete_policy" ON storage.objects
    FOR DELETE USING (bucket_id = 'patient-laboratory' AND auth.role() = 'authenticated');

    -- Storage policies for patient-imaging bucket
    CREATE POLICY IF NOT EXISTS "patient_imaging_upload_policy" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'patient-imaging' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_imaging_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'patient-imaging' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_imaging_update_policy" ON storage.objects
    FOR UPDATE USING (bucket_id = 'patient-imaging' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'patient-imaging' AND auth.role() = 'authenticated');

    CREATE POLICY IF NOT EXISTS "patient_imaging_delete_policy" ON storage.objects
    FOR DELETE USING (bucket_id = 'patient-imaging' AND auth.role() = 'authenticated');

    -- Allow bucket listing for authenticated users
    CREATE POLICY IF NOT EXISTS "patient_buckets_select_policy" ON storage.buckets
    FOR SELECT USING (auth.role() = 'authenticated');
  `;

  const result = await executeSql(createStoragePoliciesQuery);
  
  if (result.success) {
    console.log('✅ Storage policies created successfully!');
  } else {
    console.log('❌ Failed to create storage policies:', result.error);
  }

  console.log('\n🎉 Storage policies setup complete!');
}

main().catch(console.error);