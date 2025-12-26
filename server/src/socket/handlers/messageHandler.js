const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const MessageStatus = require('../../models/MessageStatus');
const User = require('../../models/User');
const MessageCacheService = require('../../services/messageCacheService');
const logger = require('../../utils/logger');
const { isValidUUID } = require('../../utils/validators');
const { checkRateLimit } = require('../../utils/rateLimiter');

/**
 * Message Handler - Socket.io event handlers for real-time messaging
 *
 * TODO: Future Improvements (from Code Review)
 * - Optimize read receipt broadcasting (only send to message sender, not entire room) ✅ DONE (Week 4)
 * - Batch read status updates (send every 5s instead of immediately)
 * - Add duplicate status update check before DB query
 * - Add Prometheus metrics for message throughput and latency
 *
 * TODO (Week 17): Advanced Read Receipt Optimizations
 * - Implement batching for read receipts (send every 5s instead of immediately)
 *   Priority: MEDIUM - Reduces socket events by ~90% for active conversations
 *   Use Redis SET to accumulate read events, flush with setInterval
 * - Add aggregated read status display for group chats
 *   Priority: MEDIUM - Show "Seen by Alice, Bob, and 3 others"
 *   Respect privacy settings (filter users with hide_read_status=TRUE)
 * - Implement distributed locking for cache population
 *   Priority: HIGH - Required for horizontal scaling beyond 2 instances
 *   Use Redis SETNX to prevent race conditions across servers
 * - Add Prometheus metrics for monitoring
 *   Priority: LOW - Track read_receipts_sent, privacy_blocks, cache_hit_rate
 *
 * NOTE: Rate limiter moved to shared utility (server/src/utils/rateLimiter.js)
 * - Shared across Socket.io and REST API for consistent rate limiting
 * - TODO Week 17: Move to Redis for horizontal scaling
 */

// Error codes for message events
const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  CONTENT_EMPTY: 'CONTENT_EMPTY',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  INVALID_CONVERSATION: 'INVALID_CONVERSATION',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  NOT_OWNER: 'NOT_OWNER',
  RATE_LIMITED: 'RATE_LIMITED',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

/**
 * Validate message send data
 * @param {Object} data - Data to validate
 * @returns {{valid: boolean, error?: {code: string, message: string}}}
 */
function validateMessageSend(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid request data' },
    };
  }

  const { conversationId, content } = data;

  // Validate conversationId
  if (!conversationId) {
    return {
      valid: false,
      error: { code: ERROR_CODES.INVALID_CONVERSATION, message: 'Conversation ID is required' },
    };
  }

  if (!isValidUUID(conversationId)) {
    return {
      valid: false,
      error: { code: ERROR_CODES.INVALID_CONVERSATION, message: 'Invalid conversation ID format' },
    };
  }

  // Validate content
  const contentError = Message.validateContent(content);
  if (contentError) {
    const code = contentError.includes('empty')
      ? ERROR_CODES.CONTENT_EMPTY
      : contentError.includes('exceeds')
        ? ERROR_CODES.CONTENT_TOO_LONG
        : ERROR_CODES.INVALID_INPUT;

    return { valid: false, error: { code, message: contentError } };
  }

  return { valid: true };
}

/**
 * Validate message edit data
 * @param {Object} data - Data to validate
 * @returns {{valid: boolean, error?: {code: string, message: string}}}
 */
function validateMessageEdit(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid request data' },
    };
  }

  const { messageId, content } = data;

  // Validate messageId
  if (!messageId) {
    return {
      valid: false,
      error: { code: ERROR_CODES.MESSAGE_NOT_FOUND, message: 'Message ID is required' },
    };
  }

  if (!isValidUUID(messageId)) {
    return {
      valid: false,
      error: { code: ERROR_CODES.MESSAGE_NOT_FOUND, message: 'Invalid message ID format' },
    };
  }

  // Validate content
  const contentError = Message.validateContent(content);
  if (contentError) {
    const code = contentError.includes('empty')
      ? ERROR_CODES.CONTENT_EMPTY
      : contentError.includes('exceeds')
        ? ERROR_CODES.CONTENT_TOO_LONG
        : ERROR_CODES.INVALID_INPUT;

    return { valid: false, error: { code, message: contentError } };
  }

  return { valid: true };
}

