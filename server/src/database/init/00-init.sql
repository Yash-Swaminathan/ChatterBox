-- ============================================================================
-- ChatterBox Database Initialization Script
-- This script runs automatically when the PostgreSQL container starts
-- ============================================================================

-- Ensure the database exists (Docker image already creates it via POSTGRES_DB)
-- But we'll add a comment for documentation
COMMENT ON DATABASE chatterbox IS 'ChatterBox - Real-Time Messaging Platform Database';

-- Create UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'ChatterBox database initialized successfully!';
    RAISE NOTICE 'Database: chatterbox';
    RAISE NOTICE 'Ready for migrations...';
END $$;
