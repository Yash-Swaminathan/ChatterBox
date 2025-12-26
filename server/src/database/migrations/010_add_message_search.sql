CREATE INDEX idx_messages_search ON messages
USING gin(to_tsvector('english', content))
WHERE deleted_at IS NULL;

CREATE INDEX idx_messages_conversation_search ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL AND content IS NOT NULL;
