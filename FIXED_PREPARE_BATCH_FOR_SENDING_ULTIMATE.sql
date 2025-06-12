-- Fixed prepare_batch_for_sending function - ULTIMATE VERSION
-- This addresses the "invalid input syntax for type integer" error
-- Properly handles NULL and empty string values in ORDER BY clause

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
        COALESCE(v_batch_header.practice_number, ''),         -- Practice number
        COALESCE(v_batch_header.system_identification, '1'),   -- System ID
        COALESCE(v_batch_header.transaction_type, 'D'),        -- Transaction type
        COALESCE(v_batch_header.batch_number::TEXT, '1'),           -- Batch number
        TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'), -- Batch date
        'ONEHEALTH',                           -- Source software name
        COALESCE(v_batch_header.source_software_version, '1.0'), -- Software version
        '1.6'                                  -- File format version
    );
    
    -- Build detail lines (D records) - all fields in proper EDI order with NULL handling
    SELECT STRING_AGG(
        CONCAT_WS(',',
            COALESCE(bd.transaction_id, 'D'),                          -- D
            COALESCE(bd.transaction_number_in_batch::TEXT, '1'),       -- Transaction number
            COALESCE(bd.system_transaction_number::TEXT, '1'),         -- System transaction number
            COALESCE(LPAD(bd.system_patient_reference_number::TEXT, 7, '0'), '0000001'), -- Patient reference (7 digits)
            COALESCE(bd.type_of_service, 'T'),                         -- T
            COALESCE(bd.medical_aid_reference, ''),                    -- NMC1, etc.
            COALESCE(bd.not_used_1, ''),                               -- Empty field
            COALESCE(bd.medical_aid_membership_number, ''),            -- Member number
            COALESCE(bd.member_surname, ''),                           -- Surname
            COALESCE(bd.member_initials, ''),                          -- Initials  
            COALESCE(bd.patient_name, ''),                             -- Patient name
            COALESCE(bd.patient_date_of_birth, ''),                    -- DOB (YYYYMMDD)
            COALESCE(bd.bhf_tariff_code, ''),                          -- Tariff code
            COALESCE(REPLACE(bd.service_amount::TEXT, '.', ''), '0'),  -- Amount (no decimal)
            COALESCE(bd.diagnosis, ''),                                -- Diagnosis description
            COALESCE(REPLACE(bd.discount_amount::TEXT, '.', ''), '0'), -- Discount (no decimal)
            COALESCE(TO_CHAR(bd.service_date::DATE, 'YYYYMMDD'), ''),  -- Service date
            COALESCE(REPLACE(bd.number_of_services::TEXT, '.', ''), '1'), -- Number of services
            COALESCE(bd.service_fee, ''),                              -- Service fee code
            COALESCE(bd.modifier_1, ''),                               -- Modifier 1
            COALESCE(bd.modifier_2, ''),                               -- Modifier 2
            COALESCE(bd.modifier_3, ''),                               -- Modifier 3
            COALESCE(bd.modifier_4, ''),                               -- Modifier 4
            COALESCE(bd.invoice_number, ''),                           -- Invoice number
            COALESCE(bd.referring_doctor, ''),                         -- Referring doctor
            COALESCE(bd.nappi_code, ''),                               -- NAPPI code
            COALESCE(bd.referred_to_practice_number, ''),              -- Referred to practice
            COALESCE(bd.not_used_2, ''),                               -- Empty field
            COALESCE(bd.practice_number, ''),                          -- Practice number
            COALESCE(bd.hospital_indicator, ''),                       -- Hospital indicator
            COALESCE(bd.authorisation_number, ''),                     -- Auth number
            COALESCE(bd.resubmission_flag, ''),                        -- Resubmission flag
            COALESCE(bd.diagnostic_code, ''),                          -- Diagnostic code
            COALESCE(bd.diagnostic_code_type, ''),                     -- Diagnostic code type
            COALESCE(bd.dosage_description, ''),                       -- Dosage
            COALESCE(bd.not_used_3, ''),                               -- Empty field
            COALESCE(bd.treating_doctor_hpcsa_number, ''),             -- Doctor HPCSA
            COALESCE(bd.tooth_numbers, ''),                            -- Tooth numbers
            COALESCE(bd.gender, ''),                                   -- M/F
            COALESCE(bd.tariff_code_type, 'T'),                        -- T
            COALESCE(bd.cpt_cdt_code, ''),                             -- CPT/CDT code
            COALESCE(bd.free_text, ''),                                -- Free text
            COALESCE(bd.place_of_service, ''),                         -- Place of service
            COALESCE(bd.referring_doctor_2, ''),                       -- Referring doctor 2
            COALESCE(bd.tracking_number, ''),                          -- Tracking number
            COALESCE(bd.reading_additions, ''),                        -- Reading additions
            COALESCE(bd.lens_prescription, ''),                        -- Lens prescription
            COALESCE(bd.density_of_tint, ''),                          -- Density of tint
            COALESCE(bd.patient_id_number, ''),                        -- ID number
            COALESCE(bd.service_time, ''),                             -- Service time (handle empty strings)
            COALESCE(bd.employer_name, ''),                            -- Employer
            COALESCE(bd.employee_number, ''),                          -- Employee number
            CASE 
                WHEN bd.date_of_injury IS NOT NULL THEN TO_CHAR(bd.date_of_injury::DATE, 'YYYYMMDD')
                ELSE ''
            END,                                                       -- Date of injury (handle NULL dates)
            COALESCE(bd.iod_reference_number, '')                      -- IOD reference
        ), 
        E'\n' 
        ORDER BY 
            CASE 
                WHEN bd.transaction_number_in_batch IS NULL OR bd.transaction_number_in_batch = '' THEN 1
                ELSE bd.transaction_number_in_batch::INTEGER
            END
    )
    INTO v_detail_lines
    FROM batch_details bd
    WHERE bd.batch_header_id = p_batch_id;
    
    -- Build trailer line (Z record)
    v_trailer_line := CONCAT_WS(',',
        'Z',                                                    -- Record type
        COALESCE(v_batch_trailer.total_detail_transactions::TEXT, '0'),              -- Total transactions
        COALESCE(v_batch_trailer.total_detail_transactions::TEXT, '0'),              -- Repeat count
        COALESCE(REPLACE(v_batch_trailer.total_amount_detail_transactions::TEXT, '.', ''), '0'), -- Total amount (no decimal)
        '',                                                     -- Empty fields (24 empty fields for trailer)
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
        v_header_line || E'\n' || COALESCE(v_detail_lines, '') || E'\n' || v_trailer_line as file_content,
        
        COALESCE(v_batch_header.submission_email, 'claims@medicalaid.com') as recipient_email,
        
        CONCAT(
            'BATCH_',
            TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'),
            '_',
            COALESCE(v_batch_header.medical_aid_reference, 'UNKNOWN')
        ) as file_name;
        
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO service_role;

-- Add comment
COMMENT ON FUNCTION prepare_batch_for_sending(UUID) IS 
'Generates .dat file content for medical claims batch submission. ULTIMATE VERSION with proper NULL/empty string/integer handling.';