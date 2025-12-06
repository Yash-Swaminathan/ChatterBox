const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');

// Rate limiters for authentication endpoints (disabled in test environment)
const isTest = process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skip: () => isTest, // Skip rate limiting in tests
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  skip: () => isTest, // Skip rate limiting in tests
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerLimiter, validateRegistration, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;