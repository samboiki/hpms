-- Execute this SQL directly in Supabase SQL Editor
-- This is a single transaction that adds all required columns

DO $$
BEGIN
  -- Add columns to practices table
  ALTER TABLE practices
  ADD COLUMN IF NOT EXISTS number_of_branches INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS branch_names TEXT[],
  ADD COLUMN IF NOT EXISTS professional_email_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS professional_email_addresses TEXT[],
  ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_hosting_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_monthly_premium DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 1600,
  ADD COLUMN IF NOT EXISTS branches_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

  -- Add columns to branches table
  ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;

  RAISE NOTICE 'Migration completed successfully!';
END $$;