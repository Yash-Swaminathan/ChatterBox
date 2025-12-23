-- Drop trigger first (depends on function)
DROP TRIGGER IF EXISTS trigger_messages_updated_at ON messages;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_messages_updated_at();

-- Drop table (cascades indexes and constraints)
DROP TABLE IF EXISTS messages;
