const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const {
  validateGetMessages,
  validateMessageEdit,
  validateMessageDelete,
  validateMessageSearch,
} = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiter: 60 requests/minute for message retrieval
const getMessagesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  message: 'Too many message requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for rate limiting (more accurate than IP)
  keyGenerator: req => {
    // Prefer user ID if authenticated, otherwise skip rate limiting
    // (auth middleware will catch unauthenticated requests)
    return req.user?.userId || 'unauthenticated';
  },
  skip: req => !req.user, // Skip rate limiting for unauthenticated requests
});

/**
 * GET /api/messages/conversations/:conversationId
 *
 * Retrieve messages for a conversation with cursor-based pagination
 *
 * Query Parameters:
 *   - limit (number, optional): Messages per page (1-100, default 50)
 *   - cursor (string, optional): Message ID for pagination
 *   - includeDeleted (boolean, optional): Include soft-deleted messages (admin only)
 *
 * Response: { messages, nextCursor, hasMore, cached }
 */
router.get(
  '/conversations/:conversationId',
  requireAuth,
  validateGetMessages,
  getMessagesLimiter,
  messageController.getConversationMessages
);

/**
 * GET /api/messages/unread
 *
 * Get unread message counts for all conversations
 *
 * Response: { totalUnread, byConversation }
 */
router.get('/unread', requireAuth, getMessagesLimiter, messageController.getUnreadCounts);

/**
 * GET /api/messages/search
 *
 * Search messages using PostgreSQL full-text search
 * Supports both global search and conversation-scoped search
 *
 * Query Parameters:
 *   - q (string, required): Search query (1-100 chars)
 *   - conversationId (string, optional): Scope search to specific conversation
 *   - limit (number, optional): Results per page (1-100, default 50)
 *   - cursor (string, optional): Cursor for pagination (format: timestamp:uuid)
 *   - includeDeleted (boolean, optional): Include soft-deleted messages
 *
 * Response: { messages, nextCursor, hasMore, query, conversationId }
 */
router.get(
  '/search',
  requireAuth,
  validateMessageSearch,
  getMessagesLimiter,
  messageController.searchMessages
);

// Rate limiter for edit/delete: 60 requests/minute (same as GET endpoints)
const messageEditLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many edit/delete requests. Try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId || 'unauthenticated',
  skip: req => !req.user,
});

/**
 * PUT /api/messages/:messageId
 *
 * Edit a message (must be owner, within 15-minute window)
 *
 * Body: { content: string }
 *
 * Response: { success: true, data: { message } }
 */
router.put(
  '/:messageId',
  requireAuth,
  validateMessageEdit,
  messageEditLimiter,
  messageController.updateMessage
);

/**
 * DELETE /api/messages/:messageId
 *
 * Delete a message (soft delete, must be owner)
 *
 * Response: { success: true, message: "Message deleted successfully" }
 */
router.delete(
  '/:messageId',
  requireAuth,
  validateMessageDelete,
  messageEditLimiter,
  messageController.deleteMessage
);

module.exports = router;
