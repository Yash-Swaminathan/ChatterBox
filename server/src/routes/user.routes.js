const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { validateProfileUpdate, validateStatusUpdate } = require('../middleware/validation');
const { uploadAvatar, handleUploadError, validateFileExists } = require('../middleware/upload');

// Rate limiters for user endpoints (disabled in test environment)
const isTest = process.env.NODE_ENV === 'test';

/**
 * Rate limiters for user endpoints
 */
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 updates per 15 minutes
  skip: () => isTest, // Skip rate limiting in tests
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many profile updates. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const profileViewLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  skip: () => isTest, // Skip rate limiting in tests
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const avatarUploadLimiter = rateLimit({
  windowMs: parseInt(process.env.AVATAR_UPLOAD_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.AVATAR_UPLOAD_MAX_REQUESTS || '10', 10), // 10 uploads per hour default
  skip: () => isTest, // Skip rate limiting in tests
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many avatar uploads. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * User Routes
 */

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user's profile
 * @access  Protected
 */
router.get('/me', requireAuth, profileViewLimiter, userController.getCurrentUser);

/**
 * @route   PUT /api/users/me
 * @desc    Update current authenticated user's profile
 * @access  Protected
 * @body    { display_name?, bio?, status? }
 */
router.put(
  '/me',
  requireAuth,
  profileUpdateLimiter,
  validateProfileUpdate,
  userController.updateCurrentUser
);

/**
 * @route   PUT /api/users/me/status
 * @desc    Update current authenticated user's status
 * @access  Protected
 * @body    { status: "online" | "away" | "busy" | "offline" }
 */
router.put(
  '/me/status',
  requireAuth,
  profileUpdateLimiter,
  validateStatusUpdate,
  userController.updateStatus
);

/**
 * @route   PUT /api/users/me/avatar
 * @desc    Upload avatar for current authenticated user
 * @access  Protected
 * @body    multipart/form-data { avatar: <file> }
 */
router.put(
  '/me/avatar',
  requireAuth,
  avatarUploadLimiter,
  uploadAvatar,
  handleUploadError,
  validateFileExists,
  userController.uploadAvatar
);

/**
 * @route   GET /api/users/search
 * @desc    Search users by username or email
 * @access  Protected
 * @query   q (search query), limit (optional), offset (optional)
 */
router.get('/search', requireAuth, profileViewLimiter, userController.searchUsers);

/**
 * @route   GET /api/users/:userId
 * @desc    Get public user profile by ID
 * @access  Protected
 */
router.get('/:userId', requireAuth, profileViewLimiter, userController.getUserProfile);

module.exports = router;
