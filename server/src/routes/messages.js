const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiter: 60 requests/minute for message retrieval
const getMessagesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  message: 'Too many message requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for rate limiting (more accurate than IP)
  keyGenerator: (req) => req.user?.userId || req.ip,
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
router.get(
  '/unread',
  requireAuth,
  getMessagesLimiter,
  messageController.getUnreadCounts
);

module.exports = router;
