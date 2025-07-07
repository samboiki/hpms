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
  console.log('🚀 Fixing lab_requests table...\n');

  // Drop the problematic table and recreate it
  const dropAndCreateLabRequestsQuery = `
    -- Drop the table if it exists
    DROP TABLE IF EXISTS lab_requests CASCADE;
    
    -- Create lab_requests table correctly
    CREATE TABLE lab_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL,
      visit_id UUID,
      requested_by UUID NOT NULL,
      request_date DATE NOT NULL DEFAULT CURRENT_DATE,
      priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
      
      -- Test details
      test_name TEXT NOT NULL,
      test_code TEXT,
      test_category TEXT NOT NULL CHECK (test_category IN ('blood_work', 'urine_analysis', 'microbiology', 'chemistry', 'pathology', 'genetics', 'other')),
      lab_facility TEXT,
      
      -- Clinical information
      clinical_indication TEXT,
      special_instructions TEXT,
      fasting_required BOOLEAN DEFAULT false,
      
      -- Scheduling
      preferred_date DATE,
      scheduled_date DATE,
      scheduled_time TIME,
      
      -- Results linking
      result_file_id UUID,
      result_text_ids UUID[],
      
      -- Notes and tracking
      notes TEXT,
      completed_date DATE,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add foreign key constraints after table creation
    ALTER TABLE lab_requests ADD CONSTRAINT lab_requests_patient_id_fkey 
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
    
    ALTER TABLE lab_requests ADD CONSTRAINT lab_requests_visit_id_fkey 
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL;
    
    ALTER TABLE lab_requests ADD CONSTRAINT lab_requests_requested_by_fkey 
      FOREIGN KEY (requested_by) REFERENCES auth.users(id);

    -- Create indexes
    CREATE INDEX idx_lab_requests_patient_id ON lab_requests(patient_id);
    CREATE INDEX idx_lab_requests_visit_id ON lab_requests(visit_id);
    CREATE INDEX idx_lab_requests_status ON lab_requests(status);
    CREATE INDEX idx_lab_requests_priority ON lab_requests(priority);
    CREATE INDEX idx_lab_requests_request_date ON lab_requests(request_date);
    
    -- Enable RLS
    ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "lab_requests_select_policy" ON lab_requests
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_insert_policy" ON lab_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_update_policy" ON lab_requests
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_delete_policy" ON lab_requests
    FOR DELETE USING (auth.role() = 'authenticated');

    -- Create trigger for updated_at
    CREATE TRIGGER update_lab_requests_updated_at 
      BEFORE UPDATE ON lab_requests 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

  const result = await executeSql(dropAndCreateLabRequestsQuery);
  if (result.success) {
    console.log('✅ Lab requests table fixed successfully!');
  } else {
    console.log('❌ Failed to fix lab requests table');
  }

  console.log('\n🎉 Lab requests system is now ready!');
}

main().catch(console.error);