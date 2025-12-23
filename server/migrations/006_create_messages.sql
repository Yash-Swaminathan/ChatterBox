BEGIN;

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Future: Reply threading (Week 9+)
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT messages_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT messages_content_max_length CHECK (LENGTH(content) <= 10000)
);


-- Primary query: Get messages for a conversation, ordered by time (most common)
-- Used for: Loading message history, infinite scroll pagination
CREATE INDEX idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);

-- Query: Get messages by sender (for analytics, moderation, user profile)
CREATE INDEX idx_messages_sender
    ON messages(sender_id);

-- Query: Find non-deleted messages in conversation (partial index)
-- Optimizes the common case of fetching only active messages
CREATE INDEX idx_messages_conversation_active
    ON messages(conversation_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Query: Reply thread lookups (future feature - Week 9+)
-- Partial index only for messages that have replies
CREATE INDEX idx_messages_reply_to
    ON messages(reply_to_id)
    WHERE reply_to_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

COMMENT ON TABLE messages IS 'Chat messages between users in conversations';
COMMENT ON COLUMN messages.id IS 'Unique message identifier (UUID)';
COMMENT ON COLUMN messages.conversation_id IS 'Reference to the conversation this message belongs to';
COMMENT ON COLUMN messages.sender_id IS 'Reference to the user who sent this message';
COMMENT ON COLUMN messages.content IS 'Message text content, 1-10000 characters, cannot be empty or whitespace-only';
COMMENT ON COLUMN messages.created_at IS 'Timestamp when message was created';
COMMENT ON COLUMN messages.updated_at IS 'Timestamp when message was last updated (auto-updated via trigger)';
COMMENT ON COLUMN messages.deleted_at IS 'Soft delete timestamp, NULL if message is not deleted';
COMMENT ON COLUMN messages.reply_to_id IS 'Parent message ID for reply threads (future feature - Week 9+)';

COMMIT;
