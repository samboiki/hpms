-- Add system_patient_reference_number column to patients table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' 
        AND column_name = 'system_patient_reference_number'
    ) THEN
        ALTER TABLE patients 
        ADD COLUMN system_patient_reference_number INTEGER;
    END IF;
END $$;

-- Create function to get next system patient reference number
CREATE OR REPLACE FUNCTION get_next_system_patient_reference_number()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(system_patient_reference_number), 0) + 1 
    INTO next_number
    FROM patients;
    
    RETURN next_number;
END;
$$;

-- Create function to assign sequential numbers to existing patients
CREATE OR REPLACE FUNCTION assign_system_patient_reference_numbers()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    patient_record RECORD;
    current_number INTEGER := 1;
BEGIN
    -- Update existing patients with sequential numbers
    FOR patient_record IN 
        SELECT id 
        FROM patients 
        ORDER BY created_at, id
    LOOP
        UPDATE patients 
        SET system_patient_reference_number = current_number
        WHERE id = patient_record.id;
        
        current_number := current_number + 1;
    END LOOP;
END;
$$;

-- Create trigger function to auto-assign system patient reference number on INSERT
CREATE OR REPLACE FUNCTION assign_system_patient_reference_number_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign if system_patient_reference_number is not already set
    IF NEW.system_patient_reference_number IS NULL THEN
        NEW.system_patient_reference_number := get_next_system_patient_reference_number();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-assign system patient reference number
DROP TRIGGER IF EXISTS trigger_assign_system_patient_reference_number ON patients;
CREATE TRIGGER trigger_assign_system_patient_reference_number
    BEFORE INSERT ON patients
    FOR EACH ROW
    EXECUTE FUNCTION assign_system_patient_reference_number_trigger();

-- Execute the function to assign numbers to existing patients
SELECT assign_system_patient_reference_numbers();

-- Add NOT NULL constraint after populating existing data
ALTER TABLE patients 
ALTER COLUMN system_patient_reference_number SET NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_patients_system_patient_reference_number 
ON patients(system_patient_reference_number);

-- Drop the temporary function (no longer needed)
DROP FUNCTION assign_system_patient_reference_numbers();

-- Update the add_invoice_to_batch function to use system_patient_reference_number from patients
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
    v_member_initials TEXT;
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

    -- Calculate member initials from ALL words in first_name
    -- Example: "Elisabeth Martha" becomes "EM", "Sam" becomes "S", "Gladys Da-Luz" becomes "GD"
    SELECT string_agg(UPPER(SUBSTRING(name_part FROM 1 FOR 1)), '')
    INTO v_member_initials
    FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS name_part
    WHERE LENGTH(TRIM(name_part)) > 0 AND name_part != '';

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
            system_transaction_number
        ) VALUES (
            p_batch_id, p_invoice_id, v_transaction_number,
            v_patient.system_patient_reference_number::TEXT,
            v_batch.medical_aid_reference, COALESCE(v_medical_aid.membership_number, ''),
            UPPER(v_patient.last_name), 
            COALESCE(v_member_initials, UPPER(SUBSTRING(v_patient.first_name FROM 1 FOR 1))), 
            UPPER(v_patient.first_name), 
            TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'), -- <<<< NEW: Format as YYYYMMDD
            v_service.code, v_service.total_price, v_service.description, v_invoice.issue_date,
            v_service.quantity, v_invoice.invoice_number, v_batch.practice_number,
            COALESCE(v_practitioner_hpcsa, 'NOT_SET'),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), v_patient.id_number,
            v_patient.id, v_invoice.visit_id,
            v_service.system_transaction_number
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Update invoice to link to batch
    UPDATE invoices_enhanced SET batch_id = p_batch_id WHERE id = p_invoice_id;
END;
$function$;

-- Update existing batch_details records to populate system_patient_reference_number from patients
UPDATE batch_details 
SET system_patient_reference_number = (
    SELECT patients.system_patient_reference_number::TEXT
    FROM patients 
    WHERE patients.id = batch_details.patient_id
    LIMIT 1
)
WHERE batch_details.system_patient_reference_number IS NOT NULL;

-- Verify the results
SELECT 
    COUNT(*) as total_patients,
    MIN(system_patient_reference_number) as min_number,
    MAX(system_patient_reference_number) as max_number
FROM patients;

-- Verify batch_details update
SELECT 
    COUNT(*) as total_batch_details,
    COUNT(CASE WHEN system_patient_reference_number ~ '^[0-9]+$' THEN 1 END) as with_patient_ref_number
FROM batch_details;