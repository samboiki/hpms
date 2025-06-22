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
  console.log('🚀 Creating patient media, laboratory, and imaging tables...\n');

  // Create patient_media table
  const createMediaTableQuery = `
    -- Patient Media Table for photos, videos, and multimedia files
    CREATE TABLE IF NOT EXISTS patient_media (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL UNIQUE,
      storage_bucket TEXT NOT NULL DEFAULT 'patient-media',
      category TEXT NOT NULL CHECK (category IN ('photo', 'video', 'audio', 'document', 'other')),
      subcategory TEXT,
      description TEXT,
      tags TEXT[],
      metadata JSONB DEFAULT '{}',
      is_sensitive BOOLEAN DEFAULT false,
      uploaded_by UUID NOT NULL REFERENCES auth.users(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for patient_media
    CREATE INDEX IF NOT EXISTS idx_patient_media_patient_id ON patient_media(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_media_visit_id ON patient_media(visit_id);
    CREATE INDEX IF NOT EXISTS idx_patient_media_category ON patient_media(category);
    CREATE INDEX IF NOT EXISTS idx_patient_media_uploaded_at ON patient_media(uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_patient_media_tags ON patient_media USING GIN(tags);
  `;

  const mediaResult = await executeSql(createMediaTableQuery);
  if (!mediaResult.success) {
    console.log('❌ Failed to create patient_media table');
    return;
  }

  // Create patient_laboratory table
  const createLabTableQuery = `
    -- Patient Laboratory Table for lab results, test reports, and clinical files
    CREATE TABLE IF NOT EXISTS patient_laboratory (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL UNIQUE,
      storage_bucket TEXT NOT NULL DEFAULT 'patient-laboratory',
      test_type TEXT NOT NULL CHECK (test_type IN ('blood_work', 'urine_analysis', 'microbiology', 'chemistry', 'pathology', 'genetics', 'other')),
      test_name TEXT,
      test_code TEXT,
      lab_name TEXT,
      reference_number TEXT,
      test_date DATE,
      result_date DATE,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      is_abnormal BOOLEAN DEFAULT false,
      critical_result BOOLEAN DEFAULT false,
      description TEXT,
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      uploaded_by UUID NOT NULL REFERENCES auth.users(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for patient_laboratory
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_patient_id ON patient_laboratory(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_visit_id ON patient_laboratory(visit_id);
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_test_type ON patient_laboratory(test_type);
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_test_date ON patient_laboratory(test_date);
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_status ON patient_laboratory(status);
    CREATE INDEX IF NOT EXISTS idx_patient_laboratory_critical ON patient_laboratory(critical_result);
  `;

  const labResult = await executeSql(createLabTableQuery);
  if (!labResult.success) {
    console.log('❌ Failed to create patient_laboratory table');
    return;
  }

  // Create patient_imaging table
  const createImagingTableQuery = `
    -- Patient Imaging Table for medical imaging, X-rays, and radiology reports
    CREATE TABLE IF NOT EXISTS patient_imaging (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL UNIQUE,
      storage_bucket TEXT NOT NULL DEFAULT 'patient-imaging',
      imaging_type TEXT NOT NULL CHECK (imaging_type IN ('x_ray', 'ct_scan', 'mri', 'ultrasound', 'mammography', 'nuclear_medicine', 'dental_x_ray', 'panoramic_x_ray', 'cbct', 'other')),
      body_part TEXT,
      view_position TEXT,
      study_date DATE,
      study_time TIME,
      modality TEXT,
      series_number TEXT,
      instance_number TEXT,
      study_uid TEXT,
      series_uid TEXT,
      instance_uid TEXT,
      radiologist_name TEXT,
      referring_physician TEXT,
      clinical_indication TEXT,
      findings TEXT,
      impression TEXT,
      recommendations TEXT,
      is_urgent BOOLEAN DEFAULT false,
      contrast_used BOOLEAN DEFAULT false,
      radiation_dose DECIMAL(10,4),
      description TEXT,
      metadata JSONB DEFAULT '{}',
      uploaded_by UUID NOT NULL REFERENCES auth.users(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for patient_imaging
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_patient_id ON patient_imaging(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_visit_id ON patient_imaging(visit_id);
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_type ON patient_imaging(imaging_type);
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_study_date ON patient_imaging(study_date);
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_body_part ON patient_imaging(body_part);
    CREATE INDEX IF NOT EXISTS idx_patient_imaging_urgent ON patient_imaging(is_urgent);
  `;

  const imagingResult = await executeSql(createImagingTableQuery);
  if (!imagingResult.success) {
    console.log('❌ Failed to create patient_imaging table');
    return;
  }

  console.log('✅ All patient media tables created successfully!');

  // Create storage buckets
  const createBucketsQuery = `
    -- Insert storage buckets for file organization
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES 
      ('patient-media', 'patient-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'application/pdf']),
      ('patient-laboratory', 'patient-laboratory', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
      ('patient-imaging', 'patient-imaging', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/dicom', 'application/dicom', 'application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  `;

  const bucketsResult = await executeSql(createBucketsQuery);
  if (!bucketsResult.success) {
    console.log('❌ Failed to create storage buckets');
    return;
  }

  console.log('✅ Storage buckets created successfully!');

  // Create RLS policies for all tables
  const createRlsPoliciesQuery = `
    -- Enable RLS for all patient media tables
    ALTER TABLE patient_media ENABLE ROW LEVEL SECURITY;
    ALTER TABLE patient_laboratory ENABLE ROW LEVEL SECURITY;
    ALTER TABLE patient_imaging ENABLE ROW LEVEL SECURITY;

    -- Patient Media RLS Policies
    CREATE POLICY "patient_media_select_policy" ON patient_media
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "patient_media_insert_policy" ON patient_media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_media_update_policy" ON patient_media
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_media_delete_policy" ON patient_media
    FOR DELETE USING (auth.role() = 'authenticated');

    -- Patient Laboratory RLS Policies
    CREATE POLICY "patient_laboratory_select_policy" ON patient_laboratory
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "patient_laboratory_insert_policy" ON patient_laboratory
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_laboratory_update_policy" ON patient_laboratory
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_laboratory_delete_policy" ON patient_laboratory
    FOR DELETE USING (auth.role() = 'authenticated');

    -- Patient Imaging RLS Policies
    CREATE POLICY "patient_imaging_select_policy" ON patient_imaging
    FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "patient_imaging_insert_policy" ON patient_imaging
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_imaging_update_policy" ON patient_imaging
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "patient_imaging_delete_policy" ON patient_imaging
    FOR DELETE USING (auth.role() = 'authenticated');
  `;

  const rlsResult = await executeSql(createRlsPoliciesQuery);
  if (!rlsResult.success) {
    console.log('❌ Failed to create RLS policies');
    return;
  }

  console.log('✅ RLS policies created successfully!');

  // Create storage policies
  const createStoragePoliciesQuery = `
    -- Storage policies for patient-media bucket
    INSERT INTO storage.policies (id, bucket_id, policy_name, action, policy_definition)
    VALUES 
      ('patient_media_upload', 'patient-media', 'Allow authenticated users to upload media', 'INSERT', 'auth.role() = ''authenticated'''),
      ('patient_media_select', 'patient-media', 'Allow authenticated users to view media', 'SELECT', 'auth.role() = ''authenticated'''),
      ('patient_media_delete', 'patient-media', 'Allow authenticated users to delete media', 'DELETE', 'auth.role() = ''authenticated''')
    ON CONFLICT (id) DO NOTHING;

    -- Storage policies for patient-laboratory bucket
    INSERT INTO storage.policies (id, bucket_id, policy_name, action, policy_definition)
    VALUES 
      ('patient_lab_upload', 'patient-laboratory', 'Allow authenticated users to upload lab files', 'INSERT', 'auth.role() = ''authenticated'''),
      ('patient_lab_select', 'patient-laboratory', 'Allow authenticated users to view lab files', 'SELECT', 'auth.role() = ''authenticated'''),
      ('patient_lab_delete', 'patient-laboratory', 'Allow authenticated users to delete lab files', 'DELETE', 'auth.role() = ''authenticated''')
    ON CONFLICT (id) DO NOTHING;

    -- Storage policies for patient-imaging bucket
    INSERT INTO storage.policies (id, bucket_id, policy_name, action, policy_definition)
    VALUES 
      ('patient_imaging_upload', 'patient-imaging', 'Allow authenticated users to upload imaging files', 'INSERT', 'auth.role() = ''authenticated'''),
      ('patient_imaging_select', 'patient-imaging', 'Allow authenticated users to view imaging files', 'SELECT', 'auth.role() = ''authenticated'''),
      ('patient_imaging_delete', 'patient-imaging', 'Allow authenticated users to delete imaging files', 'DELETE', 'auth.role() = ''authenticated''')
    ON CONFLICT (id) DO NOTHING;
  `;

  const storagePoliciesResult = await executeSql(createStoragePoliciesQuery);
  if (!storagePoliciesResult.success) {
    console.log('❌ Failed to create storage policies');
    return;
  }

  console.log('✅ Storage policies created successfully!');

  console.log('\n🎉 SUCCESS! All patient media tables, buckets, and policies are ready!');
  console.log('📋 Created tables: patient_media, patient_laboratory, patient_imaging');
  console.log('🗂️  Created buckets: patient-media, patient-laboratory, patient-imaging');
  console.log('🔒 All RLS and storage policies configured');
}

main().catch(console.error);