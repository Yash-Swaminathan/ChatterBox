const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { getBulkPresence } = require('../services/presenceService');
const logger = require('../utils/logger');

/**
 * Create or get a direct conversation between two users
 * POST /api/conversations/direct
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
    const fullConversation = await Conversation.findById(conversation.id, currentUserId);

    // Enrich participants with online status from presence system (batch lookup)
    if (fullConversation.participants && fullConversation.participants.length > 0) {
      const participantIds = fullConversation.participants.map(p => p.userId);
      const presenceMap = await getBulkPresence(participantIds);

      fullConversation.participants.forEach(p => {
        p.status = presenceMap[p.userId]?.status || 'offline';
      });
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
      participantId: req.body?.participantId,
    });

    // More specific error messages based on error type
    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to create conversation',
    };

    // Add details in development environment for debugging
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * Create a new group conversation
 * POST /api/conversations/group
 *
 * Request body:
 * {
 *   participantIds: string[],  // Array of user UUIDs (min 3 including creator)
 *   name?: string,             // Optional group name (auto-generated if not provided)
 *   avatarUrl?: string         // Optional avatar URL
 * }
 */
async function createGroupConversation(req, res) {
  try {
    const { participantIds, name, avatarUrl } = req.body;
    const creatorId = req.user.userId;

    // 1. Verify creator is included in participantIds
    if (!participantIds.includes(creatorId)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Creator must be included in participantIds',
      });
    }

    // 2. Verify all participants exist in database (batch query)
    const participantResults = await User.findByIds(participantIds);
    const foundUserIds = participantResults.map(u => u.id);

    // Check if any participant IDs were not found
    const notFoundIds = participantIds.filter(id => !foundUserIds.includes(id));
    if (notFoundIds.length > 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `User(s) not found: ${notFoundIds.join(', ')}`,
      });
    }

    // 3. Create group conversation
    const { conversation } = await Conversation.createGroup(creatorId, participantIds, {
      name,
      avatarUrl,
    });

    // 4. Fetch full conversation details with participants
    const fullConversation = await Conversation.findById(conversation.id);

    // 5. Enrich participants with online status (batch lookup)
    if (fullConversation.participants && fullConversation.participants.length > 0) {
      const allParticipantIds = fullConversation.participants.map(p => p.userId);
      const presenceMap = await getBulkPresence(allParticipantIds);

      fullConversation.participants.forEach(participant => {
        participant.status = presenceMap[participant.userId]?.status || 'offline';
      });
    }

    logger.info('Group conversation created', {
      conversationId: conversation.id,
      creatorId,
      participantCount: participantIds.length,
      name: conversation.name,
    });

    return res.status(201).json({
      conversation: fullConversation,
      created: true,
    });
  } catch (error) {
    logger.error('Error in createGroupConversation', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      participantIds: req.body?.participantIds,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to create group conversation',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * Get all conversations for the authenticated user
 * GET /api/conversations?limit=20&offset=0&type=direct
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

    // Enrich each conversation with participant presence data (batch lookup)
    // Collect all unique participant IDs across all conversations
    const allParticipantIds = new Set();
    conversations.forEach(conv => {
      if (conv.participants) {
        conv.participants.forEach(p => allParticipantIds.add(p.userId));
      }
    });

    // Fetch presence for all participants in one batch operation
    const presenceMap = await getBulkPresence([...allParticipantIds]);

    // Apply presence data to all participants
    conversations.forEach(conv => {
      if (conv.participants) {
        conv.participants.forEach(participant => {
          participant.status = presenceMap[participant.userId]?.status || 'offline';
        });
      }
    });

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
      query: req.query,
    });

    // More specific error messages based on error type
    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversations',
    };

    // Add details in development environment for debugging
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

module.exports = {
  createDirectConversation,
  createGroupConversation,
  getUserConversations,
};
