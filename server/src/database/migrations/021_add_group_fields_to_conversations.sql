-- Group conversation fields. These were added to existing databases by a migration
-- (015) that never made it into the repository, so a database built from scratch
-- was missing them. Every statement is safe to run where they already exist.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_created_by_fkey') THEN
        ALTER TABLE conversations
            ADD CONSTRAINT conversations_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_group_name_length') THEN
        ALTER TABLE conversations
            ADD CONSTRAINT check_group_name_length
            CHECK (name IS NULL OR (LENGTH(TRIM(name)) >= 1 AND LENGTH(TRIM(name)) <= 100));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
