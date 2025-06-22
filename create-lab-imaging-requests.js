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
  console.log('🚀 Creating lab and imaging requests tables...\n');

  // Create lab_requests table
  const createLabRequestsQuery = `
    -- Lab Requests Table for tracking doctor requests for laboratory tests
    CREATE TABLE IF NOT EXISTS lab_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
      requested_by UUID NOT NULL REFERENCES auth.users(id),
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
      result_file_id UUID REFERENCES patient_laboratory(id) ON DELETE SET NULL,
      result_text_ids UUID[], -- Array of lab_results IDs
      
      -- Notes and tracking
      notes TEXT,
      completed_date DATE,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for lab_requests
    CREATE INDEX IF NOT EXISTS idx_lab_requests_patient_id ON lab_requests(patient_id);
    CREATE INDEX IF NOT EXISTS idx_lab_requests_visit_id ON lab_requests(visit_id);
    CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON lab_requests(status);
    CREATE INDEX IF NOT EXISTS idx_lab_requests_priority ON lab_requests(priority);
    CREATE INDEX IF NOT EXISTS idx_lab_requests_request_date ON lab_requests(request_date);
  `;

  const labRequestsResult = await executeSql(createLabRequestsQuery);
  if (!labRequestsResult.success) {
    console.log('❌ Failed to create lab_requests table');
    return;
  }

  // Create imaging_requests table
  const createImagingRequestsQuery = `
    -- Imaging Requests Table for tracking doctor requests for medical imaging
    CREATE TABLE IF NOT EXISTS imaging_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
      requested_by UUID NOT NULL REFERENCES auth.users(id),
      request_date DATE NOT NULL DEFAULT CURRENT_DATE,
      priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
      
      -- Imaging details
      imaging_type TEXT NOT NULL CHECK (imaging_type IN ('x_ray', 'ct_scan', 'mri', 'ultrasound', 'mammography', 'nuclear_medicine', 'dental_x_ray', 'panoramic_x_ray', 'cbct', 'other')),
      body_part TEXT NOT NULL,
      view_position TEXT,
      contrast_required BOOLEAN DEFAULT false,
      
      -- Clinical information
      clinical_indication TEXT NOT NULL,
      clinical_history TEXT,
      special_instructions TEXT,
      
      -- Scheduling
      preferred_date DATE,
      scheduled_date DATE,
      scheduled_time TIME,
      facility_name TEXT,
      
      -- Results linking
      result_file_ids UUID[], -- Array of patient_imaging IDs
      radiologist_name TEXT,
      report_text TEXT,
      
      -- Notes and tracking
      notes TEXT,
      completed_date DATE,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for imaging_requests
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_patient_id ON imaging_requests(patient_id);
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_visit_id ON imaging_requests(visit_id);
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_status ON imaging_requests(status);
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_priority ON imaging_requests(priority);
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_request_date ON imaging_requests(request_date);
    CREATE INDEX IF NOT EXISTS idx_imaging_requests_imaging_type ON imaging_requests(imaging_type);
  `;

  const imagingRequestsResult = await executeSql(createImagingRequestsQuery);
  if (!imagingRequestsResult.success) {
    console.log('❌ Failed to create imaging_requests table');
    return;
  }

  console.log('✅ Lab and imaging request tables created successfully!');

  // Create RLS policies for both tables
  const createRlsPoliciesQuery = `
    -- Enable RLS for request tables
    ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE imaging_requests ENABLE ROW LEVEL SECURITY;

    -- Lab Requests RLS Policies
    CREATE POLICY "lab_requests_select_policy" ON lab_requests
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_insert_policy" ON lab_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_update_policy" ON lab_requests
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "lab_requests_delete_policy" ON lab_requests
    FOR DELETE USING (auth.role() = 'authenticated');

    -- Imaging Requests RLS Policies
    CREATE POLICY "imaging_requests_select_policy" ON imaging_requests
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "imaging_requests_insert_policy" ON imaging_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "imaging_requests_update_policy" ON imaging_requests
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "imaging_requests_delete_policy" ON imaging_requests
    FOR DELETE USING (auth.role() = 'authenticated');
  `;

  const rlsResult = await executeSql(createRlsPoliciesQuery);
  if (!rlsResult.success) {
    console.log('❌ Failed to create RLS policies');
    return;
  }

  console.log('✅ RLS policies created successfully!');

  // Create triggers for updated_at
  const createTriggersQuery = `
    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Triggers for updated_at
    CREATE TRIGGER update_lab_requests_updated_at 
      BEFORE UPDATE ON lab_requests 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_imaging_requests_updated_at 
      BEFORE UPDATE ON imaging_requests 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

  const triggersResult = await executeSql(createTriggersQuery);
  if (!triggersResult.success) {
    console.log('❌ Failed to create triggers');
    return;
  }

  console.log('✅ Triggers created successfully!');

  console.log('\n🎉 SUCCESS! Lab and imaging request system is ready!');
  console.log('📋 Created tables: lab_requests, imaging_requests');
  console.log('🔗 Linked to existing: patients, visits, users, patient_laboratory, patient_imaging, lab_results');
  console.log('🔒 All RLS policies configured');
  console.log('⏰ Auto-update timestamps configured');
}

main().catch(console.error);