/**
 * Validate message delete data
 * @param {Object} data - Data to validate
 * @returns {{valid: boolean, error?: {code: string, message: string}}}
 */
function validateMessageDelete(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: { code: ERROR_CODES.INVALID_INPUT, message: 'Invalid request data' },
    };
  }

  const { messageId } = data;

  if (!messageId) {
    return {
      valid: false,
      error: { code: ERROR_CODES.MESSAGE_NOT_FOUND, message: 'Message ID is required' },
    };
  }

  if (!isValidUUID(messageId)) {
    return {
      valid: false,
      error: { code: ERROR_CODES.MESSAGE_NOT_FOUND, message: 'Invalid message ID format' },
    };
  }

  return { valid: true };
}

/**
 * Handle message:send event
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 */
async function handleMessageSend(io, socket, data) {
  const { userId } = socket.user;
  const tempId = data?.tempId || `server-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Validate input
    const validation = validateMessageSend(data);
    if (!validation.valid) {
      socket.emit('message:error', { tempId, ...validation.error });
      return;
    }

    const { conversationId, content } = data;

    // Check rate limit
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      socket.emit('message:error', {
        tempId,
        code: ERROR_CODES.RATE_LIMITED,
        message: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.retryAfter / 1000)} seconds.`,
        retryAfter: rateCheck.retryAfter,
      });
      return;
    }

    // Verify user is participant in conversation
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      socket.emit('message:error', {
        tempId,
        code: ERROR_CODES.NOT_PARTICIPANT,
        message: 'You are not a participant in this conversation',
      });
      return;
    }

    // Auto-join conversation room if not already in it
    const roomName = `conversation:${conversationId}`;
    if (!socket.rooms.has(roomName)) {
      socket.join(roomName);
      logger.debug('Socket auto-joined conversation room', {
        socketId: socket.id,
        userId,
        conversationId,
      });
    }

    // Save message to database
    const message = await Message.create(conversationId, userId, content);

    // Get recipient IDs (all participants except sender)
    const participants = await Conversation.getParticipants(conversationId);
    const recipientIds = participants.map(p => p.user_id).filter(id => id !== userId);

    // Create initial message status entries (sent) for all recipients
    if (recipientIds.length > 0) {
      await MessageStatus.createInitialStatus(message.id, recipientIds);
    }

    // Invalidate conversation cache and increment unread counts
    await MessageCacheService.invalidateConversation(conversationId);
    for (const recipientId of recipientIds) {
      await MessageCacheService.incrementUnread(conversationId, recipientId);
    }

    // Update conversation's updated_at timestamp
    await Conversation.touch(conversationId);

    // Broadcast to all participants in the conversation (including sender)
    io.to(roomName).emit('message:new', {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      createdAt: message.created_at,
      sender: message.sender,
      tempId,
    });

    // Send confirmation to sender
    socket.emit('message:sent', {
      tempId,
      messageId: message.id,
      createdAt: message.created_at,
    });

    logger.info('Message sent', {
      messageId: message.id,
      conversationId,
      senderId: userId,
      contentLength: content.trim().length,
    });
  } catch (error) {
    logger.error('Error handling message:send', {
      userId,
      tempId,
      error: error.message,
      stack: error.stack,
    });

    socket.emit('message:error', {
      tempId,
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Failed to send message',
    });
  }
}

