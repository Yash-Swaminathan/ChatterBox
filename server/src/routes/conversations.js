const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { requireAuth } = require('../middleware/auth');
const {
  validateCreateDirectConversation,
  validateCreateGroupConversation,
  validateGetConversations,
  validateUUID,
} = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// More granular control for rate limiting in tests
// Set SKIP_RATE_LIMIT=true in test environment to bypass rate limiting
const shouldSkipRateLimit = process.env.SKIP_RATE_LIMIT === 'true';

// Rate limiter for creating conversations
const createConversationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  skip: () => shouldSkipRateLimit,
  message: 'Too many conversation creation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for fetching conversations
const getConversationsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  skip: () => shouldSkipRateLimit,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/conversations/direct - Create or get direct conversation
router.post(
  '/direct',
  requireAuth,
  createConversationLimiter,
  validateCreateDirectConversation,
  conversationController.createDirectConversation
);

// POST /api/conversations/group - Create group conversation
router.post(
  '/group',
  requireAuth,
  createConversationLimiter, // Reuse existing rate limiter (60 req/min)
  validateCreateGroupConversation,
  conversationController.createGroupConversation
);

// GET /api/conversations - Get all conversations for user
router.get(
  '/',
  requireAuth,
  getConversationsLimiter,
  validateGetConversations,
  conversationController.getUserConversations
);

// GET /api/conversations/:conversationId/participants - Get conversation participants
router.get(
  '/:conversationId/participants',
  requireAuth,
  getConversationsLimiter, // Reuse existing rate limiter (120 req/min)
  validateUUID('conversationId'),
  conversationController.getGroupParticipants
);

module.exports = router;
