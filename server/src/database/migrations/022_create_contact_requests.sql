-- Week 12: connection requests, the only way two non-owner users can start talking
CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,

    CHECK (sender_id != recipient_id)
);

-- One row per pair of users, whichever of them sent it
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_requests_pair
    ON contact_requests (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id));

-- Inbox and outbox lookups
CREATE INDEX IF NOT EXISTS idx_contact_requests_recipient ON contact_requests(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_sender ON contact_requests(sender_id, status);
