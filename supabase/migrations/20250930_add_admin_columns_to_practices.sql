-- Migration: Add admin/manager columns to practices table
-- Date: 2025-09-30
-- Description: Adds administrator/manager contact and credential columns to practices table

-- Add admin/manager columns to practices table
ALTER TABLE practices
ADD COLUMN IF NOT EXISTS admin_name TEXT,
ADD COLUMN IF NOT EXISTS admin_email TEXT,
ADD COLUMN IF NOT EXISTS admin_phone TEXT,
ADD COLUMN IF NOT EXISTS admin_role TEXT,
ADD COLUMN IF NOT EXISTS admin_job_title TEXT,
ADD COLUMN IF NOT EXISTS admin_hpcsa_number TEXT,
ADD COLUMN IF NOT EXISTS admin_password TEXT;

-- Add comments to document these fields
COMMENT ON COLUMN practices.admin_name IS 'Practice administrator/manager full name';
COMMENT ON COLUMN practices.admin_email IS 'Practice administrator/manager email';
COMMENT ON COLUMN practices.admin_phone IS 'Practice administrator/manager phone';
COMMENT ON COLUMN practices.admin_role IS 'Practice administrator role (practice_admin, doctor, nurse, etc.)';
COMMENT ON COLUMN practices.admin_job_title IS 'Practice administrator job title';
COMMENT ON COLUMN practices.admin_hpcsa_number IS 'HPCSA number if administrator is a doctor';
COMMENT ON COLUMN practices.admin_password IS 'Hashed password for admin user';
