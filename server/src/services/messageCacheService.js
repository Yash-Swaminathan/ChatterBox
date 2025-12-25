const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  RECENT_MESSAGES: process.env.MESSAGE_CACHE_TTL || 300, // 5 minutes
  UNREAD_COUNT: process.env.UNREAD_COUNT_TTL || 3600, // 1 hour
  MESSAGE_STATUS: process.env.MESSAGE_STATUS_TTL || 86400, // 24 hours
  MAX_RECENT_MESSAGES: 50,
};

/**
 * MessageCacheService - Redis caching layer for message retrieval optimization
 *
 * Performance targets:
 * - Recent messages: < 50ms cache hit
 * - Unread counts: < 10ms
 * - Status updates: < 5ms (batch operations)
 *
 * TODO: Future Improvements (from Code Review)
 * - Add cache key versioning to support different query params (limit, includeDeleted)
 * - Implement distributed locking for cache population race conditions
 * - Add cache hit rate metrics for monitoring
 * - Consider Redis Cluster for high-availability production deployments
 *
 * @class MessageCacheService
 */
class MessageCacheService {
  /**
   * Get recent messages from cache (sorted by timestamp DESC)
   *
   * @param {string} conversationId - Conversation UUID
   * @param {number} [limit=50] - Max messages to retrieve
   * @returns {Promise<Array|null>} Messages or null if cache miss
   */
  static async getRecentMessages(conversationId, limit = 50) {
    try {
      const key = `conversation:${conversationId}:messages:recent`;

      // Get from Redis sorted set (newest first)
      // ZREVRANGE returns members in reverse order (high to low score)
      const cached = await redisClient.zRevRange(key, 0, limit - 1);

      if (!cached || cached.length === 0) {
        logger.debug('Cache miss - recent messages', { conversationId });
        return null; // Cache miss
      }

      // Parse JSON strings back to objects
      const messages = cached.map(msgStr => JSON.parse(msgStr));

      logger.debug('Cache hit - recent messages', {
        conversationId,
        count: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error('Cache get error - recent messages', {
        conversationId,
        error: error.message,
      });
      return null; // Graceful degradation on Redis error
    }
  }

  /**
   * Cache recent messages (replace entire cache)
   *
   * @param {string} conversationId - Conversation UUID
   * @param {Array} messages - Messages sorted DESC by created_at
   * @returns {Promise<void>}
   */
  static async setRecentMessages(conversationId, messages) {
    try {
      const key = `conversation:${conversationId}:messages:recent`;

      // Delete old cache first
      await redisClient.del(key);

      if (messages.length === 0) return;

      // Add to sorted set (score = timestamp in seconds)
      // Only cache up to MAX_RECENT_MESSAGES
      const pipeline = redisClient.multi();

      messages.slice(0, CACHE_TTL.MAX_RECENT_MESSAGES).forEach(msg => {
        const timestamp = new Date(msg.created_at).getTime() / 1000;
        pipeline.zAdd(key, {
          score: timestamp,
          value: JSON.stringify(msg),
        });
      });

      // Set expiration
      pipeline.expire(key, CACHE_TTL.RECENT_MESSAGES);

      await pipeline.exec();

      logger.debug('Messages cached', {
        conversationId,
        count: Math.min(messages.length, CACHE_TTL.MAX_RECENT_MESSAGES),
        ttl: CACHE_TTL.RECENT_MESSAGES,
      });
    } catch (error) {
      logger.error('Cache set error - recent messages', {
        conversationId,
        error: error.message,
      });
      // Don't throw - cache failures shouldn't break the app
    }
  }

  /**
   * Invalidate message cache for a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<void>}
   */
  static async invalidateConversation(conversationId) {
    try {
      const key = `conversation:${conversationId}:messages:recent`;
      await redisClient.del(key);

      logger.debug('Cache invalidated', { conversationId });
    } catch (error) {
      logger.error('Cache invalidation error', {
        conversationId,
        error: error.message,
      });
    }
  }

  /**
   * Get unread count for a user in a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID
   * @returns {Promise<number|null>} Unread count or null if cache miss
   */
  static async getUnreadCount(conversationId, userId) {
    try {
      const key = `conversation:${conversationId}:unread:${userId}`;
      const count = await redisClient.get(key);

      if (count === null) {
        logger.debug('Cache miss - unread count', { conversationId, userId });
        return null;
      }

      return parseInt(count, 10);
    } catch (error) {
      logger.error('Get unread count error', {
        conversationId,
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Increment unread count for a user in a conversation
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  static async incrementUnread(conversationId, userId) {
    try {
      const convKey = `conversation:${conversationId}:unread:${userId}`;
      const totalKey = `user:${userId}:unread:total`;

      // Increment both counters atomically
      const pipeline = redisClient.multi();
      pipeline.incr(convKey);
      pipeline.expire(convKey, CACHE_TTL.UNREAD_COUNT);
      pipeline.incr(totalKey);
      pipeline.expire(totalKey, CACHE_TTL.UNREAD_COUNT);

      await pipeline.exec();

      logger.debug('Unread count incremented', { conversationId, userId });
    } catch (error) {
      logger.error('Increment unread error', {
        conversationId,
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Reset unread count to zero (bulk mark as read)
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  static async resetUnread(conversationId, userId) {
    try {
      const convKey = `conversation:${conversationId}:unread:${userId}`;
      const totalKey = `user:${userId}:unread:total`;

      // Get current unread count before resetting
      const currentUnread = (await redisClient.get(convKey)) || 0;

      // Reset conversation unread and decrement total
      const pipeline = redisClient.multi();
      pipeline.set(convKey, 0);
      pipeline.expire(convKey, CACHE_TTL.UNREAD_COUNT);
      pipeline.decrBy(totalKey, parseInt(currentUnread, 10));

      await pipeline.exec();

      logger.debug('Unread count reset', {
        conversationId,
        userId,
        previousCount: currentUnread,
      });
    } catch (error) {
      logger.error('Reset unread error', {
        conversationId,
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Get message delivery status for a message
   *
   * @param {string} messageId - Message UUID
   * @returns {Promise<Object|null>} Hash of userId -> status or null if cache miss
   */
  static async getMessageStatus(messageId) {
    try {
      const key = `message:${messageId}:status`;
      const status = await redisClient.hGetAll(key);

      if (!status || Object.keys(status).length === 0) {
        return null; // Cache miss
      }

      return status;
    } catch (error) {
      logger.error('Get message status error', {
        messageId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Update message status for a user (sent/delivered/read)
   *
   * @param {string} messageId - Message UUID
   * @param {string} userId - User UUID
   * @param {string} status - 'sent', 'delivered', or 'read'
   * @returns {Promise<void>}
   */
  static async setMessageStatus(messageId, userId, status) {
    try {
      const key = `message:${messageId}:status`;

      // Set hash field and expire
      await redisClient.hSet(key, userId, status);
      await redisClient.expire(key, CACHE_TTL.MESSAGE_STATUS);

      logger.debug('Message status updated', { messageId, userId, status });
    } catch (error) {
      logger.error('Set message status error', {
        messageId,
        userId,
        status,
        error: error.message,
      });
    }
  }

  /**
   * Batch update message statuses (for bulk delivered/read)
   *
   * @param {Array<{messageId: string, userId: string, status: string}>} updates
   * @returns {Promise<void>}
   */
  static async batchUpdateStatus(updates) {
    try {
      if (!Array.isArray(updates) || updates.length === 0) {
        return;
      }

      const pipeline = redisClient.multi();

      updates.forEach(({ messageId, userId, status }) => {
        const key = `message:${messageId}:status`;
        pipeline.hSet(key, userId, status);
        pipeline.expire(key, CACHE_TTL.MESSAGE_STATUS);
      });

      await pipeline.exec();

      logger.debug('Batch status update completed', {
        count: updates.length,
      });
    } catch (error) {
      logger.error('Batch update status error', {
        count: updates?.length,
        error: error.message,
      });
    }
  }
}

module.exports = MessageCacheService;
