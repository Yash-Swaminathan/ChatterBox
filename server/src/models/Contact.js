const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a new contact relationship
 * Returns existing contact if already exists
 *
 * @param {string} userId - The user adding the contact
 * @param {string} contactUserId - The user being added as a contact
 * @param {string|null} nickname - Optional custom display name
 * @returns {Promise<Object>} Created or existing contact with created flag
 */
async function create(userId, contactUserId, nickname = null) {
  try {
    const query = `
      INSERT INTO contacts (user_id, contact_user_id, nickname)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, contact_user_id)
      DO UPDATE SET nickname = EXCLUDED.nickname
      RETURNING id, user_id, contact_user_id, nickname, is_blocked, is_favorite, added_at
    `;

    const values = [userId, contactUserId, nickname];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      logger.warn('Contact creation returned no rows', { userId, contactUserId });
      return null;
    }

    const contact = result.rows[0];

    // Check if this was a conflict (existing contact) by comparing timestamps
    const isNew = new Date() - new Date(contact.added_at) < 1000;

    logger.info('Contact created or updated', {
      contactId: contact.id,
      userId,
      contactUserId,
      created: isNew
    });

    return {
      id: contact.id,
      userId: contact.user_id,
      contactUserId: contact.contact_user_id,
      nickname: contact.nickname,
      isBlocked: contact.is_blocked,
      isFavorite: contact.is_favorite,
      addedAt: contact.added_at,
      created: isNew
    };
  } catch (error) {
    // Handle specific PostgreSQL errors
    if (error.code === '23514') { // CHECK constraint violation
      logger.warn('Self-contact prevention triggered', { userId, contactUserId });
      throw new Error('Cannot add yourself as a contact');
    }

    if (error.code === '23503') { // Foreign key violation
      logger.warn('Contact user does not exist', { userId, contactUserId });
      throw new Error('Contact user not found');
    }

    if (error.code === '42P01') { // Table does not exist
      logger.error('Contacts table missing during create operation', {
        userId,
        contactUserId,
        error: error.message
      });
      throw new Error('Database schema not initialized. Please run migrations.');
    }

    logger.error('Error creating contact', { error: error.message, userId, contactUserId });
    throw error;
  }
}

/**
 * Find a contact by ID
 *
 * @param {string} contactId - UUID of the contact
 * @returns {Promise<Object|null>} Contact object or null if not found
 */
async function findById(contactId) {
  try {
    const query = `
      SELECT id, user_id, contact_user_id, nickname, is_blocked, is_favorite, added_at
      FROM contacts
      WHERE id = $1
    `;

    const result = await pool.query(query, [contactId]);

    if (result.rows.length === 0) {
      return null;
    }

    const contact = result.rows[0];

    return {
      id: contact.id,
      userId: contact.user_id,
      contactUserId: contact.contact_user_id,
      nickname: contact.nickname,
      isBlocked: contact.is_blocked,
      isFavorite: contact.is_favorite,
      addedAt: contact.added_at
    };
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist');
      return null;
    }

    logger.error('Error finding contact by ID', { error: error.message, contactId });
    throw error;
  }
}

/**
 * Find all contacts for a user with pagination
 *
 * @param {string} userId - UUID of the user
 * @param {number} limit - Maximum number of contacts to return (default: 50, max: 200)
 * @param {number} offset - Number of contacts to skip (default: 0)
 * @param {boolean} includeBlocked - Whether to include blocked contacts (default: false)
 * @returns {Promise<Array>} Array of contact objects with user details
 */
async function findByUser(userId, limit = 50, offset = 0, includeBlocked = false) {
  try {
    // Enforce max limit
    const safeLimit = Math.min(limit, 200);

    const query = `
      SELECT
        c.id,
        c.user_id,
        c.contact_user_id,
        c.nickname,
        c.is_blocked,
        c.is_favorite,
        c.added_at,
        u.username,
        u.email,
        u.display_name,
        u.avatar_url,
        u.status,
        u.last_seen
      FROM contacts c
      INNER JOIN users u ON c.contact_user_id = u.id
      WHERE c.user_id = $1
        ${!includeBlocked ? 'AND c.is_blocked = FALSE' : ''}
      ORDER BY c.added_at DESC
      LIMIT $2 OFFSET $3
    `;

    const values = [userId, safeLimit, offset];
    const result = await pool.query(query, values);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      contactUserId: row.contact_user_id,
      nickname: row.nickname,
      isBlocked: row.is_blocked,
      isFavorite: row.is_favorite,
      addedAt: row.added_at,
      user: {
        id: row.contact_user_id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status: row.status,
        lastSeen: row.last_seen
      }
    }));
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist');
      return [];
    }

    logger.error('Error finding contacts by user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check if a contact relationship exists
 *
 * @param {string} userId - The user ID
 * @param {string} contactUserId - The contact user ID
 * @returns {Promise<boolean>} True if contact exists, false otherwise
 */
async function isContact(userId, contactUserId) {
  try {
    const query = `
      SELECT 1
      FROM contacts
      WHERE user_id = $1 AND contact_user_id = $2
      LIMIT 1
    `;

    const result = await pool.query(query, [userId, contactUserId]);
    return result.rows.length > 0;
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist');
      return false;
    }

    logger.error('Error checking if contact exists', { error: error.message, userId, contactUserId });
    throw error;
  }
}

