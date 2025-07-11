-- Gmail OAuth Storage Enhancement

-- 1. Add Gmail OAuth settings to practices table
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS gmail_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_email TEXT,
ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gmail_scopes TEXT[];

-- 2. Create secure storage for OAuth tokens
CREATE TABLE IF NOT EXISTS practice_oauth_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'microsoft', etc.
    email TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(practice_id, provider, email)
);

-- 3. Edge function to handle OAuth flow
CREATE OR REPLACE FUNCTION handle_gmail_oauth_callback(
    p_practice_id UUID,
    p_code TEXT,
    p_redirect_uri TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- This would be called by an edge function that exchanges the code for tokens
    -- The edge function would:
    -- 1. Exchange authorization code for tokens
    -- 2. Store the refresh token securely
    -- 3. Return success/failure
    
    -- For now, just return the structure
    RETURN jsonb_build_object(
        'success', true,
        'message', 'OAuth tokens would be stored here',
        'next_step', 'Implement edge function for token exchange'
    );
END;
$$;

-- 4. Function to check if practice has valid Gmail connection
CREATE OR REPLACE FUNCTION check_gmail_connection(p_practice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_credentials RECORD;
BEGIN
    SELECT 
        email,
        connected_at,
        last_used_at,
        CASE 
            WHEN refresh_token IS NOT NULL THEN true 
            ELSE false 
        END as is_connected
    INTO v_credentials
    FROM practice_oauth_credentials
    WHERE practice_id = p_practice_id
    AND provider = 'google'
    ORDER BY connected_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'connected', false,
            'email', null,
            'message', 'No Gmail account connected'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'connected', v_credentials.is_connected,
        'email', v_credentials.email,
        'connected_at', v_credentials.connected_at,
        'last_used_at', v_credentials.last_used_at
    );
END;
$$;

-- 5. RLS Policies
ALTER TABLE practice_oauth_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice users can view their OAuth credentials" ON practice_oauth_credentials
    FOR SELECT USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Practice admins can manage OAuth credentials" ON practice_oauth_credentials
    FOR ALL USING (
        practice_id IN (
            SELECT practice_id FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- 6. Indexes
CREATE INDEX idx_practice_oauth_credentials_lookup 
ON practice_oauth_credentials(practice_id, provider);

-- 7. Grant permissions
GRANT SELECT ON practice_oauth_credentials TO authenticated;
GRANT EXECUTE ON FUNCTION check_gmail_connection TO authenticated;
GRANT EXECUTE ON FUNCTION handle_gmail_oauth_callback TO anon, authenticated;