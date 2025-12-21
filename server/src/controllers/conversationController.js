const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { getUserPresence } = require('../services/presenceService');
const logger = require('../utils/logger');

/**
 * Create or get a direct conversation between two users
 * POST /api/conversations/direct
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createDirectConversation(req, res) {
  try {
    const { participantId } = req.body;
    const currentUserId = req.user.userId;

    // Validate user is not trying to message themselves
    if (participantId === currentUserId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot create conversation with yourself',
      });
    }

    // Verify participant user exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Get or create the direct conversation
    const { conversation, created } = await Conversation.getOrCreateDirect(
      currentUserId,
      participantId
    );

    // Fetch full conversation details with participants
    const fullConversation = await Conversation.findById(
      conversation.id,
      currentUserId
    );

    // Enrich participants with online status from presence system
    if (fullConversation.participants) {
      for (const p of fullConversation.participants) {
        const presence = await getUserPresence(p.userId);
        p.status = presence?.status || 'offline';
      }
    }

    logger.info('Direct conversation created/retrieved', {
      conversationId: conversation.id,
      userId: currentUserId,
      participantId,
      created,
    });

    return res.status(created ? 201 : 200).json({
      conversation: fullConversation,
      created,
    });
  } catch (error) {
    logger.error('Error in createDirectConversation', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create conversation',
    });
  }
}

/**
 * Get all conversations for the authenticated user
 * GET /api/conversations?limit=20&offset=0&type=direct
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserConversations(req, res) {
  try {
    const userId = req.user.userId;

    // Parse query parameters (middleware already validated)
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const type = req.query.type;

    // Fetch user's conversations from database
    const { conversations, total } = await Conversation.findByUser(userId, {
      limit,
      offset,
      type,
    });

    // Enrich each conversation with participant presence data
    for (const conv of conversations) {
      if (conv.participants) {
        for (const participant of conv.participants) {
          const presence = await getUserPresence(participant.userId);
          participant.status = presence?.status || 'offline';
        }
      }
    }

    logger.info('Conversations retrieved', {
      userId,
      count: conversations.length,
      total,
      limit,
      offset,
    });

    return res.json({
      conversations,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + conversations.length < total,
      },
    });
  } catch (error) {
    logger.error('Error in getUserConversations', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversations',
    });
  }
}

module.exports = {
  createDirectConversation,
  getUserConversations,
};