/**
 * Count total contacts for a user
 *
 * @param {string} userId - UUID of the user
 * @param {boolean} includeBlocked - Whether to include blocked contacts (default: false)
 * @returns {Promise<number>} Total number of contacts
 */
async function countByUser(userId, includeBlocked = false) {
  try {
    const query = `
      SELECT COUNT(*) as total
      FROM contacts
      WHERE user_id = $1
        ${!includeBlocked ? 'AND is_blocked = FALSE' : ''}
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].total, 10);
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist');
      return 0;
    }

    logger.error('Error counting contacts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update contact nickname
 *
 * @param {string} contactId - UUID of the contact
 * @param {string|null} nickname - New nickname (null to remove)
 * @returns {Promise<Object|null>} Updated contact or null if not found
 */
async function updateNickname(contactId, nickname) {
  try {
    const query = `
      UPDATE contacts
      SET nickname = $1
      WHERE id = $2
      RETURNING id, user_id, contact_user_id, nickname, is_blocked, is_favorite, added_at
    `;

    const result = await pool.query(query, [nickname, contactId]);

    if (result.rows.length === 0) {
      return null;
    }

    const contact = result.rows[0];

    logger.info('Contact nickname updated', { contactId, nickname });

    return {
      id: contact.id,
      userId: contact.user_id,
      contactUserId: contact.contact_user_id,
      nickname: contact.nickname,
      isBlocked: contact.is_blocked,
      isFavorite: contact.is_favorite,
      addedAt: contact.added_at
    };
  } catch (error) {
    logger.error('Error updating contact nickname', { error: error.message, contactId });
    throw error;
  }
}

/**
 * Toggle favorite status for a contact
 *
 * @param {string} contactId - UUID of the contact
 * @returns {Promise<Object|null>} Updated contact or null if not found
 */
async function toggleFavorite(contactId) {
  try {
    const query = `
      UPDATE contacts
      SET is_favorite = NOT is_favorite
      WHERE id = $1
      RETURNING id, user_id, contact_user_id, nickname, is_blocked, is_favorite, added_at
    `;

    const result = await pool.query(query, [contactId]);

    if (result.rows.length === 0) {
      return null;
    }

    const contact = result.rows[0];

    logger.info('Contact favorite toggled', { contactId, isFavorite: contact.is_favorite });

    return {
      id: contact.id,
      userId: contact.user_id,
      contactUserId: contact.contact_user_id,
      nickname: contact.nickname,
      isBlocked: contact.is_blocked,
      isFavorite: contact.is_favorite,
      addedAt: contact.added_at
    };
  } catch (error) {
    logger.error('Error toggling contact favorite', { error: error.message, contactId });
    throw error;
  }
}

/**
 * Toggle contact block status
 *
 * @param {string} contactId - UUID of the contact
 * @param {boolean} isBlocked - New block status
 * @returns {Promise<Object|null>} Updated contact object or null if not found
 */
async function toggleBlock(contactId, isBlocked) {
  try {
    const query = `
      UPDATE contacts
      SET is_blocked = $1
      WHERE id = $2
      RETURNING id, user_id, contact_user_id, nickname, is_blocked, is_favorite, added_at
    `;

    const result = await pool.query(query, [isBlocked, contactId]);

    if (result.rows.length === 0) {
      return null;
    }

    const contact = result.rows[0];
    logger.info('Contact block status updated', {
      contactId,
      isBlocked,
    });

    return {
      id: contact.id,
      userId: contact.user_id,
      contactUserId: contact.contact_user_id,
      nickname: contact.nickname,
      isBlocked: contact.is_blocked,
      isFavorite: contact.is_favorite,
      addedAt: contact.added_at,
    };
  } catch (error) {
    logger.error('Error toggling contact block status', {
      error: error.message,
      contactId,
      isBlocked,
    });
    throw error;
  }
}

/**
 * Check if two users have blocked each other (bidirectional check)
 * Returns true if either user has blocked the other
 *
 * @param {string} userId - First user ID
 * @param {string} targetUserId - Second user ID
 * @returns {Promise<boolean>} True if either user blocked the other
 */
async function isBlocked(userId, targetUserId) {
  try {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM contacts
        WHERE (
          (user_id = $1 AND contact_user_id = $2 AND is_blocked = TRUE)
          OR
          (user_id = $2 AND contact_user_id = $1 AND is_blocked = TRUE)
        )
      ) as blocked
    `;

    const result = await pool.query(query, [userId, targetUserId]);
    return result.rows[0]?.blocked || false;
  } catch (error) {
    logger.error('Error checking if users are blocked', {
      error: error.message,
      userId,
      targetUserId,
    });
    // Fail-safe: return false to avoid blocking legitimate messages on errors
    return false;
  }
}

