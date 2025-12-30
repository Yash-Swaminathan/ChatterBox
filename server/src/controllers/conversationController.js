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
 *
 * TODO (Week 17): Typing Indicators for Groups
 * Current: Only works for direct conversations
 * Future: Implement typing indicators for group chats
 * - Aggregate typing users: "Alice, Bob, and 2 others are typing..."
 * - Redis-based typing state (TTL: 5 seconds)
 *   Key: typing:{conversationId} → ZSET of {userId: timestamp}
 * - Batch typing updates (max 1 update per 500ms)
 * - Stop broadcasting if >5 users typing ("Several people are typing")
 * - Frontend: Display multiple users typing simultaneously
 * Reference: WEEK7-8_SIMPLIFICATIONS.md
 * Priority: High | Effort: 1.5 hours
 *
 * TODO (Week 18): Group Permissions System
 * Current: Only admin/member roles (is_admin boolean)
 * Future: Customizable permissions per group
 * - Create group_permissions table
 * - PUT /api/conversations/:id/permissions endpoint
 * - Supported permissions: can_send_messages, can_add_participants, can_change_settings, can_pin_messages
 * - Middleware: checkGroupPermission(permissionName)
 * - Frontend: Permission management page (admin only)
 * Reference: WEEK7-8_SIMPLIFICATIONS.md
 * Priority: Low | Effort: 1.5 hours
 *
 * TODO (Week 18): Group Invite Links
 * Current: Only direct participant addition (POST /participants)
 * Future: Shareable invite codes with expiration and max uses
 * - Create group_invites table (invite_code, expires_at, max_uses, uses_count)
 * - POST /api/conversations/:id/invites (generate link)
 * - POST /api/invites/:code/join (join via invite)
 * - DELETE /api/conversations/:id/invites/:id (revoke)
 * - GET /api/conversations/:id/invites (list active invites)
 * - Frontend: "Invite to Group" button, copy-to-clipboard
 * Reference: WEEK7-8_SIMPLIFICATIONS.md
 * Priority: Medium | Effort: 2 hours
 *
 * TODO (Week 18): Group Archiving/Muting Endpoints
 * Current: Schema columns exist (is_muted, is_archived), but REST endpoints missing
 * Future: Add REST API endpoints and UI
 * - PUT /api/conversations/:id/mute (Body: { muted: boolean })
 * - PUT /api/conversations/:id/archive (update is_archived)
 * - GET /api/conversations?archived=true (filter archived)
 * - Frontend: Long-press context menu (Mute/Archive options)
 * - Notification logic: Skip push for muted conversations
 * Reference: conversation_participants table schema
 * Priority: Medium | Effort: 1 hour
 *
 * TODO (Week 18): Last Admin Protection
 * Current: Any admin can leave (even if last admin)
 * Future: Prevent last admin removal, auto-promote on leave
 * - Validation: Can't remove last admin from group
 *   Check: COUNT(*) WHERE is_admin = true > 1 before removing
 * - Promote new admin before leaving
 *   If last admin leaves, auto-promote longest member to admin
 * - DELETE /api/conversations/:id/participants/:userId (enforce check)
 * - Error message: "You are the last admin. Promote someone else first."
 * Reference: WEEK7-8_SIMPLIFICATIONS.md
 * Priority: Low | Effort: 1 hour
 */
async function createGroupConversation(req, res) {
  try {
    const { participantIds, name, avatarUrl } = req.body;
    const creatorId = req.user.userId;

    // 1. Auto-include creator if not in participant list (better UX)
    const uniqueParticipants = new Set(participantIds);
    if (!uniqueParticipants.has(creatorId)) {
      uniqueParticipants.add(creatorId);
      logger.info('Auto-added creator to participant list', { creatorId });
    }

    const finalParticipantIds = Array.from(uniqueParticipants);

    // 2. Validate minimum participants (3 including creator)
    if (finalParticipantIds.length < 3) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Group conversations require at least 3 participants (including you)',
      });
    }

    // 3. Verify all participants exist in database (batch query)
    const participantResults = await User.findByIds(finalParticipantIds);
    const foundUserIds = participantResults.map(u => u.id);

    // Check if any participant IDs were not found
    const notFoundIds = finalParticipantIds.filter(id => !foundUserIds.includes(id));
    if (notFoundIds.length > 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `User(s) not found: ${notFoundIds.join(', ')}`,
      });
    }

    // 4. Create group conversation
    const { conversation } = await Conversation.createGroup(creatorId, finalParticipantIds, {
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
      participantCount: finalParticipantIds.length,
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

/**
 * Get all participants in a conversation (group or direct)
 * GET /api/conversations/:conversationId/participants
 */
async function getGroupParticipants(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // 1. Verify conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    // 2. Verify requester is participant (access control)
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a participant in this conversation',
      });
    }

    // 3. Get participants (filters out users who left: left_at IS NULL)
    const participants = await Conversation.getParticipants(conversationId);

    // 4. Enrich with presence status (batch lookup to avoid N+1 queries)
    const userIds = participants.map(p => p.user_id);
    const presenceMap = await getBulkPresence(userIds);

    // 5. Transform to response format
    const enrichedParticipants = participants.map(p => ({
      userId: p.user_id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      isAdmin: p.is_admin,
      joinedAt: p.joined_at,
      presenceStatus: presenceMap[p.user_id]?.status || 'offline',
      lastSeen: presenceMap[p.user_id]?.lastSeen || null,
    }));

    logger.info('Participants retrieved', {
      conversationId,
      userId,
      participantCount: enrichedParticipants.length,
    });

    return res.status(200).json({
      success: true,
      data: {
        participants: enrichedParticipants,
        totalCount: enrichedParticipants.length,
      },
    });
  } catch (error) {
    logger.error('Error in getGroupParticipants', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      conversationId: req.params?.conversationId,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to retrieve participants',
    };

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
  getGroupParticipants,
};
