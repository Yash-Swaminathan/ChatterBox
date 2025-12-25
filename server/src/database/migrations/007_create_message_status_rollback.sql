BEGIN;

-- Drop message_status table (CASCADE removes dependent objects)
DROP TABLE IF EXISTS message_status CASCADE;

COMMIT;
