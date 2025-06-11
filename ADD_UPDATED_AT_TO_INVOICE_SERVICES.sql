-- Add missing updated_at column to invoice_services table
-- This script safely adds the column and creates a trigger to automatically update it

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
        
        RAISE NOTICE 'Updated existing records with created_at timestamp';
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

-- Step 3: Create the trigger if it doesn't exist
DO $$
BEGIN
    -- Drop the trigger if it exists (to recreate it)
    DROP TRIGGER IF EXISTS tr_invoice_services_updated_at ON invoice_services;
    
    -- Create the trigger
    CREATE TRIGGER tr_invoice_services_updated_at
        BEFORE UPDATE ON invoice_services
        FOR EACH ROW
        EXECUTE FUNCTION update_invoice_services_updated_at();
        
    RAISE NOTICE 'Created trigger to automatically update updated_at column';
END $$;

-- Step 4: Verify the changes
\echo 'Verifying invoice_services table structure:'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_services' 
ORDER BY ordinal_position;

-- Step 5: Test the trigger by updating a record (if any exist)
\echo 'Testing the updated_at trigger:'
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
        
        -- Wait a moment to ensure timestamp difference
        PERFORM pg_sleep(0.1);
        
        -- Update the record (this should trigger the updated_at change)
        UPDATE invoice_services 
        SET notes = COALESCE(notes, '') || ' [Trigger test]'
        WHERE id = test_record_id;
        
        -- Get the new updated_at value
        SELECT updated_at INTO new_updated_at 
        FROM invoice_services 
        WHERE id = test_record_id;
        
        -- Check if the trigger worked
        IF new_updated_at > old_updated_at THEN
            RAISE NOTICE 'SUCCESS: Trigger is working correctly. Old: %, New: %', old_updated_at, new_updated_at;
        ELSE
            RAISE WARNING 'ISSUE: Trigger may not be working. Old: %, New: %', old_updated_at, new_updated_at;
        END IF;
        
        -- Clean up the test note
        UPDATE invoice_services 
        SET notes = REPLACE(notes, ' [Trigger test]', '')
        WHERE id = test_record_id;
    ELSE
        RAISE NOTICE 'No records found in invoice_services table to test trigger';
    END IF;
END $$;

-- Step 6: Show summary
\echo 'Summary of changes:'
\echo '1. Added updated_at column to invoice_services table'
\echo '2. Populated existing records with created_at timestamp'
\echo '3. Created trigger function to automatically update updated_at on record changes'
\echo '4. Created trigger to call the function on every UPDATE'
\echo ''
\echo 'The invoice_services table now has proper audit trail capabilities!'