-- Migration: Fix foreign key constraint for invoices_enhanced.batch_id
-- Created: 2025-06-15
-- Description: Adds missing foreign key constraint between invoices_enhanced.batch_id and batch_headers.id

-- First, clean up any invalid batch_id references
UPDATE invoices_enhanced 
SET batch_id = NULL 
WHERE batch_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM batch_headers bh 
    WHERE bh.id = invoices_enhanced.batch_id
  );

-- Add the foreign key constraint if it doesn't already exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'invoices_enhanced' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_invoices_enhanced_batch_id'
  ) THEN
    -- Add the constraint
    ALTER TABLE invoices_enhanced 
    ADD CONSTRAINT fk_invoices_enhanced_batch_id 
    FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
    
    RAISE NOTICE 'Foreign key constraint fk_invoices_enhanced_batch_id added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint fk_invoices_enhanced_batch_id already exists';
  END IF;
END $$;