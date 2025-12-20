// Conversation Routes
// Week 4 Day 1-2: Conversation Setup
// Purpose: Define API routes for conversation endpoints

// INSTRUCTIONS:
// 1. Import required dependencies (express, controller, middleware)
// 2. Create Express router
// 3. Define rate limiters for each endpoint
// 4. Define routes with appropriate middleware chain
// 5. Export router
// 6. Register in server.js: app.use('/api/conversations', conversationRoutes)

// TODO: Import dependencies
// const express = require('express');
// const router = express.Router();
// const conversationController = require('../controllers/conversationController');
// const { authenticate } = require('../middleware/auth');
// const {
//   validateCreateDirectConversation,
//   validateGetConversations
// } = require('../middleware/validation');
// const rateLimit = require('express-rate-limit');


// ============================================================================
// Rate Limiters
// ============================================================================

/**
 * Rate limiter for creating conversations
 *
 * INSTRUCTIONS:
 * 1. Use express-rate-limit
 * 2. Window: 1 minute (60000 ms)
 * 3. Max requests: 60 per minute per user
 * 4. Return clear error message when limit exceeded
 *
 * Purpose: Prevent abuse of conversation creation (spam protection)
 */
// TODO: Create rate limiter
// const createConversationLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 60, // 60 requests per minute
//   message: 'Too many conversation creation requests, please try again later',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

/**
 * Rate limiter for fetching conversations
 *
 * INSTRUCTIONS:
 * 1. Window: 1 minute
 * 2. Max requests: 120 per minute per user (higher than create)
 * 3. Reading is less expensive than writing, so allow more requests
 */
// TODO: Create rate limiter
// const getConversationsLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 120, // 120 requests per minute
//   message: 'Too many requests, please try again later',
//   standardHeaders: true,
//   legacyHeaders: false,
// });


// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/conversations/direct
 * Create or get a direct (1-on-1) conversation
 *
 * INSTRUCTIONS:
 * 1. Middleware chain order matters!
 * 2. Order: authenticate → rate limit → validate → controller
 * 3. authenticate: Verify JWT token, set req.user
 * 4. rate limit: Prevent spam
 * 5. validate: Check input format
 * 6. controller: Handle business logic
 *
 * Request body: { participantId: 'uuid' }
 * Response: { conversation: {...}, created: true/false }
 */
// TODO: Define POST /direct route
// router.post(
//   '/direct',
//   authenticate,
//   createConversationLimiter,
//   validateCreateDirectConversation,
//   conversationController.createDirectConversation
// );

/**
 * GET /api/conversations
 * Get all conversations for authenticated user
 *
 * INSTRUCTIONS:
 * 1. Same middleware pattern as above
 * 2. Query params validated by validateGetConversations
 *
 * Query params: ?limit=20&offset=0&type=direct
 * Response: { conversations: [...], pagination: {...} }
 */
// TODO: Define GET / route
// router.get(
//   '/',
//   authenticate,
//   getConversationsLimiter,
//   validateGetConversations,
//   conversationController.getUserConversations
// );


// TODO: Export router
// module.exports = router;


// ============================================================================
// FUTURE ROUTES (Week 4 Day 3-5 and beyond)
// ============================================================================

// Week 4 Day 3-5: Message endpoints
// GET /api/conversations/:conversationId/messages - Get messages in conversation
// These will be added in the next implementation phase

// Week 9: Group conversations
// POST /api/conversations/group - Create group conversation
// PUT /api/conversations/:id - Update conversation (name, avatar)
// DELETE /api/conversations/:id - Delete conversation
// POST /api/conversations/:id/participants - Add participant
// DELETE /api/conversations/:id/participants/:userId - Remove participant
