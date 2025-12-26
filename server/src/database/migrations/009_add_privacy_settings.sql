-- Add privacy settings column
ALTER TABLE users
ADD COLUMN hide_read_status BOOLEAN DEFAULT FALSE;

-- Add partial index for privacy queries (only index TRUE values for performance)
CREATE INDEX idx_users_privacy_read_status
ON users(id)
WHERE hide_read_status = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN users.hide_read_status IS
'When TRUE, user does not send read receipts to message senders. Privacy opt-in feature.';
