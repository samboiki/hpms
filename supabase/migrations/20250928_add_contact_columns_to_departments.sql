-- Migration: Add contact columns to departments table
-- Date: 2024-09-28
-- Description: Adds contact_email and contact_phone columns to the departments table

-- Add contact email and phone columns to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add comments for documentation
COMMENT ON COLUMN departments.contact_email IS 'Primary email contact for the department';
COMMENT ON COLUMN departments.contact_phone IS 'Primary phone contact for the department';

-- Verify the migration by selecting column information
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'departments'
  AND table_schema = 'public'
  AND column_name IN ('contact_email', 'contact_phone')
ORDER BY ordinal_position;