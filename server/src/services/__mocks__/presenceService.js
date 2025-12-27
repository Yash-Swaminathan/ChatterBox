/**
 * Mock presenceService for testing
 * This mock prevents tests from hitting Redis/database for presence operations
 */

module.exports = {
  setUserOnline: jest.fn().mockResolvedValue(true),
  setUserOffline: jest.fn().mockResolvedValue(true),
  getUserPresence: jest.fn().mockResolvedValue({
    status: 'online',
    timestamp: new Date().toISOString(),
  }),
  getBulkPresence: jest.fn().mockResolvedValue({}),
  updateUserStatus: jest.fn().mockResolvedValue({
    status: 'online',
    timestamp: new Date().toISOString(),
  }),
  refreshHeartbeat: jest.fn().mockResolvedValue(true),
  getUserContacts: jest.fn().mockResolvedValue([]),
  getOnlineContacts: jest.fn().mockResolvedValue({}),
  cleanupStaleConnections: jest.fn().mockResolvedValue(0),
  invalidateContactCache: jest.fn().mockResolvedValue(true),
  
  // Expose valid statuses for tests
  VALID_STATUSES: ['online', 'away', 'busy', 'offline'],
};

