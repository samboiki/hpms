-- Fixed prepare_batch_for_sending function - PROPERLY RESEARCHED VERSION
-- Based on actual batch_details schema analysis
-- Handles all data types correctly: INTEGER, NUMERIC, TEXT, DATE, TIME

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
    
    -- Build header line (H record) - using actual batch_headers schema
    v_header_line := CONCAT_WS(',',
        '1',                                                    -- Record type
        COALESCE(v_batch_header.practice_number, ''),          -- Practice number (varchar)
        COALESCE(v_batch_header.system_identification, '1'),   -- System ID (varchar)
        COALESCE(v_batch_header.transaction_type, 'D'),        -- Transaction type (varchar)
        COALESCE(v_batch_header.batch_number::TEXT, '1'),      -- Batch number (integer to text)
        TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'),        -- Batch date (date to YYYYMMDD)
        'ONEHEALTH',                                           -- Source software name
        COALESCE(v_batch_header.source_software_version, '1.0'), -- Software version (varchar)
        '1.6'                                                  -- File format version
    );
    
    -- Build detail lines (D records) - properly typed based on schema
    SELECT STRING_AGG(
        CONCAT_WS(',',
            -- Schema: transaction_id character(1) null default 'D'::bpchar
            COALESCE(bd.transaction_id, 'D'),
            
            -- Schema: transaction_number_in_batch integer not null
            bd.transaction_number_in_batch::TEXT,
            
            -- Schema: system_transaction_number integer null
            COALESCE(bd.system_transaction_number::TEXT, '0'),
            
            -- Schema: system_patient_reference_number text null
            COALESCE(LPAD(bd.system_patient_reference_number, 7, '0'), '0000001'),
            
            -- Schema: type_of_service character(1) null default 'T'::bpchar
            COALESCE(bd.type_of_service, 'T'),
            
            -- Schema: medical_aid_reference character varying(10) not null
            bd.medical_aid_reference,
            
            -- Schema: not_used_1 character varying(10) null default ''::character varying
            COALESCE(bd.not_used_1, ''),
            
            -- Schema: medical_aid_membership_number character varying(20) null
            COALESCE(bd.medical_aid_membership_number, ''),
            
            -- Schema: member_surname character varying(50) null
            COALESCE(bd.member_surname, ''),
            
            -- Schema: member_initials character varying(10) null
            COALESCE(bd.member_initials, ''),
            
            -- Schema: patient_name character varying(100) null
            COALESCE(bd.patient_name, ''),
            
            -- Schema: patient_date_of_birth text null
            COALESCE(bd.patient_date_of_birth, ''),
            
            -- Schema: bhf_tariff_code character varying(10) not null
            bd.bhf_tariff_code,
            
            -- Schema: service_amount numeric(10, 2) not null
            REPLACE(bd.service_amount::TEXT, '.', ''),
            
            -- Schema: diagnosis text null
            COALESCE(bd.diagnosis, ''),
            
            -- Schema: discount_amount numeric(10, 2) null default 0.00
            REPLACE(COALESCE(bd.discount_amount, 0.00)::TEXT, '.', ''),
            
            -- Schema: service_date text not null
            bd.service_date,
            
            -- Schema: number_of_services numeric(5, 2) null default 1.00
            REPLACE(COALESCE(bd.number_of_services, 1.00)::TEXT, '.', ''),
            
            -- Schema: service_fee integer null default 7
            COALESCE(bd.service_fee::TEXT, '7'),
            
            -- Schema: modifier fields character varying(10) null default ''::character varying
            COALESCE(bd.modifier_1, ''),
            COALESCE(bd.modifier_2, ''),
            COALESCE(bd.modifier_3, ''),
            COALESCE(bd.modifier_4, ''),
            
            -- Schema: invoice_number character varying(20) not null
            bd.invoice_number,
            
            -- Schema: referring_doctor character varying(50) null default ''::character varying
            COALESCE(bd.referring_doctor, ''),
            
            -- Schema: nappi_code character varying(20) null default ''::character varying
            COALESCE(bd.nappi_code, ''),
            
            -- Schema: referred_to_practice_number character varying(15) null default ''::character varying
            COALESCE(bd.referred_to_practice_number, ''),
            
            -- Schema: not_used_2 character varying(10) null default ''::character varying
            COALESCE(bd.not_used_2, ''),
            
            -- Schema: practice_number character varying(15) not null
            bd.practice_number,
            
            -- Schema: hospital_indicator character varying(10) null default ''::character varying
            COALESCE(bd.hospital_indicator, ''),
            
            -- Schema: authorisation_number character varying(20) null default ''::character varying
            COALESCE(bd.authorisation_number, ''),
            
            -- Schema: resubmission_flag character varying(10) null default ''::character varying
            COALESCE(bd.resubmission_flag, ''),
            
            -- Schema: diagnostic_code character varying(20) null default ''::character varying
            COALESCE(bd.diagnostic_code, ''),
            
            -- Schema: diagnostic_code_type character varying(10) null default ''::character varying
            COALESCE(bd.diagnostic_code_type, ''),
            
            -- Schema: dosage_description text null default ''::text
            COALESCE(bd.dosage_description, ''),
            
            -- Schema: not_used_3 character varying(10) null default ''::character varying
            COALESCE(bd.not_used_3, ''),
            
            -- Schema: treating_doctor_hpcsa_number character varying(20) null
            COALESCE(bd.treating_doctor_hpcsa_number, ''),
            
            -- Schema: tooth_numbers character varying(50) null default ''::character varying
            COALESCE(bd.tooth_numbers, ''),
            
            -- Schema: gender character(1) not null
            bd.gender,
            
            -- Schema: tariff_code_type character(1) null default 'T'::bpchar
            COALESCE(bd.tariff_code_type, 'T'),
            
            -- Schema: cpt_cdt_code character varying(20) null default ''::character varying
            COALESCE(bd.cpt_cdt_code, ''),
            
            -- Schema: free_text text null default ''::text
            COALESCE(bd.free_text, ''),
            
            -- Schema: place_of_service character varying(20) null default ''::character varying
            COALESCE(bd.place_of_service, ''),
            
            -- Schema: referring_doctor_2 character varying(50) null default ''::character varying
            COALESCE(bd.referring_doctor_2, ''),
            
            -- Schema: tracking_number character varying(30) null default ''::character varying
            COALESCE(bd.tracking_number, ''),
            
            -- Schema: reading_additions character varying(100) null default ''::character varying
            COALESCE(bd.reading_additions, ''),
            
            -- Schema: lens_prescription character varying(100) null default ''::character varying
            COALESCE(bd.lens_prescription, ''),
            
            -- Schema: density_of_tint character varying(50) null default ''::character varying
            COALESCE(bd.density_of_tint, ''),
            
            -- Schema: patient_id_number character varying(20) not null
            bd.patient_id_number,
            
            -- Schema: service_time time without time zone null
            COALESCE(bd.service_time::TEXT, ''),
            
            -- Schema: employer_name character varying(100) null default ''::character varying
            COALESCE(bd.employer_name, ''),
            
            -- Schema: employee_number character varying(50) null default ''::character varying
            COALESCE(bd.employee_number, ''),
            
            -- Schema: date_of_injury date null
            COALESCE(TO_CHAR(bd.date_of_injury, 'YYYYMMDD'), ''),
            
            -- Schema: iod_reference_number character varying(30) null default ''::character varying
            COALESCE(bd.iod_reference_number, '')
        ), 
        E'\n' 
        ORDER BY bd.transaction_number_in_batch  -- This is INTEGER NOT NULL, so safe to order by
    )
    INTO v_detail_lines
    FROM batch_details bd
    WHERE bd.batch_header_id = p_batch_id;
    
    -- Build trailer line (Z record) - properly handle numeric fields
    v_trailer_line := CONCAT_WS(',',
        'Z',                                                    -- Record type
        COALESCE(v_batch_trailer.total_detail_transactions::TEXT, '0'),              -- Total transactions
        COALESCE(v_batch_trailer.total_detail_transactions::TEXT, '0'),              -- Repeat count
        REPLACE(COALESCE(v_batch_trailer.total_amount_detail_transactions, 0.00)::TEXT, '.', ''), -- Total amount (no decimal)
        '',                                                     -- 21 empty fields for trailer padding
        '', '', '', '', '', '', '', '', '', '', 
        '', '', '', '', '', '', '', '', '', ''
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
'Generates .dat file content for medical claims batch submission. RESEARCHED VERSION based on actual schema analysis.';