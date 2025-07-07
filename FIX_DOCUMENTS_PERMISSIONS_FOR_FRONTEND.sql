-- Fix Documents Permissions for Frontend (Anon Key Access)
-- This fixes the RLS policies to work with authenticated users using anon key

-- 1. First, ensure the table exists and has proper structure
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'lab_results', 'imaging', 'referrals', 'consent_forms', 'insurance', 'prescriptions', 'discharge_summaries')),
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_visit_id ON patient_documents(visit_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON patient_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON patient_documents(category);

-- 3. Enable RLS
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view documents for their practice patients" ON patient_documents;
DROP POLICY IF EXISTS "Users can insert documents for their practice patients" ON patient_documents;
DROP POLICY IF EXISTS "Users can update documents for their practice patients" ON patient_documents;
DROP POLICY IF EXISTS "Users can delete documents for their practice patients" ON patient_documents;

-- 5. Create permissive RLS policies that work with authenticated users
-- Allow authenticated users to view documents for patients in their practice
CREATE POLICY "Authenticated users can view patient documents"
  ON patient_documents FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM patients p
      JOIN users u ON u.practice_id = p.practice_id
      WHERE p.id = patient_documents.patient_id
      AND u.id = auth.uid()
    )
  );

-- Allow authenticated users to insert documents for patients in their practice
CREATE POLICY "Authenticated users can insert patient documents"
  ON patient_documents FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM patients p
      JOIN users u ON u.practice_id = p.practice_id
      WHERE p.id = patient_documents.patient_id
      AND u.id = auth.uid()
    )
  );

-- Allow authenticated users to update documents for patients in their practice
CREATE POLICY "Authenticated users can update patient documents"
  ON patient_documents FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM patients p
      JOIN users u ON u.practice_id = p.practice_id
      WHERE p.id = patient_documents.patient_id
      AND u.id = auth.uid()
    )
  );

-- Allow authenticated users to delete documents for patients in their practice
CREATE POLICY "Authenticated users can delete patient documents"
  ON patient_documents FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM patients p
      JOIN users u ON u.practice_id = p.practice_id
      WHERE p.id = patient_documents.patient_id
      AND u.id = auth.uid()
    )
  );

-- 6. Create storage policies for the documents bucket
-- First, create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false, 
  52428800, -- 50MB
  ARRAY[
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
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 7. Create storage policies
-- Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to view documents for their practice
CREATE POLICY IF NOT EXISTS "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete documents for their practice
CREATE POLICY IF NOT EXISTS "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- 8. Grant necessary permissions
GRANT ALL ON patient_documents TO authenticated;
GRANT ALL ON patient_documents TO service_role;

-- 9. Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_patient_documents_updated_at ON patient_documents;
CREATE TRIGGER update_patient_documents_updated_at
  BEFORE UPDATE ON patient_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Test the setup
-- This should return success if everything is configured correctly
DO $$
BEGIN
  RAISE NOTICE 'Documents table and permissions setup completed successfully!';
  RAISE NOTICE 'Table exists: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patient_documents'));
  RAISE NOTICE 'RLS enabled: %', (SELECT rowsecurity FROM pg_tables WHERE tablename = 'patient_documents');
  RAISE NOTICE 'Bucket exists: %', (SELECT EXISTS (SELECT FROM storage.buckets WHERE name = 'documents'));
END $$;