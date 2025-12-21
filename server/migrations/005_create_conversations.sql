-- Migration: Create conversations tables
-- Week 4 Day 1-2: Conversation Setup
-- Purpose: Create database structure for 1-on-1 and group conversations

-- INSTRUCTIONS:
-- 1. Wrap everything in a transaction (BEGIN/COMMIT) for atomicity
-- 2. Create the 'conversations' table first (parent table)
-- 3. Create the 'conversation_participants' table second (child table with foreign keys)
-- 4. Add indexes for performance
-- 5. Add comments to document the schema
-- 6. Test by running: psql -U postgres -d chatterbox < server/migrations/005_create_conversations.sql

-- TODO: Start transaction
BEGIN;


-- TODO: Create 'conversations' table
-- Columns needed:
--   - id: UUID primary key (use gen_random_uuid() as default)
--   - type: VARCHAR(20) NOT NULL DEFAULT 'direct'
--   - created_at: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
--   - updated_at: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
--
-- Constraints:
--   - CHECK constraint: type must be either 'direct' or 'group'
--
-- Hint: CREATE TABLE IF NOT EXISTS conversations (...);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL DEFAULT 'direct',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (type IN ('direct', 'group'))
);

-- TODO: Add index on conversations.updated_at for sorting by recent activity
-- This is critical for "GET /api/conversations" query performance
-- Hint: CREATE INDEX idx_conversations_updated_at ON ...
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- TODO: Add table and column comments for documentation
-- COMMENT ON TABLE conversations IS '...';
-- COMMENT ON COLUMN conversations.type IS '...';
-- COMMENT ON COLUMN conversations.updated_at IS '...';
COMMENT ON TABLE conversations IS 'Table to store conversations between users or groups';
COMMENT ON COLUMN conversations.type IS 'Type of conversation: direct or group';
COMMENT ON COLUMN conversations.updated_at IS 'Timestamp of last update';


-- TODO: Create 'conversation_participants' table (many-to-many join table)
-- Columns needed:
--   - conversation_id: UUID NOT NULL
--   - user_id: UUID NOT NULL
--   - joined_at: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
--   - is_admin: BOOLEAN DEFAULT FALSE (for group admins in Week 9)
--   - last_read_at: TIMESTAMP WITH TIME ZONE (for read receipts in Week 5)
--
-- Constraints:
--   - PRIMARY KEY (conversation_id, user_id) - composite key prevents duplicates
--   - FOREIGN KEY conversation_id REFERENCES conversations(id) ON DELETE CASCADE
--   - FOREIGN KEY user_id REFERENCES users(id) ON DELETE CASCADE
--
-- Hint: CREATE TABLE IF NOT EXISTS conversation_participants (...);
CREATE TABLE IF NOT EXISTS conversation_participants (
    conservation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (conversation_id, user_id)
);


-- TODO: Add index on user_id for "find all conversations for user" queries
-- This is the most common query pattern
-- Hint: CREATE INDEX idx_conversation_participants_user_id ON ...
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);


-- TODO: Add index on conversation_id for "find all participants in conversation" queries
-- Hint: CREATE INDEX idx_conversation_participants_conversation_id ON ...
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);


-- TODO: Add table and column comments
-- COMMENT ON TABLE conversation_participants IS '...';
-- COMMENT ON COLUMN conversation_participants.is_admin IS '...';
-- COMMENT ON COLUMN conversation_participants.last_read_at IS '...';
COMMENT ON TABLE conversation_participants IS 'Table to store participants in conversations';
COMMENT ON COLUMN conversation_participants.is_admin IS 'Whether the user is an admin of the conversation';
COMMENT ON COLUMN conversation_participants.last_read_at IS 'Timestamp of last read message';


-- TODO: Commit transaction
COMMIT;

-- VERIFICATION COMMANDS (run in psql after migration):
-- \dt conversations
-- \dt conversation_participants
-- \d conversations
-- \d conversation_participants
-- \di  (list indexes)
