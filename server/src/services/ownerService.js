const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const ContactRequest = require('../models/ContactRequest');
const { isValidUUID } = require('../utils/validators');
const logger = require('../utils/logger');
const { joinUsersToConversation } = require('../socket/conversationRooms');

// Env is read on every call so the mode can be toggled without reloading modules (tests rely on this)

/**
 * @returns {string|null} The owner's user ID, or null if not configured
 */
function getOwnerId() {
  return process.env.OWNER_USER_ID || null;
}

/**
 * Owner-only mode: non-owner users can only see and contact the owner.
 * If the mode is on but no owner is configured, nobody is reachable (fails closed).
 * @returns {boolean}
 */
function isOwnerOnlyMode() {
  return process.env.OWNER_ONLY_MODE === 'true';
}

/**
 * @param {string} userId
 * @returns {boolean} True if userId is the configured owner
 */
function isOwner(userId) {
  const ownerId = getOwnerId();
  return Boolean(ownerId) && userId === ownerId;
}

/**
 * Check whether a user is allowed to see or contact another user without a connection:
 * themselves and the owner (and, for the owner, everyone)
 * @param {string} requesterId - User making the request
 * @param {string} targetId - User being viewed or contacted
 * @returns {boolean}
 */
function canReach(requesterId, targetId) {
  if (!isOwnerOnlyMode()) {
    return true;
  }
  return requesterId === targetId || isOwner(requesterId) || isOwner(targetId);
}

/**
 * Check whether a user is allowed to see or contact every one of the given users.
 * In owner-only mode that means the owner or an accepted connection.
 * @param {string} requesterId - User making the request
 * @param {string[]} targetIds - Users being viewed or contacted
 * @returns {Promise<boolean>}
 */
async function canReachAll(requesterId, targetIds) {
  const needConnection = targetIds.filter(targetId => !canReach(requesterId, targetId));

  if (needConnection.length === 0) {
    return true;
  }
  if (!needConnection.every(isValidUUID)) {
    return false;
  }

  const connected = await ContactRequest.filterConnected(requesterId, needConnection);
  return needConnection.every(targetId => connected.includes(targetId));
}

/**
 * Create the direct conversation (and contact rows) between a new user and the owner.
 * Idempotent, and never throws: registration must not fail because of this.
 * @param {string} newUserId - The newly registered user's ID
 * @param {Object} [io] - Socket.io server instance, used to update the owner's open sessions
 * @returns {Promise<Object|null>} The conversation, or null if skipped or failed
 */
async function createAutoConversationWithOwner(newUserId, io) {
  const ownerId = getOwnerId();

  if (!ownerId || newUserId === ownerId) {
    return null;
  }

  try {
    const { conversation, created } = await Conversation.getOrCreateDirect(newUserId, ownerId);

    // Presence is only broadcast to contacts, so link both directions
    await Contact.create(newUserId, ownerId);
    await Contact.create(ownerId, newUserId);

    if (created) {
      joinUsersToConversation(io, conversation.id, [newUserId, ownerId]);
    }

    logger.info('Auto-conversation with owner ready', {
      conversationId: conversation.id,
      userId: newUserId,
      created,
    });

    return conversation;
  } catch (error) {
    logger.error('Failed to create auto-conversation with owner', {
      userId: newUserId,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  getOwnerId,
  isOwnerOnlyMode,
  isOwner,
  canReach,
  canReachAll,
  createAutoConversationWithOwner,
};
