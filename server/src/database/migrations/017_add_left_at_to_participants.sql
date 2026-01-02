BEGIN;

-- Add left_at column for soft delete tracking
ALTER TABLE conversation_participants
ADD COLUMN left_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient "active participants only" queries
CREATE INDEX idx_participants_active
ON conversation_participants(conversation_id, user_id)
WHERE left_at IS NULL;

-- Add index for finding oldest member (for auto-promotion)
CREATE INDEX idx_participants_oldest
ON conversation_participants(conversation_id, joined_at ASC)
WHERE left_at IS NULL AND is_admin = false;

-- Add documentation
COMMENT ON COLUMN conversation_participants.left_at IS
'Timestamp when user left the conversation (soft delete). NULL means user is active participant.';

COMMIT;
