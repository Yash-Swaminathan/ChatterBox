const { pool } = require('../config/database');
const logger = require('../utils/logger');

class Message {
  static MAX_CONTENT_LENGTH = 10000;

  /**
   * Create a new message
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} senderId - Sender's user UUID
   * @param {string} content - Message content (1-10000 chars)
   * @returns {Promise<Object>} Created message with sender info
   * @throws {Error} If validation fails or database operation fails
   *
   * Example:
   *   const msg = await Message.create('conv-uuid', 'user-uuid', 'Hello world!');
   */
  static async create(conversationId, senderId, content) {
    // Validate content
    const validationError = this.validateContent(content);
    if (validationError) {
      throw new Error(validationError);
    }

    // Trim content (leading/trailing whitespace)
    const trimmedContent = content.trim();

    const query = `
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(query, [conversationId, senderId, trimmedContent]);
    const message = result.rows[0];

    logger.info('Message created', {
      messageId: message.id,
      conversationId,
      senderId,
      contentLength: trimmedContent.length,
    });

    // Fetch with sender info
    return this.findById(message.id);
  }

  /**
   * Validate message content
   *
   * @param {string} content - Content to validate
   * @returns {string|null} Error message or null if valid
   */
  static validateContent(content) {
    if (content === undefined || content === null) {
      return 'Content is required';
    }

    if (typeof content !== 'string') {
      return 'Content must be a string';
    }

    const trimmed = content.trim();

    if (trimmed.length === 0) {
      return 'Content cannot be empty';
    }

    // Validate on trimmed length for consistency (content is trimmed before saving)
    if (trimmed.length > this.MAX_CONTENT_LENGTH) {
      return `Content exceeds maximum length of ${this.MAX_CONTENT_LENGTH} characters`;
    }

    return null;
  }

  /**
   * Find message by ID with sender info
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<Object|null>} Message with sender info or null
   */
  static async findById(messageId) {
    const query = `
      SELECT
        m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'avatarUrl', u.avatar_url
        ) as sender
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1
    `;

    const result = await pool.query(query, [messageId]);
    return result.rows[0] || null;
  }

  /**
   * Find messages by conversation with cursor-based pagination
   *
   * @param {string} conversationId - Conversation UUID
   * @param {Object} options - Pagination options
   * @param {number} [options.limit=50] - Maximum messages to return (max 100)
   * @param {string} [options.cursor] - Message ID to start from (exclusive, for pagination)
   * @param {boolean} [options.includeDeleted=false] - Include soft-deleted messages
   * @returns {Promise<{messages: Object[], nextCursor: string|null, hasMore: boolean}>}
   */
  static async findByConversation(
    conversationId,
    { limit = 50, cursor = null, includeDeleted = false } = {}
  ) {
    // Ensure limit is within bounds
    const safeLimit = Math.min(Math.max(1, limit), 100);

    let query = `
      SELECT
        m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'avatarUrl', u.avatar_url
        ) as sender
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;

    const params = [conversationId];
    let paramIndex = 2;

    // Filter out deleted messages unless explicitly requested
    if (!includeDeleted) {
      query += ' AND m.deleted_at IS NULL';
    }

    // Apply cursor for pagination (get messages before this message)
    if (cursor) {
      query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    // Order by newest first, limit +1 for hasMore check
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
    params.push(safeLimit + 1);

    const result = await pool.query(query, params);

    // Check if there are more messages
    const hasMore = result.rows.length > safeLimit;
    const messages = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

    // Determine next cursor
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    logger.debug('Messages retrieved', {
      conversationId,
      count: messages.length,
      hasMore,
      cursor,
      limit: safeLimit,
    });

    return {
      messages,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    };
  }

  /**
   * Update message content
   *
   * @param {string} messageId - Message UUID
   * @param {string} content - New message content
   * @returns {Promise<Object|null>} Updated message or null if not found
   * @throws {Error} If validation fails
   */
  static async update(messageId, content) {
    // Validate content
    const validationError = this.validateContent(content);
    if (validationError) {
      throw new Error(validationError);
    }

    const trimmedContent = content.trim();

    const query = `
      UPDATE messages
      SET content = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [trimmedContent, messageId]);

    if (result.rows.length === 0) {
      return null;
    }

    logger.info('Message updated', {
      messageId,
      contentLength: trimmedContent.length,
    });

    // Return with sender info
    return this.findById(messageId);
  }

  /**
   * Soft delete a message (set deleted_at timestamp)
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<boolean>} True if deleted, false if not found or already deleted
   */
  static async softDelete(messageId) {
    const query = `
      UPDATE messages
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await pool.query(query, [messageId]);
    const deleted = result.rows.length > 0;

    logger.info('Message soft deleted', { messageId, deleted });

    return deleted;
  }

  /**
   * Hard delete a message (permanent removal)
   * Use with caution - prefer softDelete for most cases
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<boolean>} True if deleted
   */
  static async hardDelete(messageId) {
    const result = await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    const deleted = result.rowCount > 0;

    logger.info('Message hard deleted', { messageId, deleted });

    return deleted;
  }

  /**
   * Check if user is the owner (sender) of a message
   *
   * @param {string} messageId - Message UUID
   * @param {string} userId - User UUID to check
   * @returns {Promise<boolean>} True if user is the sender
   */
  static async isOwner(messageId, userId) {
    const result = await pool.query('SELECT 1 FROM messages WHERE id = $1 AND sender_id = $2', [
      messageId,
      userId,
    ]);

    return result.rows.length > 0;
  }

  /**
   * Get message count for a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {boolean} [includeDeleted=false] - Include soft-deleted messages
   * @returns {Promise<number>} Message count
   */
  static async countByConversation(conversationId, includeDeleted = false) {
    let query = 'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1';

    if (!includeDeleted) {
      query += ' AND deleted_at IS NULL';
    }

    const result = await pool.query(query, [conversationId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get the latest message for a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<Object|null>} Latest message with sender info or null
   */
  static async getLatest(conversationId) {
    const query = `
      SELECT
        m.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'avatarUrl', u.avatar_url
        ) as sender
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0] || null;
  }

  /**
   * Check if a message exists and is not deleted
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<boolean>} True if message exists and is not deleted
   */
  static async exists(messageId) {
    const result = await pool.query('SELECT 1 FROM messages WHERE id = $1 AND deleted_at IS NULL', [
      messageId,
    ]);

    return result.rows.length > 0;
  }

  /**
   * Get conversation ID for a message
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<string|null>} Conversation ID or null if message not found
   */
  static async getConversationId(messageId) {
    const result = await pool.query('SELECT conversation_id FROM messages WHERE id = $1', [
      messageId,
    ]);

    return result.rows[0]?.conversation_id || null;
  }

  /**
   * Atomically get message info for edit/delete operations
   * Returns existence status, ownership, and conversation ID in a single query
   * to prevent race conditions between checks
   *
   * @param {string} messageId - Message UUID
   * @param {string} userId - User UUID to check ownership
   * @returns {Promise<{exists: boolean, isDeleted: boolean, isOwner: boolean, conversationId: string|null}>}
   */
  static async getMessageEditInfo(messageId, userId) {
    const result = await pool.query(
      `SELECT
        conversation_id,
        sender_id,
        deleted_at
      FROM messages
      WHERE id = $1`,
      [messageId]
    );

    if (result.rows.length === 0) {
      return {
        exists: false,
        isDeleted: false,
        isOwner: false,
        conversationId: null,
      };
    }

    const row = result.rows[0];
    return {
      exists: true,
      isDeleted: row.deleted_at !== null,
      isOwner: row.sender_id === userId,
      conversationId: row.conversation_id,
    };
  }
}

module.exports = Message;