/**
 * Handle message:edit event
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 */
async function handleMessageEdit(io, socket, data) {
  const { userId } = socket.user;

  try {
    // Validate input
    const validation = validateMessageEdit(data);
    if (!validation.valid) {
      socket.emit('message:error', validation.error);
      return;
    }

    const { messageId, content } = data;

    // Atomically check existence, deletion status, and ownership in a single query
    // This prevents race conditions between separate checks
    const msgInfo = await Message.getMessageEditInfo(messageId, userId);

    if (!msgInfo.exists) {
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found',
      });
      return;
    }

    if (msgInfo.isDeleted) {
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found or already deleted',
      });
      return;
    }

    if (!msgInfo.isOwner) {
      socket.emit('message:error', {
        code: ERROR_CODES.NOT_OWNER,
        message: 'You can only edit your own messages',
      });
      return;
    }

    const conversationId = msgInfo.conversationId;

    // Update the message
    const updatedMessage = await Message.update(messageId, content);
    if (!updatedMessage) {
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found or already deleted',
      });
      return;
    }

    // Invalidate conversation cache
    await MessageCacheService.invalidateConversation(conversationId);

    // Broadcast edit to all participants
    const roomName = `conversation:${conversationId}`;
    io.to(roomName).emit('message:edited', {
      messageId: updatedMessage.id,
      conversationId,
      content: updatedMessage.content,
      updatedAt: updatedMessage.updated_at,
    });

    // Send confirmation to sender
    socket.emit('message:edit-confirmed', {
      messageId: updatedMessage.id,
      editedAt: updatedMessage.updated_at,
    });

    logger.info('Message edited', {
      messageId,
      conversationId,
      userId,
      contentLength: content.trim().length,
    });
  } catch (error) {
    logger.error('Error handling message:edit', {
      userId,
      error: error.message,
      stack: error.stack,
    });

    socket.emit('message:error', {
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Failed to edit message',
    });
  }
}

/**
 * Handle message:delete event
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 */
async function handleMessageDelete(io, socket, data) {
  const { userId } = socket.user;

  try {
    // Validate input
    const validation = validateMessageDelete(data);
    if (!validation.valid) {
      socket.emit('message:error', validation.error);
      return;
    }

    const { messageId } = data;

    // Atomically check existence, deletion status, and ownership in a single query
    // This prevents race conditions between separate checks
    const msgInfo = await Message.getMessageEditInfo(messageId, userId);

    if (!msgInfo.exists) {
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found',
      });
      return;
    }

    if (msgInfo.isDeleted) {
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found or already deleted',
      });
      return;
    }

    if (!msgInfo.isOwner) {
      socket.emit('message:error', {
        code: ERROR_CODES.NOT_OWNER,
        message: 'You can only delete your own messages',
      });
      return;
    }

    const conversationId = msgInfo.conversationId;

    // Soft delete the message
    const deleted = await Message.softDelete(messageId);
    if (!deleted) {
      // Message already deleted - idempotent response
      socket.emit('message:error', {
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found or already deleted',
      });
      return;
    }

    // Invalidate conversation cache
    await MessageCacheService.invalidateConversation(conversationId);

    // Broadcast deletion to all participants
    const roomName = `conversation:${conversationId}`;
    io.to(roomName).emit('message:deleted', {
      messageId,
      conversationId,
    });

    // Send confirmation to sender
    socket.emit('message:delete-confirmed', {
      messageId,
      deletedAt: new Date().toISOString(),
    });

    logger.info('Message deleted', {
      messageId,
      conversationId,
      userId,
    });
  } catch (error) {
    logger.error('Error handling message:delete', {
      userId,
      error: error.message,
      stack: error.stack,
    });

    socket.emit('message:error', {
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Failed to delete message',
    });
  }
}

