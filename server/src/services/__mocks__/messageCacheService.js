/**
 * Mock MessageCacheService for testing
 * This mock prevents tests from hitting Redis for cache operations
 */

module.exports = {
  // Recent messages cache
  getRecentMessages: jest.fn().mockResolvedValue(null),
  setRecentMessages: jest.fn().mockResolvedValue(undefined),

  // Conversation cache invalidation
  invalidateConversation: jest.fn().mockResolvedValue(undefined),

  // Unread counts
  getUnreadCount: jest.fn().mockResolvedValue(null),
  incrementUnread: jest.fn().mockResolvedValue(undefined),
  resetUnread: jest.fn().mockResolvedValue(undefined),

  // Message status
  getMessageStatus: jest.fn().mockResolvedValue(null),
  setMessageStatus: jest.fn().mockResolvedValue(undefined),
  batchUpdateStatus: jest.fn().mockResolvedValue(undefined),
};

