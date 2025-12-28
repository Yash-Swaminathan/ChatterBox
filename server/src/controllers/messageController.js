const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageCacheService = require('../services/messageCacheService');
const logger = require('../utils/logger');
const { checkRateLimit } = require('../utils/rateLimiter');

/**
 * Message Controller - REST API for message retrieval and status management
 *
 * TODO: Future Improvements (from Code Review)
 * - Cache participant lists in Redis to reduce N+1 queries (line 24)
 * - Add Redis counter for unread counts instead of DB queries (line 164)
 * - Add distributed locking for cache population to prevent race conditions
 * - Implement Prometheus metrics for cache hit rates and response times
 * - Add Redis pub/sub for cache invalidation across multiple servers
 */

/**
 * Get messages for a conversation with delivery status
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
    // 1. Check conversation exists and user is participant (single query)
    const { exists, isParticipant } = await Conversation.getAccessStatus(conversationId, userId);

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

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
      const cachedMessages = await MessageCacheService.getRecentMessages(conversationId, limit);

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

    // 4. Populate cache for first page (await to ensure deterministic test behavior)
    if (!cursor && !includeDeleted && result.messages.length > 0) {
      try {
        await MessageCacheService.setRecentMessages(conversationId, result.messages);
      } catch (err) {
        logger.error('Cache population error', {
          conversationId,
          error: err.message,
        });
        // Non-blocking: Don't fail the request if cache write fails
      }
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
      conversations.map(async conv => {
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

/**
 * Helper function to get error message for error codes
 * @param {string} code - Error code
 * @returns {string} Human-readable error message
 */
function getErrorMessage(code) {
  const messages = {
    MESSAGE_NOT_FOUND: 'Message not found or already deleted',
    NOT_OWNER: 'You can only edit your own messages',
    MESSAGE_DELETED: 'Cannot edit deleted messages',
    EDIT_WINDOW_EXPIRED: 'Messages can only be edited within 15 minutes of creation',
  };
  return messages[code] || 'Unknown error';
}

/**
 * Update message content (REST endpoint)
 * PUT /api/messages/:messageId
 * Body: { content: string }
 */
async function updateMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // 1. Rate limiting check
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      logger.warn('Message edit rate limited', {
        userId,
        messageId,
        retryAfter: rateCheck.retryAfter,
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.retryAfter / 1000)}s`,
          retryAfter: rateCheck.retryAfter,
        },
      });
    }

    // 2. Validate content
    const validationError = Message.validateContent(content);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: validationError.includes('empty') ? 'CONTENT_EMPTY' : 'CONTENT_TOO_LONG',
          message: validationError,
        },
      });
    }

    // 3. Check if message is editable (ownership + time limit)
    const editCheck = await Message.isEditableByUser(messageId, userId);
    if (!editCheck.allowed) {
      const statusCode = editCheck.reason === 'MESSAGE_NOT_FOUND' ? 404 : 403;

      logger.warn('Message edit denied', {
        userId,
        messageId,
        reason: editCheck.reason,
      });

      return res.status(statusCode).json({
        success: false,
        error: {
          code: editCheck.reason,
          message: getErrorMessage(editCheck.reason),
        },
      });
    }

    // 4. Update message
    const updatedMessage = await Message.update(messageId, content);

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found or already deleted',
        },
      });
    }

    // 5. Invalidate conversation cache
    await MessageCacheService.invalidateConversation(editCheck.conversationId);

    // 6. Broadcast Socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${editCheck.conversationId}`).emit('message:edited', {
        messageId: updatedMessage.id,
        conversationId: editCheck.conversationId,
        content: updatedMessage.content,
        editedAt: updatedMessage.updated_at,
      });
    }

    logger.info('Message updated via REST API', {
      userId,
      messageId,
      conversationId: editCheck.conversationId,
      contentLength: content.trim().length,
    });

    // 7. Return success
    return res.status(200).json({
      success: true,
      data: {
        message: updatedMessage,
      },
    });
  } catch (error) {
    logger.error('Error updating message', {
      messageId: req.params.messageId,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update message',
      },
    });
  }
}

/**
 * Delete message (soft delete)
 * DELETE /api/messages/:messageId
 */
async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // 1. Rate limiting (shared with edit)
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      logger.warn('Message delete rate limited', {
        userId,
        messageId,
        retryAfter: rateCheck.retryAfter,
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.retryAfter / 1000)}s`,
          retryAfter: rateCheck.retryAfter,
        },
      });
    }

    // 2. Get message info (atomic check)
    const msgInfo = await Message.getMessageEditInfo(messageId, userId);

    if (!msgInfo.exists || msgInfo.isDeleted) {
      logger.warn('Message delete failed - not found', {
        userId,
        messageId,
        exists: msgInfo.exists,
        isDeleted: msgInfo.isDeleted,
      });

      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found or already deleted',
        },
      });
    }

    if (!msgInfo.isOwner) {
      logger.warn('Message delete denied - not owner', {
        userId,
        messageId,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_OWNER',
          message: 'You can only delete your own messages',
        },
      });
    }

    // 3. Soft delete
    const deleted = await Message.softDelete(messageId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found or already deleted',
        },
      });
    }

    // 4. Invalidate cache
    await MessageCacheService.invalidateConversation(msgInfo.conversationId);

    // 5. Broadcast Socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${msgInfo.conversationId}`).emit('message:deleted', {
        messageId,
        conversationId: msgInfo.conversationId,
        deletedAt: new Date().toISOString(),
      });
    }

    logger.info('Message deleted via REST API', {
      userId,
      messageId,
      conversationId: msgInfo.conversationId,
    });

    // 6. Return success
    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting message', {
      messageId: req.params.messageId,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete message',
      },
    });
  }
}

/**
 * Search messages across conversations using full-text search
 */
async function searchMessages(req, res) {
  const startTime = Date.now();
  const { userId } = req.user;
  const { q, conversationId, limit, cursor, includeDeleted } = req.query;

  try {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedIncludeDeleted = includeDeleted === 'true';

    const result = await Message.searchMessages(userId, q, {
      conversationId: conversationId || null,
      limit: parsedLimit,
      cursor: cursor || null,
      includeDeleted: parsedIncludeDeleted,
    });

    const executionTime = Date.now() - startTime;

    logger.info('Message search', {
      userId,
      query: q,
      conversationId: conversationId || 'global',
      resultCount: result.messages.length,
      executionTime: `${executionTime}ms`,
    });

    return res.status(200).json({
      success: true,
      data: {
        messages: result.messages,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        query: q,
        conversationId: conversationId || null,
      },
    });
  } catch (error) {
    logger.error('Error searching messages', {
      userId,
      query: q,
      conversationId: conversationId || 'global',
      error: error.message,
      stack: error.stack,
    });

    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Search query timed out',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to search messages',
      },
    });
  }
}

module.exports = {
  getConversationMessages,
  getUnreadCounts,
  updateMessage,
  deleteMessage,
  searchMessages,
};
