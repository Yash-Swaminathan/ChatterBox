/**
 * Jest setup file - runs before all tests
 * Configure global test environment settings
 */

// Skip rate limiting in tests by default
// Individual tests can override this by setting process.env.SKIP_RATE_LIMIT = 'false'
process.env.SKIP_RATE_LIMIT = 'true';

// Ensure we're in test environment
process.env.NODE_ENV = 'test';
