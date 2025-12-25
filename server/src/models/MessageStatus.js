const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * MessageStatus Model - Delivery tracking for messages
 *
 * Tracks message delivery progression:
 * sent → delivered → read
 *
 * @class MessageStatus
 */
class MessageStatus {
  /**
   * Create initial status entries for all participants (sent)
   * Called when message is created
   *
   * @param {string} messageId - Message UUID
   * @param {string[]} recipientIds - Participant UUIDs (excluding sender)
   * @returns {Promise<void>}
   */
  static async createInitialStatus(messageId, recipientIds) {
    if (!recipientIds || recipientIds.length === 0) {
      return;
    }

    try {
      // Build VALUES clause for batch insert
      const values = recipientIds.map((_, idx) => `($1, $${idx + 2}, 'sent')`).join(', ');

      const query = `
        INSERT INTO message_status (message_id, user_id, status)
        VALUES ${values}
        ON CONFLICT (message_id, user_id) DO NOTHING
      `;

      await pool.query(query, [messageId, ...recipientIds]);

      logger.debug('Initial message status created', {
        messageId,
        recipientCount: recipientIds.length,
      });
    } catch (error) {
      logger.error('Error creating initial message status', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Batch update message statuses (delivered or read)
   *
   * @param {string[]} messageIds - Array of message UUIDs
   * @param {string} userId - User UUID
   * @param {string} status - 'delivered' or 'read'
   * @returns {Promise<number>} Count of updated rows
   */
  static async batchUpdateStatus(messageIds, userId, status) {
    if (!messageIds || messageIds.length === 0) {
      return 0;
    }

    try {
      const statusColumn = status === 'delivered' ? 'delivered_at' : 'read_at';

      const query = `
        UPDATE message_status
        SET status = $1,
            ${statusColumn} = CURRENT_TIMESTAMP
        WHERE message_id = ANY($2)
          AND user_id = $3
          AND status != 'read'
      `;

      const result = await pool.query(query, [status, messageIds, userId]);

      logger.debug('Batch status update completed', {
        status,
        userId,
        messageCount: messageIds.length,
        updatedCount: result.rowCount,
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Error batch updating message status', {
        status,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mark all messages in conversation as read (bulk operation)
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID
   * @returns {Promise<number>} Count of updated rows
   */
  static async markConversationAsRead(conversationId, userId) {
    try {
      const query = `
        UPDATE message_status
        SET status = 'read',
            read_at = CURRENT_TIMESTAMP
        WHERE message_id IN (
          SELECT id FROM messages
          WHERE conversation_id = $1
            AND deleted_at IS NULL
        )
          AND user_id = $2
          AND status != 'read'
      `;

      const result = await pool.query(query, [conversationId, userId]);

      logger.info('Conversation marked as read', {
        conversationId,
        userId,
        messagesRead: result.rowCount,
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Error marking conversation as read', {
        conversationId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get sender IDs for messages (for broadcasting status updates)
   *
   * @param {string[]} messageIds - Array of message UUIDs
   * @returns {Promise<string[]>} Unique sender IDs
   */
  static async getSenderIds(messageIds) {
    if (!messageIds || messageIds.length === 0) {
      return [];
    }

    try {
      const query = `
        SELECT DISTINCT sender_id
        FROM messages
        WHERE id = ANY($1)
      `;

      const result = await pool.query(query, [messageIds]);
      return result.rows.map(row => row.sender_id);
    } catch (error) {
      logger.error('Error getting sender IDs', {
        messageCount: messageIds.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get delivery status counts for a message (for sender view)
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<{sent: number, delivered: number, read: number}>}
   */
  static async getMessageStatusCounts(messageId) {
    try {
      const query = `
        SELECT
          status,
          COUNT(*) as count
        FROM message_status
        WHERE message_id = $1
        GROUP BY status
      `;

      const result = await pool.query(query, [messageId]);

      // Initialize counts
      const counts = { sent: 0, delivered: 0, read: 0 };

      // Populate from query results
      result.rows.forEach(row => {
        counts[row.status] = parseInt(row.count, 10);
      });

      return counts;
    } catch (error) {
      logger.error('Error getting message status counts', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete status entries for a message (when message is hard deleted)
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<void>}
   */
  static async deleteByMessage(messageId) {
    try {
      await pool.query('DELETE FROM message_status WHERE message_id = $1', [messageId]);

      logger.debug('Message status entries deleted', { messageId });
    } catch (error) {
      logger.error('Error deleting message status', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = MessageStatus;
