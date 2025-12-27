/**
 * Mock Redis client for testing
 * This mock prevents tests from connecting to real Redis
 */

// Create a chainable multi mock
const createMultiMock = () => ({
  zAdd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  incr: jest.fn().mockReturnThis(),
  decrBy: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  hSet: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
});

// Mock all redisClient methods used across the codebase
const redisClient = {
  // Basic operations
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  set: jest.fn().mockResolvedValue('OK'),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),

  // Sorted set operations (used by messageCacheService)
  zAdd: jest.fn().mockResolvedValue(1),
  zRem: jest.fn().mockResolvedValue(1),
  zRange: jest.fn().mockResolvedValue([]),
  zRevRange: jest.fn().mockResolvedValue([]),
  zRangeWithScores: jest.fn().mockResolvedValue([]),
  zScore: jest.fn().mockResolvedValue(null),

  // Hash operations
  hGet: jest.fn().mockResolvedValue(null),
  hSet: jest.fn().mockResolvedValue(1),
  hDel: jest.fn().mockResolvedValue(1),
  hGetAll: jest.fn().mockResolvedValue({}),

  // Set operations (used by presenceService)
  sAdd: jest.fn().mockResolvedValue(1),
  sRem: jest.fn().mockResolvedValue(1),
  sCard: jest.fn().mockResolvedValue(0),
  sMembers: jest.fn().mockResolvedValue([]),
  sIsMember: jest.fn().mockResolvedValue(false),

  // Bulk operations
  mGet: jest.fn().mockResolvedValue([]),

  // Scan for cleanup
  scan: jest.fn().mockResolvedValue({ cursor: '0', keys: [] }),

  // Transaction/pipeline support
  multi: jest.fn().mockImplementation(() => createMultiMock()),

  // Connection state
  isOpen: true,
  isReady: true,
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),

  // Event handlers (no-op)
  on: jest.fn().mockReturnThis(),
};

// Mock helper functions
const connectRedis = jest.fn().mockResolvedValue(true);
const testConnection = jest.fn().mockResolvedValue(true);
const closeRedis = jest.fn().mockResolvedValue(undefined);
const set = jest.fn().mockResolvedValue(true);
const get = jest.fn().mockResolvedValue(null);
const del = jest.fn().mockResolvedValue(true);
const exists = jest.fn().mockResolvedValue(false);
const expire = jest.fn().mockResolvedValue(true);

module.exports = {
  redisClient,
  connectRedis,
  testConnection,
  closeRedis,
  set,
  get,
  del,
  exists,
  expire,
};