/**
 * Handle conversation:join event - manually join a conversation room
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 */
async function handleConversationJoin(socket, data) {
  const { userId } = socket.user;

  try {
    if (!data || !data.conversationId || !isValidUUID(data.conversationId)) {
      socket.emit('error', { message: 'Invalid conversation ID' });
      return;
    }

    const { conversationId } = data;

    // Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      socket.emit('error', { message: 'You are not a participant in this conversation' });
      return;
    }

    const roomName = `conversation:${conversationId}`;
    socket.join(roomName);

    socket.emit('conversation:joined', { conversationId });

    logger.info('User joined conversation room', {
      userId,
      conversationId,
      socketId: socket.id,
    });
  } catch (error) {
    logger.error('Error joining conversation', {
      userId,
      error: error.message,
    });
    socket.emit('error', { message: 'Failed to join conversation' });
  }
}

/**
 * Handle conversation:leave event - leave a conversation room
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 */
function handleConversationLeave(socket, data) {
  const { userId } = socket.user;

  if (!data || !data.conversationId || !isValidUUID(data.conversationId)) {
    socket.emit('error', { message: 'Invalid conversation ID' });
    return;
  }

  const { conversationId } = data;
  const roomName = `conversation:${conversationId}`;

  socket.leave(roomName);

  socket.emit('conversation:left', { conversationId });

  logger.info('User left conversation room', {
    userId,
    conversationId,
    socketId: socket.id,
  });
}

/**
 * Handle message:delivered event
 * Client confirms messages have been received
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data with messageIds array
 */
async function handleMessageDelivered(io, socket, data) {
  const { userId } = socket.user;

  try {
    // Validate input
    if (!data || !Array.isArray(data.messageIds) || data.messageIds.length === 0) {
      socket.emit('message:error', {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'messageIds array required',
      });
      return;
    }

    const { messageIds } = data;

    // Validate all message IDs are UUIDs
    const invalidIds = messageIds.filter(id => !isValidUUID(id));
    if (invalidIds.length > 0) {
      socket.emit('message:error', {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid message ID format',
      });
      return;
    }

    // Batch update message status to 'delivered'
    const updatedCount = await MessageStatus.batchUpdateStatus(messageIds, userId, 'delivered');

    // Update cache for each message
    const cacheUpdates = messageIds.map(messageId => ({
      messageId,
      userId,
      status: 'delivered',
    }));
    await MessageCacheService.batchUpdateStatus(cacheUpdates);

    // Get sender IDs to notify them
    const senderIds = await MessageStatus.getSenderIds(messageIds);

    // Broadcast delivery status to each sender
    senderIds.forEach(senderId => {
      io.to(`user:${senderId}`).emit('message:delivery-status', {
        messageIds,
        userId,
        status: 'delivered',
        timestamp: new Date().toISOString(),
      });
    });

    // Confirm to client
    socket.emit('message:delivery-confirmed', {
      messageIds,
      updatedCount,
    });

    logger.info('Messages marked as delivered', {
      userId,
      messageCount: messageIds.length,
      updatedCount,
    });
  } catch (error) {
    logger.error('Error handling message:delivered', {
      userId,
      error: error.message,
      stack: error.stack,
    });

    socket.emit('message:error', {
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Failed to mark messages as delivered',
    });
  }
}

/**
 * Handle message:read event
 * Mark messages as read when user views conversation
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data with conversationId or messageIds
 */
