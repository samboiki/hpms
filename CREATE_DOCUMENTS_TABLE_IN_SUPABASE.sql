-- Execute this SQL directly in the Supabase SQL Editor
-- Copy and paste this entire script into the Supabase Dashboard > SQL Editor

-- Create patient_documents table to track uploaded files
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'lab_results', 'imaging', 'referrals', 'consent_forms', 'insurance', 'prescriptions', 'discharge_summaries')),
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_visit_id ON patient_documents(visit_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON patient_documents(category);
CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON patient_documents(created_at);

-- Enable RLS
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view patient documents for their practice" ON patient_documents
  FOR SELECT 
  USING (
    patient_id IN (
      SELECT p.id 
      FROM patients p
      JOIN users u ON u.practice_id IS NOT NULL
      WHERE auth.uid() = u.id
    )
  );

CREATE POLICY "Users can insert patient documents for their practice" ON patient_documents
  FOR INSERT 
  WITH CHECK (
    patient_id IN (
      SELECT p.id 
      FROM patients p
      JOIN users u ON u.practice_id IS NOT NULL
      WHERE auth.uid() = u.id
    )
  );

CREATE POLICY "Users can update patient documents for their practice" ON patient_documents
  FOR UPDATE 
  USING (
    patient_id IN (
      SELECT p.id 
      FROM patients p
      JOIN users u ON u.practice_id IS NOT NULL
      WHERE auth.uid() = u.id
    )
  );

CREATE POLICY "Users can delete patient documents for their practice" ON patient_documents
  FOR DELETE 
  USING (
    patient_id IN (
      SELECT p.id 
      FROM patients p
      JOIN users u ON u.practice_id IS NOT NULL
      WHERE auth.uid() = u.id
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_patient_documents_updated_at 
  BEFORE UPDATE ON patient_documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE patient_documents IS 'Stores metadata for patient document uploads including files, images, and other clinical documents';

-- Verify table was created
SELECT 'patient_documents table created successfully!' AS status;