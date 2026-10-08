-- Week 10: let users opt out of "the owner replied" emails
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.email_notifications IS 'Whether the user receives email when someone replies while they are away';
