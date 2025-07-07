-- EMERGENCY: Completely disable RLS for patient_documents table
-- Use this ONLY for testing - not recommended for production

-- Disable RLS entirely for patient_documents table
ALTER TABLE patient_documents DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  'RLS Status' as description
FROM pg_tables 
WHERE tablename = 'patient_documents';

-- Test query - this should work without any restrictions
SELECT COUNT(*) as document_count FROM patient_documents;

SELECT 'RLS DISABLED - Document uploads should work now!' as status;