const ContactRequest = require('../models/ContactRequest');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { isOwner } = require('../services/ownerService');
const { joinUsersToConversation } = require('../socket/conversationRooms');
const logger = require('../utils/logger');

function serverError(res, message) {
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}

function emitToUser(io, userId, event, payload) {
  if (!io) {
    return;
  }
  try {
    io.to(`user:${userId}`).emit(event, payload);
  } catch (error) {
    logger.error('Failed to emit contact request event', { event, userId, error: error.message });
  }
}

/**
 * Open the direct conversation for a newly accepted request and tell the sender
 * @param {Object} io - Socket.io server instance (may be undefined in REST-only tests)
 * @param {Object} request - Accepted contact_requests row
 * @returns {Promise<string>} The conversation ID
 */
async function openConversation(io, request) {
  const { conversation, created } = await Conversation.getOrCreateDirect(
    request.sender_id,
    request.recipient_id
  );

  if (created) {
    joinUsersToConversation(io, conversation.id, [request.sender_id, request.recipient_id]);
  }

  emitToUser(io, request.sender_id, 'contact-request:accepted', {
    requestId: request.id,
    conversationId: conversation.id,
  });

  return conversation.id;
}

/**
 * Send a connection request to an exact username
 * POST /api/contact-requests
 *
 * The response is the same whether or not the username exists, and whatever the
 * state of any earlier request, so it cannot be used to look people up.
 */
async function sendRequest(req, res) {
  const senderId = req.user.userId;
  const { username } = req.body;

  try {
    const target = await User.getUserByUsername(username);

    if (target && target.id === senderId) {
      return res.status(400).json({
        success: false,
        error: { code: 'CANNOT_REQUEST_SELF', message: 'You cannot send a request to yourself' },
      });
    }

    // Everyone is already connected to the owner
    const eligible =
      target &&
      !isOwner(senderId) &&
      !isOwner(target.id) &&
      !(await Contact.isBlocked(senderId, target.id));

    if (eligible) {
      const { outcome, request } = await ContactRequest.send(senderId, target.id);
      const io = req.app.get('io');

      if (outcome === 'created') {
        emitToUser(io, target.id, 'contact-request:received', { requestId: request.id });
      } else if (outcome === 'accepted') {
        await openConversation(io, request);
      }

      logger.info('Contact request processed', { senderId, recipientId: target.id, outcome });
    }

    return res.status(200).json({
      success: true,
      message: 'If that username exists, they will see your request',
    });
  } catch (error) {
    logger.error('Error in sendRequest', { error: error.message, senderId });
    return serverError(res, 'Failed to send request');
  }
}

/**
 * List pending requests
 * GET /api/contact-requests?type=received|sent
 */
async function listRequests(req, res) {
  try {
    const type = req.query.type === 'sent' ? 'sent' : 'received';
    const requests = await ContactRequest.findPendingForUser(req.user.userId, type);

    return res.status(200).json({
      success: true,
      data: { type, requests },
    });
  } catch (error) {
    logger.error('Error in listRequests', { error: error.message, userId: req.user?.userId });
    return serverError(res, 'Failed to load requests');
  }
}

function requestNotFound(res) {
  return res.status(404).json({
    success: false,
    error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' },
  });
}

/**
 * Accept a request: links both users as contacts and opens their conversation
 * PUT /api/contact-requests/:requestId/accept
 */
async function acceptRequest(req, res) {
  const userId = req.user.userId;
  const { requestId } = req.params;

  try {
    const request = await ContactRequest.accept(requestId, userId);
    if (!request) {
      return requestNotFound(res);
    }

    const conversationId = await openConversation(req.app.get('io'), request);

    return res.status(200).json({
      success: true,
      data: { requestId: request.id, status: 'accepted', conversationId },
    });
  } catch (error) {
    logger.error('Error in acceptRequest', { error: error.message, userId, requestId });
    return serverError(res, 'Failed to accept request');
  }
}

/**
 * Reject a request. The sender is not told.
 * PUT /api/contact-requests/:requestId/reject
 */
async function rejectRequest(req, res) {
  const userId = req.user.userId;
  const { requestId } = req.params;

  try {
    const request = await ContactRequest.reject(requestId, userId);
    if (!request) {
      return requestNotFound(res);
    }

    return res.status(200).json({
      success: true,
      data: { requestId: request.id, status: 'rejected' },
    });
  } catch (error) {
    logger.error('Error in rejectRequest', { error: error.message, userId, requestId });
    return serverError(res, 'Failed to reject request');
  }
}

module.exports = {
  sendRequest,
  listRequests,
  acceptRequest,
  rejectRequest,
};
