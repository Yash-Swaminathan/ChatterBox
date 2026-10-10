const { pool } = require('../config/database');
const logger = require('../utils/logger');

// A rejected request cannot be sent again by the same person for this long
const RESEND_COOLDOWN_DAYS = 30;

const REQUEST_COLUMNS = 'id, sender_id, recipient_id, status, created_at, responded_at';

const PAIR_MATCH = `
  LEAST(sender_id, recipient_id) = LEAST($1::uuid, $2::uuid)
  AND GREATEST(sender_id, recipient_id) = GREATEST($1::uuid, $2::uuid)
`;

/**
 * Find the request between two users, whichever of them sent it
 * @param {string} userId1
 * @param {string} userId2
 * @returns {Promise<Object|null>}
 */
async function findByPair(userId1, userId2) {
  const result = await pool.query(
    `SELECT ${REQUEST_COLUMNS} FROM contact_requests WHERE ${PAIR_MATCH}`,
    [userId1, userId2]
  );
  return result.rows[0] || null;
}

/**
 * Send a connection request.
 *
 * Outcomes:
 * - 'created': a pending request now exists from sender to recipient
 * - 'accepted': the recipient had already asked the sender, so the two are now connected
 * - 'none': nothing changed (already pending or connected, or rejected within the cooldown)
 *
 * @param {string} senderId
 * @param {string} recipientId
 * @returns {Promise<{outcome: 'created'|'accepted'|'none', request: Object|null}>}
 */
async function send(senderId, recipientId) {
  const existing = await findByPair(senderId, recipientId);

  if (!existing) {
    // A concurrent request for the same pair loses to the unique index and changes nothing
    const result = await pool.query(
      `INSERT INTO contact_requests (sender_id, recipient_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING ${REQUEST_COLUMNS}`,
      [senderId, recipientId]
    );
    const request = result.rows[0] || null;
    return { outcome: request ? 'created' : 'none', request };
  }

  if (existing.status === 'accepted') {
    return { outcome: 'none', request: null };
  }

  if (existing.status === 'pending') {
    if (existing.sender_id === senderId) {
      return { outcome: 'none', request: null };
    }
    // Both sides asked each other: that is consent from both
    const request = await accept(existing.id, senderId);
    return { outcome: request ? 'accepted' : 'none', request };
  }

  // Rejected. The person who was turned down has to wait; the person who declined
  // may change their mind and ask straight away.
  const result = await pool.query(
    `UPDATE contact_requests
     SET sender_id = $2, recipient_id = $3, status = 'pending',
         created_at = CURRENT_TIMESTAMP, responded_at = NULL
     WHERE id = $1 AND status = 'rejected'
       AND (sender_id != $2 OR responded_at < CURRENT_TIMESTAMP - ($4 || ' days')::interval)
     RETURNING ${REQUEST_COLUMNS}`,
    [existing.id, senderId, recipientId, String(RESEND_COOLDOWN_DAYS)]
  );
  const request = result.rows[0] || null;
  return { outcome: request ? 'created' : 'none', request };
}

/**
 * List a user's pending requests with the other person's public details
 * @param {string} userId
 * @param {'received'|'sent'} type
 * @returns {Promise<Object[]>}
 */
async function findPendingForUser(userId, type) {
  const mine = type === 'sent' ? 'sender_id' : 'recipient_id';
  const theirs = type === 'sent' ? 'recipient_id' : 'sender_id';

  const result = await pool.query(
    `SELECT cr.id, cr.status, cr.created_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url
     FROM contact_requests cr
     JOIN users u ON u.id = cr.${theirs}
     WHERE cr.${mine} = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    },
  }));
}

/**
 * Accept a pending request and link the two users as contacts, in one transaction.
 * Presence is only broadcast to contacts, so both directions are needed.
 * @param {string} requestId
 * @param {string} recipientId - Must be the user the request was sent to
 * @returns {Promise<Object|null>} The accepted request, or null if there was nothing to accept
 */
async function accept(requestId, recipientId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE contact_requests
       SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
       RETURNING ${REQUEST_COLUMNS}`,
      [requestId, recipientId]
    );
    const request = result.rows[0];

    if (!request) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `INSERT INTO contacts (user_id, contact_user_id)
       VALUES ($1, $2), ($2, $1)
       ON CONFLICT (user_id, contact_user_id) DO NOTHING`,
      [request.sender_id, request.recipient_id]
    );

    await client.query('COMMIT');

    logger.info('Contact request accepted', {
      requestId,
      senderId: request.sender_id,
      recipientId,
    });

    return request;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reject a pending request
 * @param {string} requestId
 * @param {string} recipientId - Must be the user the request was sent to
 * @returns {Promise<Object|null>} The rejected request, or null if there was nothing to reject
 */
async function reject(requestId, recipientId) {
  const result = await pool.query(
    `UPDATE contact_requests
     SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
     RETURNING ${REQUEST_COLUMNS}`,
    [requestId, recipientId]
  );
  return result.rows[0] || null;
}

/**
 * Of the given users, return those with an accepted connection to userId
 * @param {string} userId
 * @param {string[]} otherUserIds
 * @returns {Promise<string[]>}
 */
async function filterConnected(userId, otherUserIds) {
  if (!Array.isArray(otherUserIds) || otherUserIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `SELECT CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS user_id
     FROM contact_requests
     WHERE status = 'accepted'
       AND ((sender_id = $1 AND recipient_id = ANY($2::uuid[]))
         OR (recipient_id = $1 AND sender_id = ANY($2::uuid[])))`,
    [userId, otherUserIds]
  );
  return result.rows.map(row => row.user_id);
}

/**
 * @param {string} userId1
 * @param {string} userId2
 * @returns {Promise<boolean>} True if the two users have an accepted connection
 */
async function areConnected(userId1, userId2) {
  const connected = await filterConnected(userId1, [userId2]);
  return connected.length > 0;
}

module.exports = {
  RESEND_COOLDOWN_DAYS,
  findByPair,
  send,
  findPendingForUser,
  accept,
  reject,
  filterConnected,
  areConnected,
};
