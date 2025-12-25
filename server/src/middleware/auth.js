const { verifyAccessToken } = require('../utils/jwt');

/**
 * @typedef {import('../types/auth.types').DecodedToken} DecodedToken
 */

/**
 * Middleware to protect routes - requires valid JWT access token
 * Adds user data to request object if token is valid
 */
function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    // Extract token (split by space and take second part)
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user data to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    // Differentiate between expired and invalid tokens
    const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    const message =
      error.name === 'TokenExpiredError' ? 'Token has expired' : error.message || 'Invalid token';

    return res.status(401).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}

module.exports = {
  requireAuth,
};
