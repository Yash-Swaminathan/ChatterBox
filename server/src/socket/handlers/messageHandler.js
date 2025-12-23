const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const logger = require('../../utils/logger');
const { isValidUUID } = require('../../utils/validators');

const RATE_LIMIT = {
  MESSAGES_PER_WINDOW: 30, // Max messages per window
  WINDOW_SIZE_MS: 60000, // 1 minute window
  BURST_LIMIT: 5, // Max rapid-fire messages
  BURST_WINDOW_MS: 1000, // 1 second burst window
  PENALTY_DURATION_MS: 30000, // 30 second penalty for exceeding limit
  CLEANUP_INTERVAL_MS: 3600000, // Cleanup old entries every hour
  MAX_ENTRIES: 10000, // Maximum rate limiter entries to prevent memory exhaustion
};

// In-memory rate limiter (TODO: Move to Redis for horizontal scaling)
const rateLimiter = new Map();

// Cleanup interval reference for lifecycle control
let cleanupIntervalId = null;

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
 * Perform cleanup of stale rate limit entries
 */
function performRateLimitCleanup() {
  const now = Date.now();
  for (const [userId, entry] of rateLimiter.entries()) {
    // Remove entries where window has expired and no penalty active
    if (
      now - entry.windowStart > RATE_LIMIT.WINDOW_SIZE_MS &&
      (!entry.penaltyUntil || now > entry.penaltyUntil)
    ) {
      rateLimiter.delete(userId);
    }
  }
  logger.debug('Rate limiter cleanup', { remainingEntries: rateLimiter.size });
}

/**
 * Start the periodic cleanup interval for rate limiter
 * Call this when initializing the socket server
 */
function startCleanup() {
  if (cleanupIntervalId) {
    return; // Already running
  }
  cleanupIntervalId = setInterval(performRateLimitCleanup, RATE_LIMIT.CLEANUP_INTERVAL_MS);
  logger.info('Rate limiter cleanup started');
}

/**
 * Stop the periodic cleanup interval
 * Call this during graceful shutdown or in tests
 */
function stopCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Rate limiter cleanup stopped');
  }
}

/**
 * Clear all rate limiter entries (useful for testing)
 */
function clearRateLimiter() {
  rateLimiter.clear();
}

// Auto-start cleanup on module load (can be stopped with stopCleanup())
startCleanup();

/**
 * Create a new rate limit entry for a user
 * @param {number} now - Current timestamp
 * @returns {Object} New rate limit entry
 */
function createRateLimitEntry(now) {
  return {
    count: 0,
    windowStart: now,
    burstCount: 0,
    burstStart: now,
    penaltyUntil: null,
  };
}

/**
 * Check if user is rate limited
 * @param {string} userId - User ID to check
 * @returns {{allowed: boolean, retryAfter?: number}} Rate limit result
 */
function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimiter.get(userId);

  if (!entry) {
    // Check max entries to prevent memory exhaustion
    if (rateLimiter.size >= RATE_LIMIT.MAX_ENTRIES) {
      // Force cleanup before adding new entry
      performRateLimitCleanup();

      // If still at max, reject new users temporarily
      if (rateLimiter.size >= RATE_LIMIT.MAX_ENTRIES) {
        logger.warn('Rate limiter at max capacity', { size: rateLimiter.size });
        return { allowed: false, retryAfter: 5000 };
      }
    }
    entry = createRateLimitEntry(now);
    rateLimiter.set(userId, entry);
  }

  // Check if user is in penalty
  if (entry.penaltyUntil && now < entry.penaltyUntil) {
    return { allowed: false, retryAfter: entry.penaltyUntil - now };
  }

  // Reset window if expired
  if (now - entry.windowStart > RATE_LIMIT.WINDOW_SIZE_MS) {
    entry.windowStart = now;
    entry.count = 0;
    entry.penaltyUntil = null;
  }

  // Reset burst window if expired
  if (now - entry.burstStart > RATE_LIMIT.BURST_WINDOW_MS) {
    entry.burstStart = now;
    entry.burstCount = 0;
  }

  // Check window limit
  if (entry.count >= RATE_LIMIT.MESSAGES_PER_WINDOW) {
    entry.penaltyUntil = now + RATE_LIMIT.PENALTY_DURATION_MS;
    logger.warn('User rate limited (window exceeded)', {
      userId,
      count: entry.count,
      penalty: RATE_LIMIT.PENALTY_DURATION_MS,
    });
    return { allowed: false, retryAfter: RATE_LIMIT.PENALTY_DURATION_MS };
  }

  // Check burst limit
  if (entry.burstCount >= RATE_LIMIT.BURST_LIMIT) {
    const retryAfter = RATE_LIMIT.BURST_WINDOW_MS - (now - entry.burstStart);
    return { allowed: false, retryAfter };
  }

  // Increment counters
  entry.count++;
  entry.burstCount++;
  rateLimiter.set(userId, entry);

  return { allowed: true };
}

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

    // Broadcast edit to all participants
    const roomName = `conversation:${conversationId}`;
    io.to(roomName).emit('message:edited', {
      messageId: updatedMessage.id,
      conversationId,
      content: updatedMessage.content,
      updatedAt: updatedMessage.updated_at,
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

    // Broadcast deletion to all participants
    const roomName = `conversation:${conversationId}`;
    io.to(roomName).emit('message:deleted', {
      messageId,
      conversationId,
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
 * Register message event handlers for a socket
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerMessageHandlers(io, socket) {
  socket.on('message:send', data => handleMessageSend(io, socket, data));
  socket.on('message:edit', data => handleMessageEdit(io, socket, data));
  socket.on('message:delete', data => handleMessageDelete(io, socket, data));
  socket.on('conversation:join', data => handleConversationJoin(socket, data));
  socket.on('conversation:leave', data => handleConversationLeave(socket, data));
}

module.exports = {
  registerMessageHandlers,
  handleMessageSend,
  handleMessageEdit,
  handleMessageDelete,
  handleConversationJoin,
  handleConversationLeave,
  // Lifecycle control for rate limiter cleanup
  startCleanup,
  stopCleanup,
  clearRateLimiter,
  // Exported for testing
  checkRateLimit,
  validateMessageSend,
  validateMessageEdit,
  validateMessageDelete,
  ERROR_CODES,
  RATE_LIMIT,
};
