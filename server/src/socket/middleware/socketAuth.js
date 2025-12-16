const { verifyAccessToken } = require('../../utils/jwt');
const logger = require('../../utils/logger');

/**
 * Extract JWT token from socket handshake
 * Tries multiple sources in order of preference
 * @param {Object} handshake - Socket.io handshake object
 * @returns {string|null} JWT token or null if not found
 */
function extractToken(handshake) {
  try {
    // Priority 1: auth.token (Socket.io client auth option)
    if (handshake.auth?.token && typeof handshake.auth.token === 'string') {
      return handshake.auth.token.trim();
    }

    // Priority 2: query.token (URL query parameter)
    if (handshake.query?.token && typeof handshake.query.token === 'string') {
      return handshake.query.token.trim();
    }

    // Priority 3: Authorization header (Bearer token)
    const authHeader = handshake.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1]) {
        const trimmedToken = match[1].trim();
        return trimmedToken || null; // Return null if empty after trim
      }
    }

    return null;
  } catch (error) {
    logger.error('Token extraction error', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Socket.io authentication middleware
 * Verifies JWT token and attaches user data to socket
 * @param {SocketIO.Socket} socket - Socket instance
 * @param {Function} next - Next middleware function
 */
function socketAuthMiddleware(socket, next) {
  try {
    // Extract token from handshake
    const token = extractToken(socket.handshake);

    if (!token) {
      logger.warn('Socket authentication failed: No token provided', {
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
      });
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      logger.warn('Socket authentication failed: Invalid token', {
        socketId: socket.id,
        error: error.message,
        remoteAddress: socket.handshake.address,
      });

      // Provide specific error messages based on message content
      if (error.message.includes('expired')) {
        return next(new Error('Token expired'));
      } else if (error.message.includes('Invalid')) {
        return next(new Error('Invalid token'));
      } else {
        return next(new Error('Authentication failed'));
      }
    }

    // Validate decoded token has required fields
    if (!decoded.userId || !decoded.username) {
      logger.warn('Socket authentication failed: Invalid token payload', {
        socketId: socket.id,
        decoded,
      });
      return next(new Error('Invalid token payload'));
    }

    // Attach user data to socket
    socket.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email || null,
    };

    logger.info('Socket authenticated successfully', {
      socketId: socket.id,
      userId: socket.user.userId,
      username: socket.user.username,
      remoteAddress: socket.handshake.address,
    });

    // Allow connection
    next();
  } catch (error) {
    logger.error('Socket authentication error', {
      socketId: socket.id,
      error: error.message,
      stack: error.stack,
    });
    next(new Error('Authentication error'));
  }
}

module.exports = socketAuthMiddleware;
module.exports.extractToken = extractToken; // Export for testing
