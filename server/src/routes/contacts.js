const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { requireAuth } = require('../middleware/auth');
const {
  validateAddContact,
  validateUpdateContact,
  validateGetContacts,
  validateUUID,
} = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Set SKIP_RATE_LIMIT=true in test environment to bypass rate limiting
const shouldSkipRateLimit = process.env.SKIP_RATE_LIMIT === 'true';

// Rate limiter 
const addContactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes
  skip: () => shouldSkipRateLimit,
  message: 'Too many contact additions, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const listContactsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 120, 
  skip: () => shouldSkipRateLimit,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(requireAuth);

// POST /api/contacts - Add contact
router.post('/', addContactLimiter, validateAddContact, contactController.addContact);

// GET /api/contacts - List contacts with pagination
router.get('/', listContactsLimiter, validateGetContacts, contactController.listContacts);

// GET /api/contacts/exists/:userId - Check if contact exists
router.get('/exists/:userId', validateUUID('userId'), contactController.checkContactExists);

// PUT /api/contacts/:contactId - Update contact (nickname, favorite)
router.put(
  '/:contactId',
  validateUUID('contactId'),
  validateUpdateContact,
  contactController.updateContact
);

// DELETE /api/contacts/:contactId - Remove contact
router.delete('/:contactId', validateUUID('contactId'), contactController.removeContact);

module.exports = router;
