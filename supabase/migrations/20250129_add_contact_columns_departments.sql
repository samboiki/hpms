-- Add contact columns to departments table if they don't exist
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add comments for documentation
COMMENT ON COLUMN departments.contact_email IS 'Department contact email address';
COMMENT ON COLUMN departments.contact_phone IS 'Department contact phone number';