-- Fix for prepare_batch_for_sending function
-- This addresses the SQL error: "column 'bd.transaction_number_in_batch' must appear in the GROUP BY clause"
-- The fix moves ORDER BY inside the STRING_AGG function

CREATE OR REPLACE FUNCTION prepare_batch_for_sending(p_batch_id UUID)
RETURNS TABLE (
    file_content TEXT,
    recipient_email TEXT,
    file_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        STRING_AGG(
            CONCAT_WS('|',
                bd.transaction_number_in_batch,
                bd.provider_code,
                bd.patient_id_number,
                bd.member_number,
                bd.dependent_code,
                bd.service_code,
                bd.service_date,
                bd.amount,
                bd.diagnosis_code,
                bd.tooth_number
            ), 
            E'\n' 
            ORDER BY bd.transaction_number_in_batch  -- ORDER BY moved inside STRING_AGG
        ) as file_content,
        
        map.submission_email as recipient_email,
        
        CONCAT(
            'BATCH_',
            TO_CHAR(b.created_at, 'YYYYMMDD'),
            '_',
            map.provider_code
        ) as file_name
        
    FROM batch_details bd
    JOIN batches b ON b.id = bd.batch_id
    JOIN medical_aid_providers map ON map.provider_code = bd.provider_code
    WHERE bd.batch_id = p_batch_id
    GROUP BY 
        map.submission_email,
        map.provider_code,
        b.created_at;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_batch_for_sending(UUID) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION prepare_batch_for_sending(UUID) IS 
'Prepares batch data for email transmission. Fixed ORDER BY clause positioning to resolve GROUP BY error.';