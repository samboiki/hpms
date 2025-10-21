-- Add new columns to practices table for complete registration data
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS number_of_branches INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS branch_names TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS professional_email_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS professional_email_addresses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_hosting_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_monthly_premium DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 1600,
ADD COLUMN IF NOT EXISTS branches_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

-- Add new columns to branches table for cost tracking
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;

-- Add comments to document the columns
COMMENT ON COLUMN practices.number_of_branches IS 'Total number of practice branches';
COMMENT ON COLUMN practices.branch_names IS 'Array of branch names';
COMMENT ON COLUMN practices.professional_email_count IS 'Number of professional email addresses';
COMMENT ON COLUMN practices.professional_email_addresses IS 'Array of professional email addresses';
COMMENT ON COLUMN practices.marketing_budget IS 'Monthly marketing budget in currency';
COMMENT ON COLUMN practices.website_hosting_enabled IS 'Whether website hosting is enabled';
COMMENT ON COLUMN practices.total_monthly_premium IS 'Total calculated monthly premium';
COMMENT ON COLUMN practices.base_price IS 'Base monthly subscription price';
COMMENT ON COLUMN practices.branches_cost IS 'Additional monthly cost for extra branches';
COMMENT ON COLUMN practices.website_cost IS 'Monthly website hosting cost';
COMMENT ON COLUMN practices.emails_cost IS 'Monthly cost for professional emails';
COMMENT ON COLUMN practices.tax_number IS 'Tax registration number';
COMMENT ON COLUMN practices.registration_number IS 'Business registration number';
COMMENT ON COLUMN branches.monthly_cost IS 'Monthly cost for this branch';
COMMENT ON COLUMN branches.is_main_branch IS 'Whether this is the main/primary branch';
