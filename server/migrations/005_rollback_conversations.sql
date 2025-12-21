-- Rollback Migration: Drop conversations tables
-- Week 4 Day 1-2: Conversation Setup Rollback

BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- Drop tables (child first, parent second)
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

COMMIT;