/**
 * Check if sender is blocked by any recipient in a conversation
 * For 1-on-1 chats: Check if the other person blocked sender
 * For group chats: Allow (blocking only affects 1-on-1 per requirements)
 *
 * @param {string} conversationId - Conversation UUID
 * @param {string} senderId - Sender UUID
 * @returns {Promise<boolean>} True if sender is blocked
 */
async function isSenderBlockedInConversation(conversationId, senderId) {
  try {
    // Get conversation type first
    const convQuery = 'SELECT type FROM conversations WHERE id = $1';
    const convResult = await pool.query(convQuery, [conversationId]);

    if (convResult.rows.length === 0) {
      return false; // Conversation doesn't exist, let other validation handle it
    }

    const conversationType = convResult.rows[0].type;

    // Only check blocking for direct conversations
    if (conversationType !== 'direct') {
      return false; // Group chats: blocking doesn't apply (per requirements)
      // TODO (Week 7): Extend blocking to filter group message visibility
      // Currently group messages bypass blocking per Week 6 requirements
    }

    // For direct conversations: Check if the OTHER participant has blocked sender
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM conversation_participants cp
        INNER JOIN contacts c ON (
          c.user_id = cp.user_id
          AND c.contact_user_id = $2
          AND c.is_blocked = TRUE
        )
        WHERE cp.conversation_id = $1
          AND cp.user_id != $2
          AND cp.left_at IS NULL
      ) as blocked
    `;

    const result = await pool.query(query, [conversationId, senderId]);
    const isBlocked = result.rows[0]?.blocked || false;

    if (isBlocked) {
      logger.warn('Message blocked due to contact blocking', {
        conversationId,
        senderId,
      });
    }

    return isBlocked;
  } catch (error) {
    logger.error('Error checking if sender is blocked in conversation', {
      error: error.message,
      conversationId,
      senderId,
    });
    // Fail-safe: return false to avoid blocking legitimate messages on errors
    return false;
  }
}

/**
 * Delete a contact by ID
 *
 * @param {string} contactId - UUID of the contact
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteContact(contactId) {
  try {
    const query = `
      DELETE FROM contacts
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [contactId]);

    if (result.rows.length === 0) {
      return false;
    }

    logger.info('Contact deleted', { contactId });
    return true;
  } catch (error) {
    logger.error('Error deleting contact', { error: error.message, contactId });
    throw error;
  }
}

/**
 * Delete a contact by user IDs (alternative deletion method)
 *
 * @param {string} userId - The user ID
 * @param {string} contactUserId - The contact user ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteByUsers(userId, contactUserId) {
  try {
    const query = `
      DELETE FROM contacts
      WHERE user_id = $1 AND contact_user_id = $2
      RETURNING id
    `;

    const result = await pool.query(query, [userId, contactUserId]);

    if (result.rows.length === 0) {
      return false;
    }

    logger.info('Contact deleted by user IDs', { userId, contactUserId });
    return true;
  } catch (error) {
    logger.error('Error deleting contact by user IDs', { error: error.message, userId, contactUserId });
    throw error;
  }
}

/**
 * Check if contact exists (alias for isContact)
 *
 * @param {string} userId - The user ID
 * @param {string} contactUserId - The contact user ID
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
async function exists(userId, contactUserId) {
  return isContact(userId, contactUserId);
}

/**
 * Get contact details with full user information
 *
 * @param {string} contactId - UUID of the contact
 * @returns {Promise<Object|null>} Contact with user details or null if not found
 */
async function getContactDetails(contactId) {
  try {
    const query = `
      SELECT
        c.id,
        c.user_id,
        c.contact_user_id,
        c.nickname,
        c.is_blocked,
        c.is_favorite,
        c.added_at,
        u.username,
        u.email,
        u.display_name,
        u.avatar_url,
        u.status,
        u.last_seen
      FROM contacts c
      INNER JOIN users u ON c.contact_user_id = u.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [contactId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      contactUserId: row.contact_user_id,
      nickname: row.nickname,
      isBlocked: row.is_blocked,
      isFavorite: row.is_favorite,
      addedAt: row.added_at,
      user: {
        id: row.contact_user_id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status: row.status,
        lastSeen: row.last_seen
      }
    };
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist');
      return null;
    }

    logger.error('Error getting contact details', { error: error.message, contactId });
    throw error;
  }
}

module.exports = {
  create,
  findById,
  findByUser,
  isContact,
  countByUser,
  updateNickname,
  toggleFavorite,
  toggleBlock,
  isBlocked,
  isSenderBlockedInConversation,
  deleteContact,
  deleteByUsers,
  exists,
  getContactDetails
};
