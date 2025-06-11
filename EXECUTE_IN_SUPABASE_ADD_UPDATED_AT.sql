-- ========================================
-- EXECUTE THIS SQL IN SUPABASE SQL EDITOR
-- ========================================
-- This script adds the missing updated_at column to invoice_services table
-- and creates an automatic trigger to maintain it

-- Step 1: Add the updated_at column if it doesn't exist
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_services' 
        AND column_name = 'updated_at'
    ) THEN
        -- Add the updated_at column
        ALTER TABLE invoice_services 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        RAISE NOTICE 'Added updated_at column to invoice_services table';
        
        -- Update existing records to have the same updated_at as created_at
        UPDATE invoice_services 
        SET updated_at = created_at 
        WHERE updated_at IS NULL;
        
        RAISE NOTICE 'Updated % existing records with created_at timestamp', 
                     (SELECT COUNT(*) FROM invoice_services WHERE updated_at = created_at);
    ELSE
        RAISE NOTICE 'Column updated_at already exists in invoice_services table';
    END IF;
END $$;

-- Step 2: Create or replace the trigger function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_invoice_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS tr_invoice_services_updated_at ON invoice_services;

CREATE TRIGGER tr_invoice_services_updated_at
    BEFORE UPDATE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_services_updated_at();

-- Step 4: Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_services' 
AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;

-- Step 5: Show sample data to confirm the column exists
SELECT 
    id,
    code,
    description,
    created_at,
    updated_at
FROM invoice_services 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 6: Test the trigger (optional - this will actually update a record)
/*
-- Uncomment and run this section to test the trigger
DO $$
DECLARE
    test_record_id UUID;
    old_updated_at TIMESTAMP WITH TIME ZONE;
    new_updated_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Find a test record
    SELECT id INTO test_record_id 
    FROM invoice_services 
    LIMIT 1;
    
    IF test_record_id IS NOT NULL THEN
        -- Get the current updated_at value
        SELECT updated_at INTO old_updated_at 
        FROM invoice_services 
        WHERE id = test_record_id;
        
        -- Update the record (this should trigger the updated_at change)
        UPDATE invoice_services 
        SET notes = COALESCE(notes, '') || ' [Test]'
        WHERE id = test_record_id;
        
        -- Get the new updated_at value
        SELECT updated_at INTO new_updated_at 
        FROM invoice_services 
        WHERE id = test_record_id;
        
        -- Check if the trigger worked
        IF new_updated_at > old_updated_at THEN
            RAISE NOTICE 'SUCCESS: Trigger working! Updated from % to %', old_updated_at, new_updated_at;
        ELSE
            RAISE WARNING 'ISSUE: Trigger may not be working. Old: %, New: %', old_updated_at, new_updated_at;
        END IF;
        
        -- Clean up the test
        UPDATE invoice_services 
        SET notes = REPLACE(notes, ' [Test]', '')
        WHERE id = test_record_id;
    ELSE
        RAISE NOTICE 'No records found in invoice_services table to test trigger';
    END IF;
END $$;
*/

-- Summary message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ Added updated_at column to invoice_services';
    RAISE NOTICE '✅ Created trigger function for automatic updates';
    RAISE NOTICE '✅ Created trigger on UPDATE operations';
    RAISE NOTICE '✅ Populated existing records with timestamps';
    RAISE NOTICE '';
    RAISE NOTICE 'The invoice_services table now has:';
    RAISE NOTICE '- created_at: Set when record is inserted';
    RAISE NOTICE '- updated_at: Updated automatically on every change';
    RAISE NOTICE '';
    RAISE NOTICE 'This provides full audit trail capabilities!';
    RAISE NOTICE '==============================================';
END $$;