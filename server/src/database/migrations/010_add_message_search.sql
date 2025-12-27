-- Full-text search index for message content (10-100x faster searches)
CREATE INDEX idx_messages_search ON messages
USING gin(to_tsvector('english', content))
WHERE deleted_at IS NULL;

-- Composite index for conversation-scoped searches
CREATE INDEX idx_messages_conversation_search ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL AND content IS NOT NULL;

-- Pagination index for cursor-based pagination (created_at, id)
CREATE INDEX idx_messages_pagination ON messages(created_at DESC, id DESC)
WHERE deleted_at IS NULL;
