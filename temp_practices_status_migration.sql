-- Drop the old status check constraint
ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;

-- Add new status check constraint with updated values
ALTER TABLE practices ADD CONSTRAINT practices_status_check 
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));
