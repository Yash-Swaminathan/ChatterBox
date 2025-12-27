const Contact = require('../models/Contact');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Add a new contact
 * POST /api/contacts
 * Body: { userId: string, nickname?: string }
 */
async function addContact(req, res) {
  try {
    const { userId: contactUserId, nickname } = req.body;
    const currentUserId = req.user.userId;

    // Validate user is not trying to add themselves
    if (contactUserId === currentUserId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot add yourself as a contact',
      });
    }

    // Verify target user exists
    const targetUser = await User.findById(contactUserId);
    if (!targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Create contact (idempotent - returns existing if already exists)
    const contact = await Contact.create(currentUserId, contactUserId, nickname);

    if (!contact) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create contact',
      });
    }

    // Fetch full contact details with user information
    const fullContact = await Contact.getContactDetails(contact.id);

    logger.info('Contact added', {
      contactId: contact.id,
      userId: currentUserId,
      contactUserId,
      created: contact.created,
    });

    // Return 201 if newly created, 200 if already existed
    return res.status(contact.created ? 201 : 200).json({
      success: true,
      data: {
        contact: fullContact,
        created: contact.created,
      },
    });
  } catch (error) {
    logger.error('Error in addContact', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      contactUserId: req.body?.userId,
    });

    // Handle specific errors
    if (error.message.includes('Cannot add yourself')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to add contact',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * Remove a contact
 * DELETE /api/contacts/:contactId
 */
async function removeContact(req, res) {
  try {
    const { contactId } = req.params;
    const currentUserId = req.user.userId;

    // Verify contact exists and belongs to current user
    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Contact not found',
      });
    }

    // Verify ownership
    if (contact.userId !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to remove this contact',
      });
    }

    // Delete the contact
    const deleted = await Contact.deleteContact(contactId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Contact not found',
      });
    }

    logger.info('Contact removed', {
      contactId,
      userId: currentUserId,
    });

    return res.json({
      success: true,
      message: 'Contact removed successfully',
    });
  } catch (error) {
    logger.error('Error in removeContact', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      contactId: req.params?.contactId,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to remove contact',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * List user's contacts with pagination
 * GET /api/contacts?limit=50&offset=0&includeBlocked=false
 */
async function listContacts(req, res) {
  try {
    const userId = req.user.userId;

    // Parse query parameters (middleware already validated)
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const includeBlocked = req.query.includeBlocked === 'true';

    // Fetch user's contacts from database
    const contacts = await Contact.findByUser(userId, limit, offset, includeBlocked);
    const total = await Contact.countByUser(userId, includeBlocked);

    logger.info('Contacts retrieved', {
      userId,
      count: contacts.length,
      total,
      limit,
      offset,
      includeBlocked,
    });

    return res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + contacts.length < total,
        },
      },
    });
  } catch (error) {
    logger.error('Error in listContacts', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      query: req.query,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to retrieve contacts',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * Check if a user is already a contact
 * GET /api/contacts/exists/:userId
 */
async function checkContactExists(req, res) {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user.userId;

    // Check if contact relationship exists
    const exists = await Contact.isContact(currentUserId, targetUserId);

    // If exists, get the contact ID
    let contactId = null;
    if (exists) {
      const contacts = await Contact.findByUser(currentUserId, 200, 0, true);
      const contact = contacts.find(c => c.contactUserId === targetUserId);
      contactId = contact ? contact.id : null;
    }

    logger.info('Contact existence checked', {
      userId: currentUserId,
      targetUserId,
      exists,
    });

    return res.json({
      success: true,
      data: {
        exists,
        contactId,
      },
    });
  } catch (error) {
    logger.error('Error in checkContactExists', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      targetUserId: req.params?.userId,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to check contact status',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

/**
 * Update contact details (nickname, favorite status)
 * PUT /api/contacts/:contactId
 * Body: { nickname?: string, isFavorite?: boolean }
 */
async function updateContact(req, res) {
  try {
    const { contactId } = req.params;
    const { nickname, isFavorite } = req.body;
    const currentUserId = req.user.userId;

    // Verify contact exists and belongs to current user
    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Contact not found',
      });
    }

    // Verify ownership
    if (contact.userId !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this contact',
      });
    }

    // Update nickname if provided
    if (nickname !== undefined) {
      const updated = await Contact.updateNickname(contactId, nickname);
      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Contact not found',
        });
      }
    }

    // Toggle favorite if provided
    if (isFavorite !== undefined && isFavorite !== contact.isFavorite) {
      const updated = await Contact.toggleFavorite(contactId);
      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Contact not found',
        });
      }
    }

    // Fetch updated contact details
    const updatedContact = await Contact.getContactDetails(contactId);

    logger.info('Contact updated', {
      contactId,
      userId: currentUserId,
      nickname,
      isFavorite,
    });

    return res.json({
      success: true,
      data: {
        contact: updatedContact,
      },
    });
  } catch (error) {
    logger.error('Error in updateContact', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      contactId: req.params?.contactId,
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'Failed to update contact',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.code = error.code;
    }

    return res.status(500).json(errorResponse);
  }
}

module.exports = {
  addContact,
  removeContact,
  listContacts,
  checkContactExists,
  updateContact,
};
