BEGIN;

-- Remove role column from conversation_participants
ALTER TABLE conversation_participants
DROP COLUMN IF EXISTS role;

-- Index will be automatically dropped with the column

COMMIT;
