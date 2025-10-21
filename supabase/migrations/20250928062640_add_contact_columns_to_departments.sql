-- Add contact_email and contact_phone columns to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;