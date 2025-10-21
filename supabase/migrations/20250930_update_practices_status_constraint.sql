-- Migration: Update practices table status constraint
-- Date: 2025-09-30
-- Description: Add new status values for practice lifecycle management

-- Drop the old status check constraint
ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;

-- Add new status check constraint with updated values
-- Status values:
--   - lead: Initial contact/interest
--   - contacted: Practice has been reached out to
--   - qualified: Practice meets criteria for onboarding
--   - onboarding: Practice is in setup process
--   - active: Practice is fully operational
--   - inactive: Practice is not currently active
ALTER TABLE practices ADD CONSTRAINT practices_status_check
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT practices_status_check ON practices IS
'Enforces valid practice lifecycle status values: lead, contacted, qualified, onboarding, active, inactive';