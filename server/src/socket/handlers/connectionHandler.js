const logger = require('../../utils/logger');

// TODO: Week 3, Day 3-4 - Verify JWT and attach user to socket
// TODO: Week 3, Day 5-7 - Update user status to 'online' on connect
// TODO: Week 3, Day 5-7 - Update user status to 'offline' on disconnect
// TODO: Future - Implement connection rate limiting per IP
// TODO: Future - Track connection metrics (duration, transport type)

// Track user connections (userId -> Set of socket IDs)
// Allows handling multiple connections per user (multiple tabs/devices)
const userSockets = new Map();

// Stale connection cleanup interval
const STALE_THRESHOLD = 3600000; // 1 hour
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Track connection metrics
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalDisconnections: 0,
  byTransport: {
    websocket: 0,
    polling: 0,
  },
};

/**
 * Initialize connection handlers for Socket.io
 * @param {SocketIO.Server} io - Socket.io server instance
 */
function connectionHandler(io) {
  io.on('connection', socket => {
    handleConnection(socket);
    setupEventHandlers(socket, io);
  });

  // Start stale connection cleanup
  startStaleConnectionCleanup(io);

  // Graceful shutdown handler
  setupGracefulShutdown(io);

  logger.info('Connection handler initialized');
}

/**
 * Handle new client connection
 * @param {SocketIO.Socket} socket - Client socket instance
 */
function handleConnection(socket) {
  const connectedAt = Date.now();
  socket.connectedAt = connectedAt;

  // Update metrics
  connectionMetrics.totalConnections++;
  connectionMetrics.activeConnections++;
  const transport = socket.conn.transport.name;
  if (connectionMetrics.byTransport[transport] !== undefined) {
    connectionMetrics.byTransport[transport]++;
  }

  // Get authenticated user data
  const { userId, username } = socket.user;

  // Join user-specific room for direct messaging and notifications
  socket.join(`user:${userId}`);

  // Track user connection (supports multi-device)
  trackUserConnection(userId, socket.id);

  // Log connection details
  logger.info('Authenticated user connected', {
    socketId: socket.id,
    userId,
    username,
    userRoom: `user:${userId}`,
    transport: transport,
    remoteAddress: socket.handshake.address,
    timestamp: new Date(connectedAt).toISOString(),
    activeConnections: connectionMetrics.activeConnections,
    totalUserConnections: getUserSockets(userId).size,
  });

  // Notify user of successful authentication
  socket.emit('auth:success', {
    userId,
    username,
    connectedAt: new Date(connectedAt).toISOString(),
  });

  // Handle transport upgrade (polling -> websocket)
  socket.conn.on('upgrade', transport => {
    logger.info('Transport upgraded', {
      socketId: socket.id,
      userId,
      from: socket.conn.transport.name,
      to: transport.name,
    });
  });
}

/**
 * Set up event handlers for socket
 * @param {SocketIO.Socket} socket - Client socket instance
 * @param {SocketIO.Server} _io - Socket.io server instance (unused)
 */
function setupEventHandlers(socket, _io) {
  // Handle disconnection
  socket.on('disconnect', reason => {
    handleDisconnection(socket, reason);
  });

  // Handle connection errors
  socket.on('error', error => {
    handleError(socket, error);
  });

  // Handle reconnection attempts
  socket.on('reconnect_attempt', attemptNumber => {
    logger.info('Client reconnecting', {
      socketId: socket.id,
      attemptNumber,
    });
  });

  // Ping/pong for connection health monitoring
  socket.on('ping', () => {
    logger.debug('Ping received', { socketId: socket.id });
  });
}

/**
 * Handle client disconnection
 * @param {SocketIO.Socket} socket - Client socket instance
 * @param {string} reason - Disconnection reason
 */
function handleDisconnection(socket, reason) {
  const connectionDuration = Date.now() - socket.connectedAt;

  // Update metrics
  connectionMetrics.totalDisconnections++;
  connectionMetrics.activeConnections--;

  // Get authenticated user data
  const { userId, username } = socket.user;

  // Remove user connection
  removeUserConnection(userId, socket.id);

  // Log disconnection
  logger.info('Authenticated user disconnected', {
    socketId: socket.id,
    userId,
    username,
    reason: reason,
    duration: `${(connectionDuration / 1000).toFixed(2)}s`,
    timestamp: new Date().toISOString(),
    activeConnections: connectionMetrics.activeConnections,
    totalUserConnections: getUserSockets(userId).size,
  });

  // Cleanup socket-specific resources
  socket.removeAllListeners();
}

/**
 * Handle socket errors
 * @param {SocketIO.Socket} socket - Client socket instance
 * @param {Error} error - Error object
 */
