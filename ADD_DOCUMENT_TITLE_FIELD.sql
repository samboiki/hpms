-- Add title field to patient_documents table
-- Execute this in Supabase Dashboard > SQL Editor

-- Add title column to patient_documents table
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Update existing documents to use file name as title (optional)
UPDATE patient_documents 
SET title = original_name 
WHERE title IS NULL;

-- Add index for searching by title
CREATE INDEX IF NOT EXISTS idx_patient_documents_title 
ON patient_documents(title);

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'patient_documents' 
ORDER BY ordinal_position;