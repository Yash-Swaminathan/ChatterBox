BEGIN;

-- Rollback: Remove the composite index for role lookups
DROP INDEX IF EXISTS idx_participants_conv_user_active;

COMMIT;
