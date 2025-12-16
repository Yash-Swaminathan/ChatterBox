const logger = require('../../utils/logger');

// TODO: Week 3, Day 3-4 - Verify JWT and attach user to socket
// TODO: Week 3, Day 5-7 - Update user status to 'online' on connect
// TODO: Week 3, Day 5-7 - Update user status to 'offline' on disconnect
// TODO: Future - Implement connection rate limiting per IP
// TODO: Future - Track connection metrics (duration, transport type)

// Track user connections (userId -> Set of socket IDs)
// Allows handling multiple connections per user (multiple tabs/devices)
// TODO: Week 3, Day 3-4 - Implement cleanup for userSockets Map to prevent memory leaks
// TODO: Consider adding TTL or periodic cleanup for stale connections
// TODO: Add monitoring for userSockets Map size in production
const userSockets = new Map();

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

  // Log connection details
  logger.info('Client connected', {
    socketId: socket.id,
    transport: transport,
    remoteAddress: socket.handshake.address,
    timestamp: new Date(connectedAt).toISOString(),
    activeConnections: connectionMetrics.activeConnections,
  });

  // TODO: Week 3, Day 3-4 - After JWT auth is implemented:
  // const userId = socket.user?.userId;
  // if (userId) {
  //   trackUserConnection(userId, socket.id);
  // }

  // Handle transport upgrade (polling -> websocket)
  socket.conn.on('upgrade', transport => {
    logger.info('Transport upgraded', {
      socketId: socket.id,
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

  // Log disconnection
  logger.info('Client disconnected', {
    socketId: socket.id,
    reason: reason,
    duration: `${(connectionDuration / 1000).toFixed(2)}s`,
    timestamp: new Date().toISOString(),
    activeConnections: connectionMetrics.activeConnections,
  });

  // TODO: Week 3, Day 3-4 - After JWT auth is implemented:
  // const userId = socket.user?.userId;
  // if (userId) {
  //   removeUserConnection(userId, socket.id);
  // }

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
 * TODO: Week 3, Day 3-4 - Use this function after authentication is implemented
 */
// eslint-disable-next-line no-unused-vars
function _trackUserConnection(userId, socketId) {
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
 * TODO: Week 3, Day 3-4 - Use this function after authentication is implemented
 */
// eslint-disable-next-line no-unused-vars
function _removeUserConnection(userId, socketId) {
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

module.exports = connectionHandler;
module.exports.getUserSockets = getUserSockets;
module.exports.getConnectionMetrics = getConnectionMetrics;
