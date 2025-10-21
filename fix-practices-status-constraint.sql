-- Fix practices status constraint to allow new status values
-- This migration updates the status check constraint to support the new Kanban workflow

-- Drop the old status check constraint
ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;

-- Add new status check constraint with updated values
ALTER TABLE practices ADD CONSTRAINT practices_status_check
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));

-- Update any existing practices with old status values
UPDATE practices SET status = 'active' WHERE status = 'approved';
UPDATE practices SET status = 'lead' WHERE status = 'pending';
UPDATE practices SET status = 'inactive' WHERE status NOT IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive');