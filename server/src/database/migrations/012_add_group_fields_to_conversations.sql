BEGIN;

-- Add group-specific columns to conversations table
ALTER TABLE conversations
    ADD COLUMN name VARCHAR(100),              -- Group name (optional, auto-generated if null)
    ADD COLUMN avatar_url VARCHAR(500),        -- Group avatar (optional)
    ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;  -- Creator user ID

-- Add index for creator lookups
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);

-- Add check constraint for group name length (if provided)
ALTER TABLE conversations
    ADD CONSTRAINT check_group_name_length CHECK (
        name IS NULL OR (LENGTH(TRIM(name)) >= 1 AND LENGTH(TRIM(name)) <= 100)
    );

-- Documentation comments
COMMENT ON COLUMN conversations.name IS 'Group name (null for direct, optional for group - auto-generated from participants if not provided)';
COMMENT ON COLUMN conversations.avatar_url IS 'Group avatar URL (null for direct, optional for group)';
COMMENT ON COLUMN conversations.created_by IS 'User who created the group (null for direct conversations)';

COMMIT;
