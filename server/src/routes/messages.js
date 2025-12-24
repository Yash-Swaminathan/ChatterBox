const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const { validateGetMessages } = require('../middleware/validation');
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

module.exports = router;
