-- Create table for temporary OAuth callback tokens
CREATE TABLE IF NOT EXISTS oauth_callback_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    email TEXT NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

-- Create index for token lookup
CREATE INDEX idx_oauth_callback_tokens_token ON oauth_callback_tokens(token) WHERE NOT used;

-- Create index for cleanup
CREATE INDEX idx_oauth_callback_tokens_expires ON oauth_callback_tokens(expires_at) WHERE NOT used;

-- RLS policies
ALTER TABLE oauth_callback_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON oauth_callback_tokens
    FOR ALL TO service_role
    USING (true);

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_callback_tokens
    WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_tokens() TO service_role;