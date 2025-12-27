// Skip rate limiting in tests by default
// Individual tests can override this by setting process.env.SKIP_RATE_LIMIT = 'false'
process.env.SKIP_RATE_LIMIT = 'true';

// Ensure we're in test environment
process.env.NODE_ENV = 'test';
jest.mock('./src/config/redis');
jest.mock('./src/services/messageCacheService');
jest.mock('./src/services/presenceService');