const express = require('express');
const router = express.Router();
const contactRequestController = require('../controllers/contactRequestController');
const { requireAuth } = require('../middleware/auth');
const {
  validateSendContactRequest,
  validateListContactRequests,
  validateUUID,
} = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Set SKIP_RATE_LIMIT=true in test environment to bypass rate limiting
const shouldSkipRateLimit = process.env.SKIP_RATE_LIMIT === 'true';

// Every attempt counts, including ones for usernames that do not exist,
// which also keeps this from being used to guess usernames in bulk
const sendRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: 10, // 10 requests per day per user
  keyGenerator: req => `contact-request:${req.user.userId}`,
  skip: () => shouldSkipRateLimit,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'You can send 10 requests per day. Please try again tomorrow',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactRequestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  skip: () => shouldSkipRateLimit,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(requireAuth);

// POST /api/contact-requests - Send a request to an exact username
router.post(
  '/',
  validateSendContactRequest,
  sendRequestLimiter,
  contactRequestController.sendRequest
);

// GET /api/contact-requests?type=received|sent - List pending requests
router.get(
  '/',
  contactRequestLimiter,
  validateListContactRequests,
  contactRequestController.listRequests
);

// PUT /api/contact-requests/:requestId/accept
router.put(
  '/:requestId/accept',
  contactRequestLimiter,
  validateUUID('requestId'),
  contactRequestController.acceptRequest
);

// PUT /api/contact-requests/:requestId/reject
router.put(
  '/:requestId/reject',
  contactRequestLimiter,
  validateUUID('requestId'),
  contactRequestController.rejectRequest
);

module.exports = router;
