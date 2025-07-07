-- Update the add_invoice_to_batch function to use system_transaction_number from invoice_services
CREATE OR REPLACE FUNCTION public.add_invoice_to_batch(p_batch_id uuid, p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_invoice RECORD;
    v_patient RECORD;
    v_medical_aid RECORD;
    v_batch RECORD;
    v_service RECORD;
    v_practitioner_hpcsa TEXT;
    v_transaction_number INTEGER;
BEGIN
    -- Get batch, invoice, and patient info
    SELECT * INTO v_batch FROM batch_headers WHERE id = p_batch_id;
    SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = p_invoice_id;
    SELECT * INTO v_patient FROM patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;

    -- Get the treating doctor's HPCSA number from the users table
    SELECT u.hpcsa_number INTO v_practitioner_hpcsa
    FROM users u
    WHERE u.id = v_invoice.practitioner_id;

    -- Get next transaction number for the batch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number
    FROM batch_details WHERE batch_header_id = p_batch_id;

    -- Add each service from invoice_services using its system_transaction_number
    FOR v_service IN SELECT * FROM invoice_services WHERE invoice_id = p_invoice_id ORDER BY system_transaction_number
    LOOP
        INSERT INTO batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch,
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number,
            gender, patient_id_number, patient_id, visit_id,
            system_transaction_number -- <<<< NEW: Use the system_transaction_number from invoice_services
        ) VALUES (
            p_batch_id, p_invoice_id, v_transaction_number,
            v_patient.id::TEXT, v_batch.medical_aid_reference, COALESCE(v_medical_aid.membership_number, ''),
            UPPER(v_patient.last_name), UPPER(SUBSTRING(v_patient.first_name FROM 1 FOR 1)),
            UPPER(v_patient.first_name || ' ' || v_patient.last_name), v_patient.date_of_birth,
            v_service.code, v_service.total_price, v_service.description, v_invoice.issue_date,
            v_service.quantity, v_invoice.invoice_number, v_batch.practice_number,
            COALESCE(v_practitioner_hpcsa, 'NOT_SET'),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), v_patient.id_number,
            v_patient.id, v_invoice.visit_id,
            v_service.system_transaction_number -- <<<< NEW: Copy the system_transaction_number
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Update invoice to link to batch
    UPDATE invoices_enhanced SET batch_id = p_batch_id WHERE id = p_invoice_id;
END;
$function$;

-- Add system_transaction_number column to batch_details if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'batch_details' 
        AND column_name = 'system_transaction_number'
    ) THEN
        ALTER TABLE batch_details 
        ADD COLUMN system_transaction_number INTEGER;
    END IF;
END $$;

-- Update existing batch_details records to populate system_transaction_number from invoice_services
UPDATE batch_details 
SET system_transaction_number = (
    SELECT invoice_services.system_transaction_number
    FROM invoice_services 
    WHERE invoice_services.invoice_id = batch_details.invoice_id
    AND invoice_services.code = batch_details.bhf_tariff_code
    AND invoice_services.total_price = batch_details.service_amount
    LIMIT 1
)
WHERE batch_details.system_transaction_number IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_batch_details_system_transaction_number 
ON batch_details(system_transaction_number);

-- Verify the update
SELECT 
    COUNT(*) as total_batch_details,
    COUNT(system_transaction_number) as with_system_number,
    MIN(system_transaction_number) as min_number,
    MAX(system_transaction_number) as max_number
FROM batch_details;