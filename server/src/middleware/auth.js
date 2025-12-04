const { verifyAccessToken } = require('../utils/jwt');

/**
 * @typedef {import('../types/auth.types').DecodedToken} DecodedToken
 */

/**
 * Middleware to protect routes - requires valid JWT access token
 * Adds user data to request object if token is valid
 *
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function (callback)
 */
function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    // Extract token
    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user data to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: error.message || 'Invalid or expired token',
      },
    });
  }
}

module.exports = {
  requireAuth,
};
