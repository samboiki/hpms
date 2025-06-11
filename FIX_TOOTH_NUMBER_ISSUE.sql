-- Fix tooth number issue: Add column and update the invoice service mapping

-- 1. Add tooth_number column to invoice_services table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_services' 
        AND column_name = 'tooth_number'
    ) THEN
        ALTER TABLE invoice_services 
        ADD COLUMN tooth_number TEXT;
        
        RAISE NOTICE 'Added tooth_number column to invoice_services table';
    ELSE
        RAISE NOTICE 'tooth_number column already exists in invoice_services table';
    END IF;
END $$;

-- 2. Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_services' 
  AND table_schema = 'public'
  AND column_name IN ('tooth_number', 'code', 'description')
ORDER BY ordinal_position;