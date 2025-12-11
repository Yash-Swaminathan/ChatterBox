// Note: Validation middleware already ensures at least one field is provided
const User = require('../models/User');
const logger = require('../utils/logger');
const { getPaginationParams, createPaginationResponse } = require('../utils/pagination');

/**
 * User Controller
 * Handles user profile management endpoints
 */

/**
 * Get current authenticated user's profile
 * @route GET /api/users/me
 * @access Protected
 */
async function getCurrentUser(req, res) {
  try {
    // User ID comes from auth middleware (req.user)
    const userId = req.user?.userId;

    if (!userId) {
      logger.warn('getCurrentUser called without userId in req.user');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Fetch user from database
    const user = await User.getUserById(userId);

    if (!user) {
      logger.warn('User not found for getCurrentUser', { userId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('User profile retrieved successfully', { userId });

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error('Error in getCurrentUser', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve user profile',
      },
    });
  }
}

/**
 * Update current authenticated user's profile
 * @route PUT /api/users/me
 * @access Protected
 */
async function updateCurrentUser(req, res) {
  try {
    // User ID comes from auth middleware (req.user)
    const userId = req.user?.userId;

    if (!userId) {
      logger.warn('updateCurrentUser called without userId in req.user');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Extract allowed update fields from request body
    const { display_name, bio, status } = req.body;

    // Build updates object (only include provided fields)
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (status !== undefined) updates.status = status;

    // Update user profile
    const updatedUser = await User.updateUserProfile(userId, updates);

    if (!updatedUser) {
      logger.warn('User not found for update', { userId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('User profile updated successfully', {
      userId,
      updatedFields: Object.keys(updates),
    });

    return res.status(200).json({
      success: true,
      data: {
        user: updatedUser,
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    logger.error('Error in updateCurrentUser', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    // Check for specific database errors
    if (error.code === '23514') {
      // CHECK constraint violation (e.g., invalid status enum)
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VALUE',
          message: 'Invalid value for one or more fields',
          details: {
            hint: 'Check that status is one of: online, offline, away, busy',
          },
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user profile',
      },
    });
  }
}

/**
 * Search users by username or email
 * @route GET /api/users/search?q={query}&limit={n}&offset={n}
 * @access Protected
 */
async function searchUsers(req, res) {
  try {
    const { q: query } = req.query;

    // Validate query parameter
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search query (q) is required',
        },
      });
    }

    // Validate query length
    if (query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QUERY_TOO_SHORT',
          message: 'Query must be at least 2 characters',
        },
      });
    }

    // Get pagination parameters
    const { limit, offset } = getPaginationParams(req);

    // TODO: CACHING OPTIMIZATION (Future)
    // Consider caching search results in Redis for common queries:
    // const cacheKey = `search:${query}:${limit}:${offset}`;
    // TTL: 30-60 seconds (balance freshness vs performance)
    // This reduces DB load for repeated searches
    // Priority: Medium (implement when search load increases)

    // Search users
    const { users, total } = await User.searchUsers(query, limit, offset);

    // TODO: SEARCH ANALYTICS (Future Enhancement)
    // Track search queries for UX improvements and analytics:
    // - Most popular searches
    // - Searches with no results (to improve data or suggestions)
    // - User search patterns (for personalization)
    // Consider storing in separate analytics table or sending to analytics service
    // Priority: Low (nice-to-have for product insights)

    logger.info('User search completed', {
      query,
      resultsCount: users.length,
      total,
      requestedBy: req.user?.userId,
    });

    // Return paginated response
    const response = createPaginationResponse(total, limit, offset, users);

    return res.status(200).json({
      success: true,
      data: {
        users: response.data,
      },
      pagination: response.pagination,
    });
  } catch (error) {
    logger.error('Error in searchUsers', {
      query: req.query.q,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to search users',
      },
    });
  }
}

/**
 * Get public user profile by ID
 * @route GET /api/users/:userId
 * @access Protected (requires authentication but returns public data)
 */
async function getUserProfile(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'User ID is required',
        },
      });
    }

    // Validate UUID format
    if (!User.isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID_FORMAT',
          message: 'Invalid user ID format',
        },
      });
    }

    // Fetch public user profile
    const user = await User.getPublicUserById(userId);

    if (!user) {
      logger.info('User not found for public profile', { userId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('Public user profile retrieved successfully', {
      userId,
      requestedBy: req.user?.userId,
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error('Error in getUserProfile', {
      userId: req.params.userId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve user profile',
      },
    });
  }
}

/**
 * Update current user's status
 * @route PUT /api/users/me/status
 * @access Protected
 */
async function updateStatus(req, res) {
  try {
    // User ID comes from auth middleware (req.user)
    const userId = req.user?.userId;

    if (!userId) {
      logger.warn('updateStatus called without userId in req.user');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { status } = req.body;

    // Defense-in-depth: middleware should catch this, but verify to be safe
    // This redundant check protects against middleware bypass or misconfiguration
    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STATUS',
          message: 'Status is required',
        },
      });
    }

    // Update user status
    const result = await User.updateUserStatus(userId, status);

    if (!result) {
      logger.warn('User not found for status update', { userId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('User status updated successfully', {
      userId,
      status,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: result.status,
        last_seen: result.last_seen,
      },
      message: 'Status updated successfully',
    });
  } catch (error) {
    logger.error('Error in updateStatus', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    // Check if it's a validation error from the model
    if (error.message && error.message.includes('Status must be one of')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update status',
      },
    });
  }
}

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getUserProfile,
  searchUsers,
  updateStatus,
};