function handleError(socket, error) {
  logger.error('Socket error', {
    socketId: socket.id,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (error.message && error.message.includes('payload')) {
    logger.warn('Oversized payload rejected, disconnecting client', {
      socketId: socket.id,
    });
    socket.disconnect(true);
  }
}

/**
 * Track user connection (for multiple devices/tabs)
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function trackUserConnection(userId, socketId) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socketId);

  logger.info('User connection tracked', {
    userId,
    socketId,
    totalUserConnections: userSockets.get(userId).size,
  });
}

/**
 * Remove user connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function removeUserConnection(userId, socketId) {
  if (userSockets.has(userId)) {
    userSockets.get(userId).delete(socketId);

    // Remove user entry if no more connections
    if (userSockets.get(userId).size === 0) {
      userSockets.delete(userId);
      logger.info('User fully disconnected', { userId });
    } else {
      logger.info('User connection removed', {
        userId,
        socketId,
        remainingConnections: userSockets.get(userId).size,
      });
    }
  }
}

/**
 * Get all socket IDs for a user
 * @param {string} userId - User ID
 * @returns {Set<string>} Set of socket IDs
 */
function getUserSockets(userId) {
  return userSockets.get(userId) || new Set();
}

/**
 * Start periodic cleanup of stale connections
 * Removes socket IDs that no longer exist in the server
 * @param {SocketIO.Server} io - Socket.io server instance
 */
function startStaleConnectionCleanup(io) {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedConnections = 0;
    let cleanedUsers = 0;

    userSockets.forEach((socketIds, userId) => {
      socketIds.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);

        // Remove if socket doesn't exist or is stale
        if (!socket || (socket.connectedAt && now - socket.connectedAt > STALE_THRESHOLD)) {
          logger.warn('Removing stale socket', {
            userId,
            socketId,
            exists: !!socket,
            age: socket ? `${((now - socket.connectedAt) / 1000 / 60).toFixed(1)}min` : 'N/A',
          });
          socketIds.delete(socketId);
          cleanedConnections++;
        }
      });

      // Remove user entry if no more connections
      if (socketIds.size === 0) {
        userSockets.delete(userId);
        cleanedUsers++;
      }
    });

    if (cleanedConnections > 0 || cleanedUsers > 0) {
      logger.info('Stale connection cleanup completed', {
        cleanedConnections,
        cleanedUsers,
        remainingUsers: userSockets.size,
        totalSockets: Array.from(userSockets.values()).reduce(
          (acc, set) => acc + set.size,
          0
        ),
      });
    }
  }, CLEANUP_INTERVAL);

  // Use unref() to allow process to exit even if interval is active (important for tests)
  cleanupInterval.unref();

  // Clear interval on shutdown
  const clearCleanup = () => clearInterval(cleanupInterval);
  process.on('SIGTERM', clearCleanup);
  process.on('SIGINT', clearCleanup);

  logger.info('Stale connection cleanup started', {
    interval: `${CLEANUP_INTERVAL / 1000}s`,
    threshold: `${STALE_THRESHOLD / 1000 / 60}min`,
  });
}

/**
 * Set up graceful shutdown handler
 * @param {SocketIO.Server} io - Socket.io server instance
 */
function setupGracefulShutdown(io) {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, notifying clients of server shutdown');

    // Notify all connected clients
    io.emit('server:shutdown', {
      message: 'Server is restarting, please reconnect in a moment',
      timestamp: new Date().toISOString(),
    });

    // Give clients 1 second to receive the message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Close all connections
    io.close(() => {
      logger.info('Socket.io server closed gracefully');
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing Socket.io server');

    io.close(() => {
      logger.info('Socket.io server closed');
      process.exit(0);
    });
  });
}

/**
 * Get current connection metrics
 * @returns {object} Connection metrics
 */
function getConnectionMetrics() {
  return {
    ...connectionMetrics,
    uniqueUsers: userSockets.size,
  };
}

/**
 * Disconnect all sockets for a specific user
 * Useful for account deletion, security incidents, or forced logout.
 * Sends a 'force:disconnect' event to all user's devices before disconnecting.
 *
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {string} userId - User ID to disconnect
 * @param {string} [reason='forced_disconnect'] - Reason for disconnection (e.g., 'account_deleted', 'security_incident', 'admin_action')
 * @returns {number} Number of sockets disconnected (0 if user has no active connections)
 *
 * @example
 * // Disconnect user after account deletion
 * const count = disconnectUser(io, 'user-123', 'account_deleted');
 * console.log(`Disconnected ${count} devices`);
 *
 * @example
 * // Force logout for security incident
 * disconnectUser(io, 'compromised-user-id', 'security_incident');
 */
function disconnectUser(io, userId, reason = 'forced_disconnect') {
  const socketIds = getUserSockets(userId);

  if (socketIds.size === 0) {
    logger.warn('No active connections found for user', { userId });
    return 0;
  }

  let disconnectedCount = 0;

  socketIds.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      // Notify client before disconnecting
      socket.emit('force:disconnect', {
        reason,
        timestamp: new Date().toISOString(),
      });

      // Disconnect socket
      socket.disconnect(true);
      disconnectedCount++;
    }
  });

  logger.info('User forcefully disconnected', {
    userId,
    reason,
    socketsDisconnected: disconnectedCount,
  });

  return disconnectedCount;
}

module.exports = connectionHandler;
module.exports.getUserSockets = getUserSockets;
module.exports.getConnectionMetrics = getConnectionMetrics;
module.exports.disconnectUser = disconnectUser;
