const presenceService = require('../../services/presenceService');
const logger = require('../../utils/logger');

// TODO: Future Enhancement - Add "Do Not Disturb" mode
// Automatically suppress all presence broadcasts when enabled
// Priority: Medium (useful feature for users)

// TODO: Performance Optimization - Use Redis for rate limiting instead of in-memory Map
// Current approach won't work across multiple server instances
// Use Redis SET with TTL for distributed rate limiting
// Priority: High (required for horizontal scaling)

// TODO: Future Enhancement - Add presence event webhooks
// Allow external services to subscribe to presence changes
// Useful for integrations (Slack, Discord, etc.)
// Priority: Low (advanced feature)

const RATE_LIMIT_WINDOW = 5000;
const rateLimitMap = new Map();

/**
 * Handle presence:update event (custom status changes)
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 * @param {Object} data - Event data
 * @param {string} data.status - New status (online, away, busy)
 */
async function handlePresenceUpdate(io, socket, data) {
  try {
    const { userId } = socket.user;
    const { status } = data;

    if (!status) {
      socket.emit('error', { message: 'Status is required' });
      return;
    }

    if (!presenceService.VALID_STATUSES.includes(status)) {
      socket.emit('error', {
        message: `Invalid status. Must be one of: ${presenceService.VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    if (status === 'offline') {
      socket.emit('error', {
        message: 'Cannot manually set status to offline. Disconnect instead.',
      });
      return;
    }

    const now = Date.now();
    const lastUpdate = rateLimitMap.get(userId) || 0;

    if (now - lastUpdate < RATE_LIMIT_WINDOW) {
      socket.emit('error', {
        message: 'Rate limit exceeded. Please wait before updating status again.',
      });
      return;
    }

    rateLimitMap.set(userId, now);

    const updatedPresence = await presenceService.updateUserStatus(userId, status);

    if (!updatedPresence) {
      socket.emit('error', { message: 'Failed to update status' });
      return;
    }

    socket.emit('presence:updated', {
      userId,
      status: updatedPresence.status,
      timestamp: updatedPresence.timestamp,
    });

    await broadcastPresenceChange(io, userId, updatedPresence);

    logger.info('Presence updated', { userId, status });
  } catch (error) {
    logger.error('Error handling presence update', {
      userId: socket.user?.userId,
      error: error.message,
    });
    socket.emit('error', { message: 'Failed to update presence' });
  }
}

/**
 * Handle heartbeat event (keep-alive)
 * @param {Object} socket - Socket instance
 */
async function handleHeartbeat(socket) {
  try {
    const { userId } = socket.user;
    const socketId = socket.id;

    const success = await presenceService.refreshHeartbeat(userId, socketId);

    if (success) {
      logger.debug('Heartbeat received', { userId, socketId });
    } else {
      logger.warn('Heartbeat failed for non-existent socket', {
        userId,
        socketId,
      });
    }
  } catch (error) {
    logger.error('Error handling heartbeat', {
      userId: socket.user?.userId,
      error: error.message,
    });
  }
}

/**
 * Broadcast presence change to user's contacts
 * @param {Object} io - Socket.io server instance
 * @param {string} userId - User ID whose presence changed
 * @param {Object} presence - Presence data
 */
async function broadcastPresenceChange(io, userId, presence) {
  try {
    const contacts = await presenceService.getUserContacts(userId);

    if (contacts.length === 0) {
      logger.debug('No contacts to broadcast presence to', { userId });
      return;
    }

    const presenceData = {
      userId,
      status: presence.status,
      timestamp: presence.timestamp,
    };

    contacts.forEach(contactId => {
      io.to(`user:${contactId}`).emit('presence:changed', presenceData);
    });

    logger.debug('Presence broadcast to contacts', {
      userId,
      contactCount: contacts.length,
    });
  } catch (error) {
    logger.error('Error broadcasting presence change', {
      userId,
      error: error.message,
    });
  }
}

/**
 * Send initial presence data to newly connected socket
 * @param {Object} socket - Socket instance
 */
async function sendInitialPresence(socket) {
  try {
    const { userId } = socket.user;

    const contacts = await presenceService.getUserContacts(userId);

    if (contacts.length === 0) {
      socket.emit('presence:bulk', { presences: {} });
      return;
    }

    const presences = await presenceService.getBulkPresence(contacts);

    const activePresences = {};
    Object.entries(presences).forEach(([contactId, presence]) => {
      if (presence && presence.status !== 'offline') {
        activePresences[contactId] = {
          status: presence.status,
          timestamp: presence.timestamp,
        };
      }
    });

    socket.emit('presence:bulk', { presences: activePresences });

    logger.debug('Initial presence data sent', {
      userId,
      onlineContacts: Object.keys(activePresences).length,
    });
  } catch (error) {
    logger.error('Error sending initial presence', {
      userId: socket.user?.userId,
      error: error.message,
    });
  }
}

/**
 * Register presence event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerPresenceHandlers(io, socket) {
  socket.on('presence:update', data => handlePresenceUpdate(io, socket, data));
  socket.on('heartbeat', () => handleHeartbeat(socket));
}

/**
 * Start periodic cleanup job
 * @param {number} intervalMs - Cleanup interval in milliseconds
 * @returns {NodeJS.Timeout} Interval ID
 */
function startCleanupJob(intervalMs = 300000) {
  return setInterval(async () => {
    try {
      const cleaned = await presenceService.cleanupStaleConnections();
      if (cleaned > 0) {
        logger.info('Periodic presence cleanup completed', { cleaned });
      }
    } catch (error) {
      logger.error('Error in periodic cleanup', { error: error.message });
    }
  }, intervalMs);
}

module.exports = {
  registerPresenceHandlers,
  handlePresenceUpdate,
  handleHeartbeat,
  broadcastPresenceChange,
  sendInitialPresence,
  startCleanupJob,
};
