const User = require('../models/User');
const logger = require('../utils/logger');

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

    // Check if any valid fields were provided
    if (Object.keys(updates).length === 0) {
      logger.info('No valid fields provided for update', { userId });
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATE_FIELDS',
          message: 'No valid fields provided for update',
          details: {
            allowedFields: ['display_name', 'bio', 'status'],
          },
        },
      });
    }

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

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getUserProfile,
};
