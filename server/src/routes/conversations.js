const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  validateCreateDirectConversation,
  validateCreateGroupConversation,
  validateGetConversations,
  validateUUID,
  validateAddParticipants,
  validateGroupSettings,
  validateRoleUpdate,
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

/**
 * Add participants to a group conversation (admin-only)
 * POST /api/conversations/:conversationId/participants
 */
router.post(
  '/:conversationId/participants',
  requireAuth,
  validateUUID('conversationId'),
  requireAdmin, // Must be admin to add participants
  validateAddParticipants(),
  createConversationLimiter, // Reuse existing limiter (60 req/min)
  conversationController.addParticipants
);

/**
 * Remove a participant from a group conversation
 * DELETE /api/conversations/:conversationId/participants/:userId
 * Authorization: Admin OR self-removal
 */
router.delete(
  '/:conversationId/participants/:userId',
  requireAuth,
  validateUUID('conversationId'),
  validateUUID('userId'),
  createConversationLimiter, // Reuse existing limiter (60 req/min)
  conversationController.removeParticipant
);

/**
 * Update participant role (promote/demote admin)
 *
 * @route PUT /api/conversations/:conversationId/participants/:userId/role
 * @access Admin-only
 * @ratelimit 60 requests per minute (shared with conversation creation)
 *
 * @param {string} req.params.conversationId - UUID of group conversation
 * @param {string} req.params.userId - UUID of participant to promote/demote
 * @param {string} req.body.role - 'admin' or 'member' (case-insensitive)
 *
 * @returns {Object} 200 - Success response with updated participant
 * @returns {Object} 400 - Invalid input or last admin demotion attempt
 * @returns {Object} 403 - Non-admin requester
 * @returns {Object} 404 - Conversation or participant not found
 * @returns {Object} 429 - Rate limit exceeded (60 req/min)
 * @returns {Object} 500 - Internal server error
 *
 * @example
 * // Promote user to admin
 * PUT /api/conversations/abc-123/participants/user-456/role
 * Body: { "role": "admin" }
 */
router.put(
  '/:conversationId/participants/:userId/role',
  requireAuth,
  validateUUID('conversationId'),
  validateUUID('userId'),
  validateRoleUpdate,
  createConversationLimiter, // Rate limit: 60 req/min (shared with POST /api/conversations)
  conversationController.updateParticipantRole
);

/**
 * Update group settings (name, avatar)
 *
 * @route PUT /api/conversations/:conversationId
 * @access Admin-only
 * @ratelimit 60 requests per minute (shared with conversation creation)
 *
 * @param {string} req.params.conversationId - UUID of group conversation
 * @param {string} [req.body.name] - New group name (1-100 chars, trimmed, optional)
 * @param {string|null} [req.body.avatarUrl] - New avatar URL (HTTP/HTTPS only) or null to remove (optional)
 *
 * @returns {Object} 200 - Success response with updated conversation
 * @returns {Object} 400 - Invalid input, not a group conversation, or no fields provided
 * @returns {Object} 403 - Non-admin requester
 * @returns {Object} 404 - Conversation not found
 * @returns {Object} 429 - Rate limit exceeded (60 req/min)
 * @returns {Object} 500 - Internal server error
 *
 * @example
 * // Update group name only
 * PUT /api/conversations/abc-123
 * Body: { "name": "New Group Name" }
 *
 * @example
 * // Update both name and avatar
 * PUT /api/conversations/abc-123
 * Body: { "name": "Updated Name", "avatarUrl": "https://example.com/avatar.jpg" }
 *
 * @example
 * // Remove avatar
 * PUT /api/conversations/abc-123
 * Body: { "avatarUrl": null }
 */
router.put(
  '/:conversationId',
  requireAuth,
  validateUUID('conversationId'),
  validateGroupSettings,
  createConversationLimiter, // Rate limit: 60 req/min (shared with POST /api/conversations)
  conversationController.updateGroupSettings
);

module.exports = router;
