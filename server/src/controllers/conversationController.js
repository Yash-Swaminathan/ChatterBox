// Conversation Controller
// Week 4 Day 1-2: Conversation Setup
// Purpose: Handle HTTP requests for conversation endpoints

// INSTRUCTIONS:
// 1. Import required dependencies (Conversation model, User model, presenceService, logger)
// 2. Implement controller functions as async/await
// 3. Extract data from req (body, query, user from auth middleware)
// 4. Validate input (additional validation beyond middleware)
// 5. Call model methods
// 6. Format responses properly
// 7. Handle errors with try/catch and return appropriate status codes
// 8. Log important operations for debugging

// TODO: Import dependencies
// const Conversation = require('../models/Conversation');
// const User = require('../models/User');
// const { getUserPresence } = require('../services/presenceService');
// const logger = require('../utils/logger');


/**
 * Create or get a direct conversation between two users
 * POST /api/conversations/direct
 *
 * INSTRUCTIONS:
 * 1. Extract participantId from req.body (validated by middleware)
 * 2. Get current user ID from req.user.userId (set by auth middleware)
 * 3. Validate participantId !== currentUserId (cannot message yourself)
 * 4. Verify participant user exists in database
 * 5. Call Conversation.getOrCreateDirect(currentUserId, participantId)
 * 6. Fetch full conversation details with Conversation.findById()
 * 7. Enrich participant data with online status from presenceService
 * 8. Return conversation with HTTP 201 (created) or 200 (existing)
 * 9. Handle all errors with appropriate status codes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * Request body: { participantId: 'uuid' }
 * Response: { conversation: {...}, created: true/false }
 */
async function createDirectConversation(req, res) {
  try {
    // TODO: Extract participantId from req.body
    // const { participantId } = req.body;

    // TODO: Get current user ID from req.user (set by authenticate middleware)
    // const currentUserId = req.user.userId;

    // TODO: Validate user is not trying to message themselves
    // if (participantId === currentUserId) {
    //   return res.status(400).json({
    //     error: 'Validation Error',
    //     message: 'Cannot create conversation with yourself'
    //   });
    // }

    // TODO: Verify participant user exists
    // const participant = await User.findById(participantId);
    // if (!participant) {
    //   return res.status(404).json({
    //     error: 'Not Found',
    //     message: 'User not found'
    //   });
    // }

    // TODO: Get or create the direct conversation
    // const { conversation, created } = await Conversation.getOrCreateDirect(
    //   currentUserId,
    //   participantId
    // );

    // TODO: Fetch full conversation details with participants
    // const fullConversation = await Conversation.findById(
    //   conversation.id,
    //   currentUserId  // Exclude current user from participants list
    // );

    // TODO: Enrich participants with online status from presence system
    // for (const p of fullConversation.participants) {
    //   const presence = await getUserPresence(p.userId);
    //   p.status = presence?.status || 'offline';
    // }

    // TODO: Log the operation
    // logger.info('Direct conversation created/retrieved', {
    //   conversationId: conversation.id,
    //   userId: currentUserId,
    //   participantId,
    //   created
    // });

    // TODO: Return response with appropriate status code
    // return res.status(created ? 201 : 200).json({
    //   conversation: fullConversation,
    //   created
    // });

  } catch (error) {
    // TODO: Log error
    // logger.error('Error in createDirectConversation', {
    //   error: error.message,
    //   stack: error.stack,
    //   userId: req.user?.userId
    // });

    // TODO: Return 500 error
    // return res.status(500).json({
    //   error: 'Internal Server Error',
    //   message: 'Failed to create conversation'
    // });
  }
}

/**
 * Get all conversations for the authenticated user
 * GET /api/conversations?limit=20&offset=0&type=direct
 *
 * INSTRUCTIONS:
 * 1. Extract query parameters (limit, offset, type) - validated by middleware
 * 2. Get current user ID from req.user.userId
 * 3. Call Conversation.findByUser() with pagination options
 * 4. For each conversation, enrich participant data with online status
 * 5. Return conversations with pagination metadata
 * 6. Handle errors appropriately
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * Query params: ?limit=20&offset=0&type=direct
 * Response: { conversations: [...], pagination: {...} }
 */
async function getUserConversations(req, res) {
  try {
    // TODO: Get current user ID
    // const userId = req.user.userId;

    // TODO: Parse and validate query parameters
    // Middleware already validated, but convert to integers
    // const limit = parseInt(req.query.limit) || 20;
    // const offset = parseInt(req.query.offset) || 0;
    // const type = req.query.type;  // 'direct' | 'group' | undefined

    // TODO: Fetch user's conversations from database
    // const { conversations, total } = await Conversation.findByUser(userId, {
    //   limit,
    //   offset,
    //   type
    // });

    // TODO: Enrich each conversation with participant presence data
    // This shows who's online/offline/away in each conversation
    // for (const conv of conversations) {
    //   for (const participant of conv.participants) {
    //     const presence = await getUserPresence(participant.userId);
    //     participant.status = presence?.status || 'offline';
    //   }
    // }

    // NOTE: In Week 4 Day 3-5, we'll add lastMessage to each conversation
    // NOTE: In Week 5, we'll add unreadCount to each conversation

    // TODO: Log the operation
    // logger.info('Conversations retrieved', {
    //   userId,
    //   count: conversations.length,
    //   total,
    //   limit,
    //   offset
    // });

    // TODO: Return conversations with pagination metadata
    // return res.json({
    //   conversations,
    //   pagination: {
    //     limit,
    //     offset,
    //     total,
    //     hasMore: offset + conversations.length < total
    //   }
    // });

  } catch (error) {
    // TODO: Log error
    // logger.error('Error in getUserConversations', {
    //   error: error.message,
    //   stack: error.stack,
    //   userId: req.user?.userId
    // });

    // TODO: Return 500 error
    // return res.status(500).json({
    //   error: 'Internal Server Error',
    //   message: 'Failed to retrieve conversations'
    // });
  }
}

// TODO: Export controller functions
// module.exports = {
//   createDirectConversation,
//   getUserConversations
// };
