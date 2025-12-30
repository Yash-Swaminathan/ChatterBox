BEGIN;

-- Add index on conversations.type for efficient filtering
-- This supports queries like GET /api/conversations?type=group
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);

-- Add composite index for better performance on type filtering with sorting
-- This optimizes the most common query pattern: filter by type AND sort by updated_at
CREATE INDEX IF NOT EXISTS idx_conversations_type_updated
ON conversations(type, updated_at DESC);

-- Documentation
COMMENT ON INDEX idx_conversations_type IS 'Supports filtering conversations by type (direct/group)';
COMMENT ON INDEX idx_conversations_type_updated IS 'Optimizes type filtering with recency sorting';

COMMIT;
