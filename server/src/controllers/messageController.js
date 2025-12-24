const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageCacheService = require('../services/messageCacheService');
const logger = require('../utils/logger');

/**
 * Get messages for a conversation with delivery status
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getConversationMessages(req, res) {
  const startTime = Date.now();
  const { conversationId } = req.params;
  const { userId } = req.user;

  // Parse query parameters
  const limit = parseInt(req.query.limit) || 50;
  const cursor = req.query.cursor || null;
  const includeDeleted = req.query.includeDeleted === 'true';

  try {
    // 1. Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this conversation',
        },
      });
    }

    // 2. Try cache first (only for first page, no cursor, no deleted filter)
    if (!cursor && !includeDeleted && limit <= 50) {
      const cachedMessages = await MessageCacheService.getRecentMessages(
        conversationId,
        limit
      );

      if (cachedMessages) {
        const cacheTime = Date.now() - startTime;

        logger.info('Messages retrieved from cache', {
          conversationId,
          userId,
          count: cachedMessages.length,
          responseTime: `${cacheTime}ms`,
        });

        return res.json({
          success: true,
          data: {
            messages: cachedMessages,
            nextCursor: null,
            hasMore: false,
            cached: true,
          },
        });
      }
    }

    // 3. Cache miss - query database
    const result = await Message.findByConversation(conversationId, {
      limit,
      cursor,
      includeDeleted,
    });

    // 4. Populate cache for first page (async, non-blocking)
    if (!cursor && !includeDeleted && result.messages.length > 0) {
      MessageCacheService.setRecentMessages(conversationId, result.messages).catch(
        (err) =>
          logger.error('Cache population error', {
            conversationId,
            error: err.message,
          })
      );
    }

    const totalTime = Date.now() - startTime;

    logger.info('Messages retrieved from database', {
      conversationId,
      userId,
      count: result.messages.length,
      hasMore: result.hasMore,
      responseTime: `${totalTime}ms`,
      cached: false,
    });

    return res.json({
      success: true,
      data: {
        messages: result.messages,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        cached: false,
      },
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;

    logger.error('Error retrieving messages', {
      conversationId,
      userId,
      error: error.message,
      stack: error.stack,
      responseTime: `${errorTime}ms`,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve messages',
      },
    });
  }
}

/**
 * Get unread count for all conversations (dashboard view)
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       totalUnread: number,
 *       byConversation: {
 *         [conversationId]: number
 *       }
 *     }
 *   }
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getUnreadCounts(req, res) {
  const { userId } = req.user;

  try {
    // Try to get total from cache
    const cachedTotal = await MessageCacheService.getUnreadCount('user', userId);

    // Get user's conversations
    const { conversations } = await Conversation.findByUser(userId, {
      limit: 100,
      offset: 0,
    });

    // Get unread count per conversation (parallel queries with cache fallback)
    const unreadByConversation = {};
    let totalUnread = 0;

    await Promise.all(
      conversations.map(async (conv) => {
        // Try cache first, fall back to database
        const count =
          (await MessageCacheService.getUnreadCount(conv.id, userId)) ||
          (await Message.getUnreadCount(conv.id, userId)) ||
          0;

        unreadByConversation[conv.id] = count;
        totalUnread += count;
      })
    );

    logger.info('Unread counts retrieved', {
      userId,
      totalUnread,
      conversationCount: conversations.length,
      cachedTotal: cachedTotal !== null,
    });

    return res.json({
      success: true,
      data: {
        totalUnread,
        byConversation: unreadByConversation,
      },
    });
  } catch (error) {
    logger.error('Error getting unread counts', {
      userId,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to get unread counts',
      },
    });
  }
}

module.exports = {
  getConversationMessages,
  getUnreadCounts,
};
