const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Conversation Model
 * Handles all database operations for conversations
 */
class Conversation {
  /**
   * Create a new conversation with participants
   *
   * @param {string} type - 'direct' or 'group'
   * @param {string[]} participantIds - Array of user UUIDs to add as participants
   * @returns {Promise<Object>} Created conversation object
   * @throws {Error} If database operation fails
   *
   * Example:
   *   const conv = await Conversation.create('direct', ['user-1-uuid', 'user-2-uuid']);
   */
  static async create(type, participantIds) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create conversation
      const convResult = await client.query(
        `INSERT INTO conversations (type)
         VALUES ($1)
         RETURNING *`,
        [type]
      );

      const conversation = convResult.rows[0];

      // Add participants
      for (const userId of participantIds) {
        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id)
           VALUES ($1, $2)`,
          [conversation.id, userId]
        );
      }

      await client.query('COMMIT');

      logger.info('Conversation created', {
        conversationId: conversation.id,
        type,
        participantCount: participantIds.length,
      });

      return conversation;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating conversation', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find existing direct conversation between two users
   *
   * @param {string} userId1 - First user's UUID
   * @param {string} userId2 - Second user's UUID
   * @returns {Promise<Object|null>} Conversation object or null if not found
   */
  static async findDirectConversation(userId1, userId2) {
    const query = `
      SELECT c.*
      FROM conversations c
      INNER JOIN conversation_participants cp1
        ON c.id = cp1.conversation_id AND cp1.user_id = $1
      INNER JOIN conversation_participants cp2
        ON c.id = cp2.conversation_id AND cp2.user_id = $2
      WHERE c.type = 'direct'
        AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
      LIMIT 1
    `;

    const result = await pool.query(query, [userId1, userId2]);
    return result.rows[0] || null;
  }

  /**
   * Get or create a direct conversation (idempotent with race condition protection)
   * Uses PostgreSQL advisory locks to prevent concurrent creation of duplicate conversations
   *
   * @param {string} userId1 - First user's UUID
   * @param {string} userId2 - Second user's UUID
   * @returns {Promise<{conversation: Object, created: boolean}>}
   */
  static async getOrCreateDirect(userId1, userId2) {
    // Create a deterministic lock ID from the two user IDs (always same order)
    // This ensures both users trying to create A->B and B->A get the same lock
    const sortedIds = [userId1, userId2].sort();
    const lockString = `direct_conv_${sortedIds[0]}_${sortedIds[1]}`;

    // Convert string to a 32-bit integer for pg_advisory_lock
    // Use simple hash function (good enough for advisory locks)
    let hash = 0;
    for (let i = 0; i < lockString.length; i++) {
      hash = (hash << 5) - hash + lockString.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    const lockId = Math.abs(hash);

    try {
      // Acquire advisory lock (blocks until lock is available)
      await pool.query('SELECT pg_advisory_lock($1)', [lockId]);

      // Check again if conversation exists (now inside the lock)
      const existing = await this.findDirectConversation(userId1, userId2);

      if (existing) {
        logger.info('Existing conversation found', {
          conversationId: existing.id,
          userId1,
          userId2,
        });
        return { conversation: existing, created: false };
      }

      // Create new conversation (protected by lock)
      const conversation = await this.create('direct', [userId1, userId2]);

      return { conversation, created: true };
    } finally {
      // Always release the lock, even if there was an error
      await pool.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  }

  /**
   * Find conversation by ID with participant details
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} [excludeUserId] - Optional user ID to exclude from participants (usually current user)
   * @returns {Promise<Object|null>} Conversation with participants or null
   */
  static async findById(conversationId, excludeUserId = null) {
    const query = `
      SELECT
        c.*,
        json_agg(
          json_build_object(
            'userId', u.id,
            'username', u.username,
            'email', u.email,
            'avatarUrl', u.avatar_url
          )
        ) FILTER (WHERE u.id IS NOT NULL AND ($2::uuid IS NULL OR u.id != $2)) as participants
      FROM conversations c
      LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const result = await pool.query(query, [conversationId, excludeUserId]);
    return result.rows[0] || null;
  }

  /**
   * Find all conversations for a user (with pagination)
   *
   * @param {string} userId - User's UUID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results (default 20, max 100)
   * @param {number} options.offset - Skip this many results (default 0)
   * @param {string} [options.type] - Filter by type: 'direct' or 'group'
   * @returns {Promise<{conversations: Object[], total: number}>}
   */
  static async findByUser(userId, { limit = 20, offset = 0, type = null }) {
    // Build conversations query
    let conversationsQuery = `
      SELECT
        c.*,
        json_agg(
          json_build_object(
            'userId', u.id,
            'username', u.username,
            'email', u.email,
            'avatarUrl', u.avatar_url
          )
        ) FILTER (WHERE u.id IS NOT NULL AND u.id != $1) as participants
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
      LEFT JOIN users u ON cp2.user_id = u.id
      WHERE cp.user_id = $1
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1
    `;

    const queryParams = [userId, limit, offset];
    const countParams = [userId];

    // Add type filter if provided
    if (type) {
      conversationsQuery += ' AND c.type = $4';
      countQuery += ' AND c.type = $2';
      queryParams.push(type);
      countParams.push(type);
    }

    conversationsQuery += `
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    // Execute both queries
    const [conversationsResult, countResult] = await Promise.all([
      pool.query(conversationsQuery, queryParams),
      pool.query(countQuery, countParams),
    ]);

    const conversations = conversationsResult.rows;
    const total = parseInt(countResult.rows[0].count, 10);

    logger.info('Conversations retrieved', {
      userId,
      count: conversations.length,
      total,
      limit,
      offset,
    });

    return { conversations, total };
  }

  /**
   * Add a participant to a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to add
   * @param {boolean} [isAdmin=false] - Whether user is admin (for groups)
   * @returns {Promise<boolean>} True if added, false if already exists
   */
  static async addParticipant(conversationId, userId, isAdmin = false) {
    try {
      await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
         VALUES ($1, $2, $3)`,
        [conversationId, userId, isAdmin]
      );

      logger.info('Participant added', { conversationId, userId, isAdmin });
      return true;
    } catch (error) {
      // Check for unique constraint violation (participant already exists)
      if (error.code === '23505') {
        logger.debug('Participant already exists', { conversationId, userId });
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove a participant from a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to remove
   * @returns {Promise<number>} Number of rows deleted (0 or 1)
   */
  static async removeParticipant(conversationId, userId) {
    const result = await pool.query(
      `DELETE FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    logger.info('Participant removed', {
      conversationId,
      userId,
      removed: result.rowCount > 0,
    });

    return result.rowCount;
  }

  /**
   * Check if user is a participant in a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to check
   * @returns {Promise<boolean>} True if user is participant
   */
  static async isParticipant(conversationId, userId) {
    const result = await pool.query(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Check conversation access status in a single query
   * Returns whether conversation exists and if user is a participant
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to check
   * @returns {Promise<{exists: boolean, isParticipant: boolean}>}
   */
  static async getAccessStatus(conversationId, userId) {
    const result = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM conversations WHERE id = $1) as exists,
         EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2) as is_participant`,
      [conversationId, userId]
    );

    return {
      exists: result.rows[0].exists,
      isParticipant: result.rows[0].is_participant,
    };
  }

  /**
   * Update conversation's updated_at timestamp
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<void>}
   */
  static async touch(conversationId) {
    await pool.query(
      `UPDATE conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    logger.debug('Conversation touched', { conversationId });
  }

  /**
   * Get all participants for a conversation with user details
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<Array>} Array of participant objects
   */
  static async getParticipants(conversationId) {
    const result = await pool.query(
      `SELECT cp.user_id, cp.joined_at, cp.is_admin,
              u.username, u.display_name, u.avatar_url
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1`,
      [conversationId]
    );

    return result.rows;
  }

  /**
   * Get all participant user IDs for a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<string[]>} Array of user UUIDs
   */
  static async getParticipantIds(conversationId) {
    const result = await pool.query(
      `SELECT user_id FROM conversation_participants
       WHERE conversation_id = $1`,
      [conversationId]
    );

    return result.rows.map(row => row.user_id);
  }

  /**
   * Delete a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(conversationId) {
    const result = await pool.query('DELETE FROM conversations WHERE id = $1', [conversationId]);

    logger.info('Conversation deleted', {
      conversationId,
      deleted: result.rowCount > 0,
    });

    return result.rowCount > 0;
  }
}

module.exports = Conversation;
