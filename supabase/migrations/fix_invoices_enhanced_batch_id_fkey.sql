-- Fix foreign key constraint for invoices_enhanced.batch_id
-- Generated: 2025-06-15
-- 
-- This migration adds the missing foreign key constraint between
-- invoices_enhanced.batch_id and batch_headers.id

-- Add foreign key constraint for invoices_enhanced.batch_id
ALTER TABLE invoices_enhanced 
ADD CONSTRAINT fk_invoices_enhanced_batch_id 
FOREIGN KEY (batch_id) REFERENCES batch_headers(id);

-- Verify the constraint was created
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'invoices_enhanced'
    AND kcu.column_name = 'batch_id';