const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { validateProfileUpdate } = require('../middleware/validation');

/**
 * Rate limiters for user endpoints
 */
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 updates per 15 minutes
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
 * @route   GET /api/users/:userId
 * @desc    Get public user profile by ID
 * @access  Protected
 */
router.get('/:userId', requireAuth, profileViewLimiter, userController.getUserProfile);

module.exports = router;