async function handleMessageRead(io, socket, data) {
  const { userId } = socket.user;

  try {
    // Validate input
    if (!data || typeof data !== 'object') {
      socket.emit('message:error', {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid request data',
      });
      return;
    }

    let updatedCount = 0;
    let senderIds = [];

    // Option 1: Mark entire conversation as read (bulk operation)
    if (data.conversationId) {
      const { conversationId } = data;

      if (!isValidUUID(conversationId)) {
        socket.emit('message:error', {
          code: ERROR_CODES.INVALID_CONVERSATION,
          message: 'Invalid conversation ID format',
        });
        return;
      }

      // Verify user is participant
      const isParticipant = await Conversation.isParticipant(conversationId, userId);
      if (!isParticipant) {
        socket.emit('message:error', {
          code: ERROR_CODES.NOT_PARTICIPANT,
          message: 'You are not a participant in this conversation',
        });
        return;
      }

      // Mark all messages in conversation as read
      updatedCount = await MessageStatus.markConversationAsRead(conversationId, userId);

      // Reset unread count in cache
      await MessageCacheService.resetUnread(conversationId, userId);

      // Get all senders from this conversation to notify them
      // (This is simplified - in production you might want to get only unread message senders)
      const messages = await Message.findByConversation(conversationId, { limit: 100 });
      senderIds = [...new Set(messages.messages.map(m => m.sender_id))].filter(id => id !== userId);

      logger.info('Conversation marked as read', {
        userId,
        conversationId,
        messagesRead: updatedCount,
      });
    }
    // Option 2: Mark specific messages as read
    else if (data.messageIds && Array.isArray(data.messageIds)) {
      const { messageIds } = data;

      if (messageIds.length === 0) {
        socket.emit('message:error', {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'messageIds array cannot be empty',
        });
        return;
      }

      // Validate all message IDs are UUIDs
      const invalidIds = messageIds.filter(id => !isValidUUID(id));
      if (invalidIds.length > 0) {
        socket.emit('message:error', {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Invalid message ID format',
        });
        return;
      }

      // Batch update message status to 'read'
      updatedCount = await MessageStatus.batchUpdateStatus(messageIds, userId, 'read');

      // Update cache for each message
      const cacheUpdates = messageIds.map(messageId => ({
        messageId,
        userId,
        status: 'read',
      }));
      await MessageCacheService.batchUpdateStatus(cacheUpdates);

      // Get sender IDs to notify them
      senderIds = await MessageStatus.getSenderIds(messageIds);

      logger.info('Messages marked as read', {
        userId,
        messageCount: messageIds.length,
        updatedCount,
      });
    } else {
      socket.emit('message:error', {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Either conversationId or messageIds required',
      });
      return;
    }

    // Check privacy settings before broadcasting read status
    const hideReadStatus = await User.getReadReceiptPrivacy(userId);

    if (hideReadStatus) {
      // Privacy enabled: don't broadcast read status to senders
      logger.info('Read receipt privacy enabled, skipping broadcast', {
        userId,
        messageCount: data.messageIds ? data.messageIds.length : 'conversation',
      });
    } else {
      // Privacy disabled: broadcast read status to each sender
      senderIds.forEach(senderId => {
        io.to(`user:${senderId}`).emit('message:read-status', {
          userId,
          status: 'read',
          timestamp: new Date().toISOString(),
        });
      });

      logger.debug('Read receipts broadcasted to senders', {
        userId,
        senderCount: senderIds.length,
      });
    }

    // Always confirm to the reading user (regardless of privacy setting)
    socket.emit('message:read-confirmed', {
      conversationId: data.conversationId || null,
      messageIds: data.messageIds || null,
      updatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error handling message:read', {
      userId,
      error: error.message,
      stack: error.stack,
    });

    socket.emit('message:error', {
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Failed to mark messages as read',
    });
  }
}

/**
 * Register message event handlers for a socket
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerMessageHandlers(io, socket) {
  socket.on('message:send', data => handleMessageSend(io, socket, data));
  socket.on('message:edit', data => handleMessageEdit(io, socket, data));
  socket.on('message:delete', data => handleMessageDelete(io, socket, data));
  socket.on('message:delivered', data => handleMessageDelivered(io, socket, data));
  socket.on('message:read', data => handleMessageRead(io, socket, data));
  socket.on('conversation:join', data => handleConversationJoin(socket, data));
  socket.on('conversation:leave', data => handleConversationLeave(socket, data));
}

module.exports = {
  registerMessageHandlers,
  handleMessageSend,
  handleMessageEdit,
  handleMessageDelete,
  handleMessageDelivered,
  handleMessageRead,
  handleConversationJoin,
  handleConversationLeave,
  // Exported for testing
  validateMessageSend,
  validateMessageEdit,
  validateMessageDelete,
  ERROR_CODES,
};
