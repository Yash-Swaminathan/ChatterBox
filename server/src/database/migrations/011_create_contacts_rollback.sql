-- Drop indexes first
DROP INDEX IF EXISTS idx_contacts_favorite;
DROP INDEX IF EXISTS idx_contacts_blocked;
DROP INDEX IF EXISTS idx_contacts_contact_user_id;
DROP INDEX IF EXISTS idx_contacts_user_id;

-- Drop the contacts table
DROP TABLE IF EXISTS contacts CASCADE;
