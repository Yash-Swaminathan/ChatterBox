-- Create contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100),
    is_blocked BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate contacts (user can only add same contact once)
    UNIQUE(user_id, contact_user_id),

    -- Prevent self-contacts (user cannot add themselves)
    CHECK (user_id != contact_user_id)
);

-- Index for finding all contacts of a user (most common query)
CREATE INDEX idx_contacts_user_id ON contacts(user_id);

-- Index for reverse lookup (who has this user as a contact)
CREATE INDEX idx_contacts_contact_user_id ON contacts(contact_user_id);

-- Composite index for filtering blocked contacts (performance optimization)
CREATE INDEX idx_contacts_blocked ON contacts(user_id, is_blocked);

-- Index for finding favorite contacts
CREATE INDEX idx_contacts_favorite ON contacts(user_id, is_favorite) WHERE is_favorite = TRUE;

-- Comments for documentation
COMMENT ON TABLE contacts IS 'Stores user contact relationships (one-way follows, like Twitter)';
COMMENT ON COLUMN contacts.user_id IS 'The user who added the contact';
COMMENT ON COLUMN contacts.contact_user_id IS 'The user being added as a contact';
COMMENT ON COLUMN contacts.nickname IS 'Optional custom display name for this contact';
COMMENT ON COLUMN contacts.is_blocked IS 'True if this contact is blocked (prevents messaging in Week 6 Day 2)';
COMMENT ON COLUMN contacts.is_favorite IS 'True if this contact is marked as favorite';
COMMENT ON COLUMN contacts.added_at IS 'Timestamp when contact was added';
