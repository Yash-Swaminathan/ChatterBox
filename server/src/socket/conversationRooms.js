const logger = require('../utils/logger');

const conversationRoom = conversationId => `conversation:${conversationId}`;
const userRoom = userId => `user:${userId}`;

/**
 * Join all of the given users' connected sockets to a conversation room and
 * tell them about the conversation so their conversation lists can refresh.
 * Room events (message:new, message:edited, ...) only reach sockets in the room.
 * @param {Object} io - Socket.io server instance (no-op if missing, e.g. in REST-only tests)
 * @param {string} conversationId - Conversation UUID
 * @param {string[]} userIds - Users to join
 */
function joinUsersToConversation(io, conversationId, userIds) {
  if (!io || !Array.isArray(userIds) || userIds.length === 0) {
    return;
  }

  try {
    const userRooms = userIds.map(userRoom);
    io.in(userRooms).socketsJoin(conversationRoom(conversationId));
    io.to(userRooms).emit('conversation:new', { conversationId });
  } catch (error) {
    logger.error('Failed to join users to conversation room', {
      conversationId,
      error: error.message,
    });
  }
}

/**
 * Remove all of a user's connected sockets from a conversation room
 * @param {Object} io - Socket.io server instance (no-op if missing)
 * @param {string} conversationId - Conversation UUID
 * @param {string} userId - User to remove
 */
function removeUserFromConversation(io, conversationId, userId) {
  if (!io) {
    return;
  }

  try {
    io.in(userRoom(userId)).socketsLeave(conversationRoom(conversationId));
  } catch (error) {
    logger.error('Failed to remove user from conversation room', {
      conversationId,
      userId,
      error: error.message,
    });
  }
}

module.exports = {
  conversationRoom,
  joinUsersToConversation,
  removeUserFromConversation,
};
