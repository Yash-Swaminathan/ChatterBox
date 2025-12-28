-- Rollback migration: Remove blocking search optimization index
DROP INDEX IF EXISTS idx_contacts_blocking_lookup;
