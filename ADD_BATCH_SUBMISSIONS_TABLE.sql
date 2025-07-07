-- Create batch_submissions table for tracking sent batches and audit trail
-- This provides a complete history of all batch submissions and their delivery status

CREATE TABLE IF NOT EXISTS batch_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_header_id UUID NOT NULL REFERENCES batch_headers(id) ON DELETE CASCADE,
    
    -- File details
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_content_compressed BYTEA, -- Compressed .dat file content for storage efficiency
    file_format TEXT DEFAULT 'EDI' NOT NULL,
    
    -- Email details
    recipient_email TEXT NOT NULL,
    sender_email TEXT,
    email_service TEXT DEFAULT 'resend',
    email_id TEXT, -- External email service ID for tracking
    email_subject TEXT,
    
    -- Submission status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'bounced')),
    submission_attempt INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    
    -- Response tracking
    delivery_confirmation JSONB,
    error_details JSONB,
    provider_response JSONB,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    submitted_by UUID REFERENCES auth.users(id),
    practice_id UUID,
    medical_aid_reference TEXT,
    total_claims INTEGER,
    total_amount DECIMAL(10,2),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_submissions_batch_header_id ON batch_submissions(batch_header_id);
CREATE INDEX IF NOT EXISTS idx_batch_submissions_status ON batch_submissions(status);
CREATE INDEX IF NOT EXISTS idx_batch_submissions_submitted_at ON batch_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_submissions_practice_id ON batch_submissions(practice_id);
CREATE INDEX IF NOT EXISTS idx_batch_submissions_medical_aid ON batch_submissions(medical_aid_reference);
CREATE INDEX IF NOT EXISTS idx_batch_submissions_recipient ON batch_submissions(recipient_email);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_batch_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_batch_submissions_updated_at
    BEFORE UPDATE ON batch_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_batch_submissions_updated_at();

-- RLS policies
ALTER TABLE batch_submissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their practice submissions
CREATE POLICY "Users can view their practice batch submissions" ON batch_submissions
    FOR SELECT USING (
        practice_id IN (
            SELECT practice_id FROM user_practices 
            WHERE user_id = auth.uid()
        )
    );

-- Allow authenticated users to insert batch submissions for their practice
CREATE POLICY "Users can create batch submissions for their practice" ON batch_submissions
    FOR INSERT WITH CHECK (
        practice_id IN (
            SELECT practice_id FROM user_practices 
            WHERE user_id = auth.uid()
        )
    );

-- Allow service role full access for edge functions
CREATE POLICY "Service role full access" ON batch_submissions
    FOR ALL USING (auth.role() = 'service_role');

-- Create view for easy batch submission tracking
CREATE OR REPLACE VIEW batch_submission_summary AS
SELECT 
    bs.id,
    bs.batch_header_id,
    bh.medical_aid_reference,
    bh.batch_number,
    bh.batch_date,
    bs.file_name,
    bs.recipient_email,
    bs.status,
    bs.total_claims,
    bs.total_amount,
    bs.submitted_at,
    bs.sent_at,
    bs.delivered_at,
    bs.submission_attempt,
    bs.email_service,
    bs.practice_id,
    p.name as practice_name
FROM batch_submissions bs
JOIN batch_headers bh ON bs.batch_header_id = bh.id
LEFT JOIN practices p ON bs.practice_id = p.id
ORDER BY bs.submitted_at DESC;

-- Grant permissions
GRANT SELECT ON batch_submission_summary TO authenticated;
GRANT ALL ON batch_submissions TO service_role;

-- Add helpful comments
COMMENT ON TABLE batch_submissions IS 'Tracks all batch email submissions with delivery status and audit trail';
COMMENT ON COLUMN batch_submissions.file_content_compressed IS 'Compressed .dat file content for audit and resubmission purposes';
COMMENT ON COLUMN batch_submissions.email_id IS 'External email service tracking ID (e.g., Resend email ID)';
COMMENT ON COLUMN batch_submissions.delivery_confirmation IS 'JSON response from email service about delivery status';
COMMENT ON VIEW batch_submission_summary IS 'Easy-to-query view of batch submissions with practice and batch header details';

-- Insert function to create batch submission records
CREATE OR REPLACE FUNCTION create_batch_submission(
    p_batch_header_id UUID,
    p_file_name TEXT,
    p_file_content TEXT,
    p_recipient_email TEXT,
    p_sender_email TEXT DEFAULT NULL,
    p_practice_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission_id UUID;
    v_batch_header RECORD;
    v_compressed_content BYTEA;
BEGIN
    -- Get batch header info
    SELECT bh.*, bh.total_invoices, bh.total_amount, bh.practice_id
    INTO v_batch_header
    FROM batch_headers bh
    WHERE bh.id = p_batch_header_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch header not found: %', p_batch_header_id;
    END IF;
    
    -- Compress file content for storage efficiency
    -- Note: This is a placeholder - actual compression would use pg compression
    v_compressed_content := convert_to(p_file_content, 'UTF8');
    
    -- Insert submission record
    INSERT INTO batch_submissions (
        batch_header_id,
        file_name,
        file_size,
        file_content_compressed,
        recipient_email,
        sender_email,
        practice_id,
        medical_aid_reference,
        total_claims,
        total_amount,
        submitted_by
    ) VALUES (
        p_batch_header_id,
        p_file_name,
        length(p_file_content),
        v_compressed_content,
        p_recipient_email,
        COALESCE(p_sender_email, 'onboarding@resend.dev'),
        COALESCE(p_practice_id, v_batch_header.practice_id),
        v_batch_header.medical_aid_reference,
        v_batch_header.total_invoices,
        v_batch_header.total_amount,
        auth.uid()
    ) RETURNING id INTO v_submission_id;
    
    RETURN v_submission_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_batch_submission(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_batch_submission(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;