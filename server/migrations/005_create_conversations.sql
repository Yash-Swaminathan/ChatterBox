-- Migration: Create conversations tables
-- Week 4 Day 1-2: Conversation Setup

BEGIN;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL DEFAULT 'direct',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (type IN ('direct', 'group'))
);

-- Index for sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Documentation comments
COMMENT ON TABLE conversations IS 'Stores conversations between users (direct) or groups';
COMMENT ON COLUMN conversations.type IS 'Type: direct (1-on-1) or group (3+ users)';
COMMENT ON COLUMN conversations.updated_at IS 'Last activity timestamp, updated when messages sent';

-- Create conversation participants table (many-to-many join)
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (conversation_id, user_id)
);

-- Index for finding user's conversations (most common query)
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id
    ON conversation_participants(user_id);

-- Index for finding conversation participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id
    ON conversation_participants(conversation_id);

-- Composite index for optimized conversation retrieval by user with sorting
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_joined
    ON conversation_participants(user_id, joined_at DESC);

-- Documentation comments
COMMENT ON TABLE conversation_participants IS 'Tracks which users are in which conversations';
COMMENT ON COLUMN conversation_participants.is_admin IS 'Group admin flag (Week 9), always FALSE for direct';
COMMENT ON COLUMN conversation_participants.last_read_at IS 'Last message read timestamp (Week 5)';

COMMIT;
