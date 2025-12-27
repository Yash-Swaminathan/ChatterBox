/**
 * Jest setup file - runs before all tests
 * Configure global test environment settings
 */

// Skip rate limiting in tests by default
// Individual tests can override this by setting process.env.SKIP_RATE_LIMIT = 'false'
process.env.SKIP_RATE_LIMIT = 'true';

// Ensure we're in test environment
process.env.NODE_ENV = 'test';

// Auto-mock Redis for all tests to prevent real connections during module loading
// Tests that need specific Redis behavior can still set up their own mock implementations
jest.mock('./src/config/redis');

// Auto-mock MessageCacheService to prevent Redis cache operations in integration tests
// This prevents "client is closed" errors when tests use real database but not Redis
jest.mock('./src/services/messageCacheService');

// Auto-mock presenceService to prevent Redis/database operations in socket tests
// Tests that specifically test presenceService should use jest.unmock or set up their own mocks
jest.mock('./src/services/presenceService');