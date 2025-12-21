-- Rollback Migration: Drop conversations tables
-- Week 4 Day 1-2: Conversation Setup Rollback
-- Purpose: Safely remove conversation tables if migration needs to be undone

-- INSTRUCTIONS:
-- 1. Wrap in transaction for safety
-- 2. Drop indexes first (optional but clean)
-- 3. Drop tables in reverse order (child tables before parent tables)
-- 4. Use IF EXISTS to make rollback idempotent (can run multiple times safely)
-- 5. Use CASCADE to handle any dependencies
-- 6. Test by running: psql -U postgres -d chatterbox < server/migrations/005_rollback_conversations.sql

-- TODO: Start transaction
BEGIN;

-- TODO: Drop indexes on conversation_participants
-- Hint: DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
-- Hint: DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;


-- TODO: Drop indexes on conversations
-- Hint: DROP INDEX IF EXISTS idx_conversations_updated_at;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- TODO: Drop conversation_participants table (child table first!)
-- Use CASCADE to handle any remaining dependencies
-- Hint: DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;

-- TODO: Drop conversations table (parent table second)
-- Hint: DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- TODO: Commit 
COMMIT;


-- VERIFICATION COMMANDS (run in psql after rollback):
-- \dt conversations  (should show "No matching relations")
-- \dt conversation_participants  (should show "No matching relations")
