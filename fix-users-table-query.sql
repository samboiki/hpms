-- Fix for Financial Overview Users Table Query Issue
-- The error "column users.first_name does not exist" comes from queries trying to get doctor/practitioner info

-- 1. Create a view that provides backward compatibility for first_name and last_name from full_name
CREATE OR REPLACE VIEW users_with_names AS
SELECT 
    id,
    email,
    full_name,
    -- Split full_name into first_name and last_name for backward compatibility
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN substring(full_name from 1 for position(' ' in full_name) - 1)
        ELSE full_name
    END as first_name,
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN substring(full_name from position(' ' in full_name) + 1)
        ELSE ''
    END as last_name,
    role,
    created_at,
    last_login,
    avatar,
    practice_id,
    is_super_admin,
    can_manage_practices,
    permissions,
    last_active_at,
    hpcsa_number
FROM users;

-- 2. Grant appropriate permissions on the view
GRANT SELECT ON users_with_names TO authenticated;
GRANT SELECT ON users_with_names TO anon;

-- 3. Create a function to get practice batches with proper doctor info
CREATE OR REPLACE FUNCTION get_practice_batches_with_doctors(p_practice_id UUID)
RETURNS TABLE (
    batch_id UUID,
    practice_number VARCHAR(15),
    batch_number INTEGER,
    batch_date DATE,
    medical_aid_reference VARCHAR(10),
    status TEXT,
    total_invoices INTEGER,
    total_amount NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    medical_aid_name TEXT,
    medical_aid_short_name TEXT,
    medical_aid_email TEXT,
    medical_aid_logo_url TEXT,
    medical_aid_theme_color TEXT,
    practice_name TEXT,
    practice_email TEXT,
    detail_transactions INTEGER,
    total_detail_transactions INTEGER,
    total_amount_detail_transactions NUMERIC(10,2),
    dat_filename TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    practice_num VARCHAR(15);
BEGIN
    -- Get the practice number for this practice ID
    SELECT p.practice_number INTO practice_num
    FROM practices p
    WHERE p.id = p_practice_id;
    
    -- If no practice number found, try to create one
    IF practice_num IS NULL THEN
        UPDATE practices 
        SET practice_number = '54000113324' || EXTRACT(EPOCH FROM NOW())::INTEGER::TEXT
        WHERE id = p_practice_id;
        
        SELECT p.practice_number INTO practice_num
        FROM practices p
        WHERE p.id = p_practice_id;
    END IF;
    
    -- Return empty if still no practice number
    IF practice_num IS NULL THEN
        RETURN;
    END IF;
    
    -- Return batches for this practice number with proper joins
    RETURN QUERY
    SELECT 
        bh.id as batch_id,
        bh.practice_number,
        bh.batch_number,
        bh.batch_date,
        bh.medical_aid_reference,
        bh.status,
        bh.total_invoices,
        bh.total_amount,
        bh.created_at,
        bh.sent_at,
        bh.confirmed_at,
        COALESCE(map.name, 'Unknown Medical Aid') as medical_aid_name,
        COALESCE(map.short_name, 'UNK') as medical_aid_short_name,
        COALESCE(map.email, 'unknown@example.com') as medical_aid_email,
        map.logo_url as medical_aid_logo_url,
        map.theme_color as medical_aid_theme_color,
        COALESCE(p.name, 'Unknown Practice') as practice_name,
        COALESCE(p.contact_email, 'unknown@example.com') as practice_email,
        COALESCE((
            SELECT COUNT(*)::INTEGER 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
        ), 0) as detail_transactions,
        COALESCE((
            SELECT COUNT(*)::INTEGER 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
        ), 0) as total_detail_transactions,
        COALESCE((
            SELECT SUM(bd.service_amount)::NUMERIC(10,2) 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
        ), 0.00) as total_amount_detail_transactions,
        (bh.practice_number || '_' || bh.batch_number || '_' || bh.medical_aid_reference) as dat_filename
    FROM batch_headers bh
    LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
    LEFT JOIN practices p ON p.id = bh.practice_id
    WHERE bh.practice_number = practice_num
    ORDER BY bh.created_at DESC;
END;
$$;

-- 4. Ensure practices have practice_numbers
-- Add practice_number column if it doesn't exist
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_number VARCHAR(15);

-- Update existing practices without practice numbers
UPDATE practices 
SET practice_number = '54000113324' || ROW_NUMBER() OVER (ORDER BY created_at)
WHERE practice_number IS NULL;

-- 5. Create a simpler function that just gets all batches for a practice
CREATE OR REPLACE FUNCTION get_practice_batches_simple(p_practice_id UUID)
RETURNS TABLE (
    batch_id UUID,
    practice_number VARCHAR(15),
    batch_number INTEGER,
    batch_date DATE,
    medical_aid_reference VARCHAR(10),
    status TEXT,
    total_invoices INTEGER,
    total_amount NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    medical_aid_name TEXT,
    medical_aid_short_name TEXT,
    medical_aid_email TEXT,
    medical_aid_logo_url TEXT,
    medical_aid_theme_color TEXT,
    practice_name TEXT,
    practice_email TEXT,
    detail_transactions INTEGER,
    total_detail_transactions INTEGER,
    total_amount_detail_transactions NUMERIC(10,2),
    dat_filename TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Direct query by practice_id
    RETURN QUERY
    SELECT 
        bh.id as batch_id,
        bh.practice_number,
        bh.batch_number,
        bh.batch_date,
        bh.medical_aid_reference,
        bh.status,
        bh.total_invoices,
        bh.total_amount,
        bh.created_at,
        bh.sent_at,
        bh.confirmed_at,
        COALESCE(map.name, 'Unknown Medical Aid') as medical_aid_name,
        COALESCE(map.short_name, 'UNK') as medical_aid_short_name,
        COALESCE(map.email, 'unknown@example.com') as medical_aid_email,
        map.logo_url as medical_aid_logo_url,
        map.theme_color as medical_aid_theme_color,
        COALESCE(p.name, 'Unknown Practice') as practice_name,
        COALESCE(p.contact_email, 'unknown@example.com') as practice_email,
        0 as detail_transactions,
        0 as total_detail_transactions,
        0.00 as total_amount_detail_transactions,
        COALESCE(bh.practice_number || '_' || bh.batch_number || '_' || bh.medical_aid_reference, 'UNKNOWN') as dat_filename
    FROM batch_headers bh
    LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
    LEFT JOIN practices p ON p.id = bh.practice_id
    WHERE bh.practice_id = p_practice_id
    ORDER BY bh.created_at DESC;
END;
$$;

-- Grant permissions on the functions
GRANT EXECUTE ON FUNCTION get_practice_batches_with_doctors(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_practice_batches_simple(UUID) TO authenticated;

-- 6. Show current state for verification
SELECT 
    'Users with full_name' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as with_full_name
FROM users

UNION ALL

SELECT 
    'Practices with practice_number' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN practice_number IS NOT NULL THEN 1 END) as with_practice_number
FROM practices

UNION ALL

SELECT 
    'Batch headers total' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_batches
FROM batch_headers;