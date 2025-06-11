-- Check if tooth_number column exists in invoice_services table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_services' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check recent invoice_services records to see if tooth_number data exists
SELECT 
    id, 
    code, 
    description,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_services' 
            AND column_name = 'tooth_number'
        ) THEN 'Column exists'
        ELSE 'Column missing'
    END as tooth_number_status
FROM invoice_services 
ORDER BY created_at DESC 
LIMIT 5;

-- Add tooth_number column if it doesn't exist
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