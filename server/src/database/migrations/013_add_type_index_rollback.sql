BEGIN;

-- Remove indexes on conversations.type
DROP INDEX IF EXISTS idx_conversations_type;
DROP INDEX IF EXISTS idx_conversations_type_updated;

COMMIT;
