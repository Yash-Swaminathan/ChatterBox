BEGIN;

-- Add composite index for efficient unread count queries
-- This index covers both user_id and status in the WHERE clause
-- Significantly improves: SELECT COUNT(*) FROM message_status WHERE user_id = ? AND status != 'read'
CREATE INDEX IF NOT EXISTS idx_message_status_user_status
    ON message_status(user_id, status)
    WHERE status != 'read';

-- Add comment for documentation
COMMENT ON INDEX idx_message_status_user_status IS
    'Composite index for unread message counts - covers user_id + status for WHERE user_id = ? AND status != ''read''';

COMMIT;
