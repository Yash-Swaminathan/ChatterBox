BEGIN;

DROP INDEX IF EXISTS idx_participants_active;
DROP INDEX IF EXISTS idx_participants_oldest;

ALTER TABLE conversation_participants
DROP COLUMN IF EXISTS left_at;

COMMIT;
