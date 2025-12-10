const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { validateProfileUpdate } = require('../middleware/validation');

/**
 * User Routes
 */

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user's profile
 * @access  Protected
 */
router.get('/me', requireAuth, userController.getCurrentUser);

/**
 * @route   PUT /api/users/me
 * @desc    Update current authenticated user's profile
 * @access  Protected
 * @body    { display_name?, bio?, status? }
 */
router.put('/me', requireAuth, validateProfileUpdate, userController.updateCurrentUser);

/**
 * @route   GET /api/users/:userId
 * @desc    Get public user profile by ID
 * @access  Protected
 */
router.get('/:userId', requireAuth, userController.getUserProfile);

module.exports = router;
