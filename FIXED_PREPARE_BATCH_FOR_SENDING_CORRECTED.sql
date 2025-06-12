-- Fixed prepare_batch_for_sending function - CORRECTED VERSION
-- This addresses the "column map.provider_code does not exist" error
-- Uses actual table structure: medical_aid_reference instead of provider_code

CREATE OR REPLACE FUNCTION prepare_batch_for_sending(p_batch_id UUID)
RETURNS TABLE (
    file_content TEXT,
    recipient_email TEXT,
    file_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_header_line TEXT;
    v_detail_lines TEXT;
    v_trailer_line TEXT;
    v_batch_header RECORD;
    v_batch_trailer RECORD;
BEGIN
    -- Get batch header information
    SELECT bh.*, map.email as submission_email, map.medical_aid_reference
    INTO v_batch_header
    FROM batch_headers bh
    LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
    WHERE bh.id = p_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch header not found for batch_id: %', p_batch_id;
    END IF;
    
    -- Get batch trailer information  
    SELECT *
    INTO v_batch_trailer
    FROM batch_trailer bt
    WHERE bt.batch_header_id = p_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch trailer not found for batch_id: %', p_batch_id;
    END IF;
    
    -- Build header line (H record)
    v_header_line := CONCAT_WS(',',
        '1',                                    -- Record type
        v_batch_header.practice_number,         -- Practice number
        v_batch_header.system_identification,   -- System ID
        v_batch_header.transaction_type,        -- Transaction type
        v_batch_header.batch_number,           -- Batch number
        TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'), -- Batch date
        'ONEHEALTH',                           -- Source software name
        v_batch_header.source_software_version, -- Software version
        '1.6'                                  -- File format version
    );
    
    -- Build detail lines (D records) - all fields in proper EDI order
    SELECT STRING_AGG(
        CONCAT_WS(',',
            bd.transaction_id,                          -- D
            bd.transaction_number_in_batch,             -- Transaction number
            bd.system_transaction_number,               -- System transaction number
            LPAD(bd.system_patient_reference_number::TEXT, 7, '0'), -- Patient reference (7 digits)
            bd.type_of_service,                         -- T
            bd.medical_aid_reference,                   -- NMC1, etc.
            COALESCE(bd.not_used_1, ''),               -- Empty field
            bd.medical_aid_membership_number,           -- Member number
            bd.member_surname,                          -- Surname
            bd.member_initials,                         -- Initials  
            bd.patient_name,                            -- Patient name
            bd.patient_date_of_birth,                   -- DOB (YYYYMMDD)
            bd.bhf_tariff_code,                         -- Tariff code
            REPLACE(bd.service_amount::TEXT, '.', ''),  -- Amount (no decimal)
            bd.diagnosis,                               -- Diagnosis description
            REPLACE(bd.discount_amount::TEXT, '.', ''), -- Discount (no decimal)
            TO_CHAR(bd.service_date::DATE, 'YYYYMMDD'), -- Service date
            REPLACE(bd.number_of_services::TEXT, '.', ''), -- Number of services
            bd.service_fee,                             -- Service fee code
            COALESCE(bd.modifier_1, ''),               -- Modifier 1
            COALESCE(bd.modifier_2, ''),               -- Modifier 2
            COALESCE(bd.modifier_3, ''),               -- Modifier 3
            COALESCE(bd.modifier_4, ''),               -- Modifier 4
            bd.invoice_number,                          -- Invoice number
            COALESCE(bd.referring_doctor, ''),         -- Referring doctor
            COALESCE(bd.nappi_code, ''),               -- NAPPI code
            COALESCE(bd.referred_to_practice_number, ''), -- Referred to practice
            COALESCE(bd.not_used_2, ''),               -- Empty field
            bd.practice_number,                         -- Practice number
            COALESCE(bd.hospital_indicator, ''),       -- Hospital indicator
            COALESCE(bd.authorisation_number, ''),     -- Auth number
            COALESCE(bd.resubmission_flag, ''),        -- Resubmission flag
            COALESCE(bd.diagnostic_code, ''),          -- Diagnostic code
            COALESCE(bd.diagnostic_code_type, ''),     -- Diagnostic code type
            COALESCE(bd.dosage_description, ''),       -- Dosage
            COALESCE(bd.not_used_3, ''),               -- Empty field
            bd.treating_doctor_hpcsa_number,           -- Doctor HPCSA
            COALESCE(bd.tooth_numbers, ''),            -- Tooth numbers
            bd.gender,                                  -- M/F
            bd.tariff_code_type,                        -- T
            COALESCE(bd.cpt_cdt_code, ''),             -- CPT/CDT code
            COALESCE(bd.free_text, ''),                -- Free text
            COALESCE(bd.place_of_service, ''),         -- Place of service
            COALESCE(bd.referring_doctor_2, ''),       -- Referring doctor 2
            COALESCE(bd.tracking_number, ''),          -- Tracking number
            COALESCE(bd.reading_additions, ''),        -- Reading additions
            COALESCE(bd.lens_prescription, ''),        -- Lens prescription
            COALESCE(bd.density_of_tint, ''),          -- Density of tint
            bd.patient_id_number,                       -- ID number
            COALESCE(bd.service_time, ''),             -- Service time
            COALESCE(bd.employer_name, ''),            -- Employer
            COALESCE(bd.employee_number, ''),          -- Employee number
            COALESCE(bd.date_of_injury, ''),           -- Date of injury
            COALESCE(bd.iod_reference_number, '')      -- IOD reference
        ), 
        E'\n' 
        ORDER BY bd.transaction_number_in_batch::INTEGER
    )
    INTO v_detail_lines
    FROM batch_details bd
    WHERE bd.batch_header_id = p_batch_id;
    
    -- Build trailer line (Z record)
    v_trailer_line := CONCAT_WS(',',
        'Z',                                                    -- Record type
        v_batch_trailer.total_detail_transactions,              -- Total transactions
        v_batch_trailer.total_detail_transactions,              -- Repeat count
        REPLACE(v_batch_trailer.total_amount_detail_transactions::TEXT, '.', ''), -- Total amount (no decimal)
        '',                                                     -- Empty fields
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    );
    
    -- Combine all parts
    RETURN QUERY
    SELECT 
        v_header_line || E'\n' || v_detail_lines || E'\n' || v_trailer_line as file_content,
        
        COALESCE(v_batch_header.submission_email, 'claims@medicalaid.com') as recipient_email,
        
        CONCAT(
            'BATCH_',
            TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'),
            '_',
            v_batch_header.medical_aid_reference
        ) as file_name;
        
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO service_role;

-- Add comment
COMMENT ON FUNCTION prepare_batch_for_sending(UUID) IS 
'Generates .dat file content for medical claims batch submission. CORRECTED to use medical_aid_reference column.';