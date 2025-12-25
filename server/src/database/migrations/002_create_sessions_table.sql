-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    device_info JSONB, -- Store user agent, IP address, device type, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    -- Constraints
    CONSTRAINT expires_after_created CHECK (expires_at > created_at)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(user_id, is_active) WHERE is_active = TRUE;

-- Create index for cleanup queries (finding expired sessions)
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expires_at)
    WHERE is_active = FALSE;

-- Create function to automatically update last_used_at
CREATE OR REPLACE FUNCTION update_session_last_used()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_used_at on any update
CREATE TRIGGER update_sessions_last_used
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_used();

-- Create function to cleanup expired sessions (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (is_active = FALSE AND last_used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE sessions IS 'Stores user session information for JWT refresh tokens';
COMMENT ON COLUMN sessions.id IS 'Unique session identifier (UUID)';
COMMENT ON COLUMN sessions.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN sessions.refresh_token IS 'JWT refresh token (unique)';
COMMENT ON COLUMN sessions.device_info IS 'JSON object with device details (user agent, IP, etc.)';
COMMENT ON COLUMN sessions.created_at IS 'When the session was created';
COMMENT ON COLUMN sessions.expires_at IS 'When the refresh token expires (typically 7 days)';
COMMENT ON COLUMN sessions.last_used_at IS 'Last time this session was used to refresh access token';
COMMENT ON COLUMN sessions.is_active IS 'Whether session is still valid (for logout)';

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired and old inactive sessions';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 002: sessions table created successfully';
    RAISE NOTICE 'ℹ️  Tip: Run SELECT cleanup_expired_sessions(); periodically to remove old sessions';
END $$;
