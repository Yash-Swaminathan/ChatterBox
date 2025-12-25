-- rollback to reverse changes made by migration file
BEGIN;

-- Drop composite index for unread count queries
DROP INDEX IF EXISTS idx_message_status_user_status;

COMMIT;
