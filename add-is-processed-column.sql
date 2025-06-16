-- Add is_processed column to patient_documents table
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;

-- Add comment to document the column purpose
COMMENT ON COLUMN patient_documents.is_processed IS 'Indicates whether the document has been processed/reviewed by staff';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patient_documents' 
AND column_name = 'is_processed';