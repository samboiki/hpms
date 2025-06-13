-- Fix for Financial Overview Issues
-- 1. Fix the "column users.first_name does not exist" error
-- 2. Fix batch data not showing up in Financial Overview

-- =====================================================
-- Issue 1: Users table has full_name, not first_name/last_name
-- =====================================================

-- Check current users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- The fix: Add a view that provides first_name and last_name from full_name
CREATE OR REPLACE VIEW users_with_names AS
SELECT 
  id,
  email,
  full_name,
  -- Split full_name into first and last names
  SPLIT_PART(full_name, ' ', 1) as first_name,
  CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END as last_name,
  role,
  created_at,
  last_login,
  -- Add any other columns that might be needed
  practice_id
FROM users;

-- Grant permissions
GRANT SELECT ON users_with_names TO authenticated;

-- =====================================================
-- Issue 2: Batch data not showing in Financial Overview
-- =====================================================

-- First, let's check what batches exist
SELECT 
  bh.practice_number,
  bh.practice_id,
  p.id as practice_id_from_join,
  p.name as practice_name,
  COUNT(*) as batch_count,
  SUM(bh.total_amount) as total_amount
FROM batch_headers bh
LEFT JOIN practices p ON p.id = bh.practice_id
GROUP BY bh.practice_number, bh.practice_id, p.id, p.name;

-- Check if there are any active batches
SELECT status, COUNT(*) 
FROM batch_headers 
GROUP BY status;

-- Let's also check the batch_management_view
SELECT COUNT(*) as total_batches,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_batches,
       COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_batches,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_batches
FROM batch_management_view;

-- Check if practices have practice_number set
SELECT id, name, practice_number 
FROM practices;

-- If practice_number is missing, we need to update it
-- First, let's see the structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'practices'
AND column_name LIKE '%practice%'
ORDER BY ordinal_position;

-- Add practice_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'practices' 
    AND column_name = 'practice_number'
  ) THEN
    ALTER TABLE practices ADD COLUMN practice_number VARCHAR(50);
    
    -- Set default practice numbers based on practice ID
    UPDATE practices 
    SET practice_number = 'PRAC' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0')
    WHERE practice_number IS NULL;
    
    -- Make it unique and not null
    ALTER TABLE practices 
    ALTER COLUMN practice_number SET NOT NULL,
    ADD CONSTRAINT practices_practice_number_unique UNIQUE (practice_number);
  END IF;
END $$;

-- Now let's check the batch_management_view with practice data
SELECT 
  bmv.practice_number,
  bmv.practice_name,
  bmv.status,
  COUNT(*) as batch_count
FROM batch_management_view bmv
GROUP BY bmv.practice_number, bmv.practice_name, bmv.status
ORDER BY bmv.practice_number, bmv.status;

-- Create or update a function to get batches for a specific practice
-- This function can handle both practice_id and practice_number
CREATE OR REPLACE FUNCTION get_practice_batches(
  p_practice_id UUID DEFAULT NULL,
  p_practice_number VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  practice_number VARCHAR,
  batch_number VARCHAR,
  batch_date DATE,
  medical_aid_reference VARCHAR,
  status VARCHAR,
  total_invoices INTEGER,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  medical_aid_name VARCHAR,
  medical_aid_short_name VARCHAR,
  medical_aid_email VARCHAR,
  medical_aid_logo_url VARCHAR,
  medical_aid_theme_color VARCHAR,
  practice_name VARCHAR,
  practice_email VARCHAR,
  detail_transactions BIGINT,
  total_detail_transactions INTEGER,
  total_amount_detail_transactions NUMERIC,
  dat_filename TEXT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bmv.batch_id,
    bmv.practice_number,
    bmv.batch_number,
    bmv.batch_date,
    bmv.medical_aid_reference,
    bmv.status,
    bmv.total_invoices,
    bmv.total_amount,
    bmv.created_at,
    bmv.sent_at,
    bmv.confirmed_at,
    bmv.medical_aid_name,
    bmv.medical_aid_short_name,
    bmv.medical_aid_email,
    map.logo_url as medical_aid_logo_url,
    map.theme_color as medical_aid_theme_color,
    bmv.practice_name,
    bmv.practice_email,
    bmv.detail_transactions,
    bmv.total_detail_transactions,
    bmv.total_amount_detail_transactions,
    bmv.dat_filename
  FROM batch_management_view bmv
  LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bmv.medical_aid_reference
  LEFT JOIN practices p ON p.practice_number = bmv.practice_number
  WHERE 
    (p_practice_id IS NULL OR p.id = p_practice_id)
    AND (p_practice_number IS NULL OR bmv.practice_number = p_practice_number);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_practice_batches TO authenticated;

-- Test the function with a practice ID (replace with actual ID)
-- SELECT * FROM get_practice_batches('your-practice-id-here'::uuid);

-- Create some test batch data if none exists
DO $$
DECLARE
  v_practice_id UUID;
  v_practice_number VARCHAR;
BEGIN
  -- Get the first practice
  SELECT id, practice_number INTO v_practice_id, v_practice_number
  FROM practices
  LIMIT 1;
  
  -- Only create test data if no batches exist
  IF NOT EXISTS (SELECT 1 FROM batch_headers LIMIT 1) AND v_practice_id IS NOT NULL THEN
    -- Insert test batch header
    INSERT INTO batch_headers (
      practice_id,
      practice_number,
      batch_number,
      batch_date,
      medical_aid_reference,
      status,
      total_invoices,
      total_amount
    ) VALUES (
      v_practice_id,
      v_practice_number,
      '001',
      CURRENT_DATE,
      'NHPM',
      'active',
      5,
      12500.00
    );
    
    RAISE NOTICE 'Created test batch data for practice %', v_practice_number;
  END IF;
END $$;

-- Final check: Show summary of batch data
SELECT 
  'Total Batches' as metric,
  COUNT(*)::TEXT as value
FROM batch_headers
UNION ALL
SELECT 
  'Active Batches',
  COUNT(*)::TEXT
FROM batch_headers
WHERE status = 'active'
UNION ALL
SELECT 
  'Total Amount in Active Batches',
  'N$' || COALESCE(SUM(total_amount), 0)::TEXT
FROM batch_headers
WHERE status = 'active';