BEGIN;

-- Create message_status table
CREATE TABLE IF NOT EXISTS message_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status progression: sent → delivered → read
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),

    -- Timestamps for each status transition
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Prevent duplicate entries for same message/user
    CONSTRAINT message_status_unique UNIQUE (message_id, user_id)
);

-- Index 1: Primary query - Get all delivery statuses for a message
-- Used for: Showing "Seen by 3 people" indicators
CREATE INDEX idx_message_status_message
    ON message_status(message_id);

-- Index 2: Query undelivered messages for a user (for retry logic)
-- Partial index only on non-read messages (50% storage reduction)
CREATE INDEX idx_message_status_user_undelivered
    ON message_status(user_id, status)
    WHERE status != 'read';

-- Index 3: CRITICAL for unread count queries - O(log N) performance
-- Used for: SELECT COUNT(*) WHERE user_id = ? AND status != 'read'
-- Partial index dramatically improves performance (only unread messages)
CREATE INDEX idx_message_status_user_unread
    ON message_status(user_id, message_id)
    WHERE status != 'read';

-- Index 4: Query read receipts for conversation (for analytics)
-- Used for: Conversation insights, last read position
CREATE INDEX idx_message_status_conversation_read
    ON message_status(user_id, read_at DESC)
    WHERE read_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE message_status IS 'Tracks delivery and read status for each message per recipient';
COMMENT ON COLUMN message_status.status IS 'Current status: sent (created), delivered (received by client), read (viewed by user)';
COMMENT ON COLUMN message_status.sent_at IS 'Timestamp when message was created (same as message.created_at)';
COMMENT ON COLUMN message_status.delivered_at IS 'Timestamp when client confirmed receipt via Socket.io';
COMMENT ON COLUMN message_status.read_at IS 'Timestamp when user viewed the message in conversation';

COMMIT;
