// Skip rate limiting in tests by default
// Individual tests can override this by setting process.env.SKIP_RATE_LIMIT = 'false'
process.env.SKIP_RATE_LIMIT = 'true';

// Ensure we're in test environment
process.env.NODE_ENV = 'test';
jest.mock('./src/config/redis');
jest.mock('./src/services/messageCacheService');
jest.mock('./src/services/presenceService');
// Keep tests independent of the developer's .env: no site owner, no real notifications.
// dotenv does not override variables that are already set, even to an empty string.
process.env.OWNER_USER_ID = '';
process.env.OWNER_ONLY_MODE = '';
process.env.NTFY_TOPIC = '';
process.env.RESEND_API_KEY = '';
