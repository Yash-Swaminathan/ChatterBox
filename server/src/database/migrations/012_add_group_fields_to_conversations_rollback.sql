BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS idx_conversations_created_by;

-- Drop check constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS check_group_name_length;

-- Drop columns
ALTER TABLE conversations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS name;

COMMIT;
