-- Rollback Migration: Drop message_status table
-- Purpose: Revert 007_create_message_status.sql
-- WARNING: This will delete all delivery tracking data

BEGIN;

-- Drop message_status table (CASCADE removes dependent objects)
DROP TABLE IF EXISTS message_status CASCADE;

COMMIT;
