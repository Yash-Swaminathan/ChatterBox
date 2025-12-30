BEGIN;

-- Add role column to conversation_participants
-- This column provides more granular role management than the boolean is_admin flag
ALTER TABLE conversation_participants
ADD COLUMN role VARCHAR(20) DEFAULT 'member';

-- Add constraint to validate role values
ALTER TABLE conversation_participants
ADD CONSTRAINT check_role_values
CHECK (role IN ('admin', 'member'));

-- Add index for role-based queries (e.g., finding all admins in a group)
CREATE INDEX IF NOT EXISTS idx_participants_role ON conversation_participants(role);

-- Documentation
COMMENT ON COLUMN conversation_participants.role IS 'User role in conversation: admin or member (Week 7)';

-- Migrate existing data: if is_admin = TRUE, set role = 'admin'
UPDATE conversation_participants
SET role = CASE
    WHEN is_admin = TRUE THEN 'admin'
    ELSE 'member'
END;

COMMIT;
