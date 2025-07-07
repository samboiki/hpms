-- Add system_transaction_number column to invoice_services table
ALTER TABLE invoice_services 
ADD COLUMN system_transaction_number INTEGER;

-- Create function to get next system transaction number
CREATE OR REPLACE FUNCTION get_next_system_transaction_number()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(system_transaction_number), 0) + 1 
    INTO next_number
    FROM invoice_services;
    
    RETURN next_number;
END;
$$;

-- Create function to assign sequential numbers to existing records
CREATE OR REPLACE FUNCTION assign_system_transaction_numbers()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    service_record RECORD;
    current_number INTEGER := 1;
BEGIN
    -- Update existing invoice_services with sequential numbers
    FOR service_record IN 
        SELECT id 
        FROM invoice_services 
        ORDER BY created_at, id
    LOOP
        UPDATE invoice_services 
        SET system_transaction_number = current_number
        WHERE id = service_record.id;
        
        current_number := current_number + 1;
    END LOOP;
END;
$$;

-- Create trigger function to auto-assign system transaction number on INSERT
CREATE OR REPLACE FUNCTION assign_system_transaction_number_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign if system_transaction_number is not already set
    IF NEW.system_transaction_number IS NULL THEN
        NEW.system_transaction_number := get_next_system_transaction_number();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-assign system transaction number
CREATE TRIGGER trigger_assign_system_transaction_number
    BEFORE INSERT ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION assign_system_transaction_number_trigger();

-- Execute the function to assign numbers to existing records
SELECT assign_system_transaction_numbers();

-- Add NOT NULL constraint after populating existing data
ALTER TABLE invoice_services 
ALTER COLUMN system_transaction_number SET NOT NULL;

-- Create index for performance
CREATE INDEX idx_invoice_services_system_transaction_number 
ON invoice_services(system_transaction_number);

-- Drop the temporary function (no longer needed)
DROP FUNCTION assign_system_transaction_numbers();

-- Verify the results
SELECT 
    COUNT(*) as total_services,
    MIN(system_transaction_number) as min_number,
    MAX(system_transaction_number) as max_number
FROM invoice_services;