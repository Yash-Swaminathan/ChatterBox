const logger = require('./logger');

// TODO Week 17: Move to Redis for horizontal scaling
const RATE_LIMIT = {
  MESSAGES_PER_WINDOW: 30,
  WINDOW_SIZE_MS: 60000,
  BURST_LIMIT: 5,
  BURST_WINDOW_MS: 1000,
  PENALTY_DURATION_MS: 30000,
  CLEANUP_INTERVAL_MS: 3600000,
  MAX_ENTRIES: 10000,
};

const rateLimiter = new Map();
let cleanupIntervalId = null;

function createRateLimitEntry(now) {
  return {
    count: 0,
    windowStart: now,
    burstCount: 0,
    burstStart: now,
    penaltyUntil: null,
  };
}

function performRateLimitCleanup() {
  const now = Date.now();
  for (const [userId, entry] of rateLimiter.entries()) {
    if (
      now - entry.windowStart > RATE_LIMIT.WINDOW_SIZE_MS &&
      (!entry.penaltyUntil || now > entry.penaltyUntil)
    ) {
      rateLimiter.delete(userId);
    }
  }
  logger.debug('Rate limiter cleanup', { remainingEntries: rateLimiter.size });
}

function startCleanup() {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(performRateLimitCleanup, RATE_LIMIT.CLEANUP_INTERVAL_MS);
  logger.info('Rate limiter cleanup started');
}

function stopCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Rate limiter cleanup stopped');
  }
}

function clearRateLimiter() {
  rateLimiter.clear();
}

function clearUserRateLimit(userId) {
  rateLimiter.delete(userId);
}

/**
 * @param {string} userId
 * @returns {{allowed: boolean, retryAfter?: number}}
 */
function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimiter.get(userId);

  if (!entry) {
    if (rateLimiter.size >= RATE_LIMIT.MAX_ENTRIES) {
      performRateLimitCleanup();
      if (rateLimiter.size >= RATE_LIMIT.MAX_ENTRIES) {
        logger.warn('Rate limiter at max capacity', { size: rateLimiter.size });
        return { allowed: false, retryAfter: 5000 };
      }
    }
    entry = createRateLimitEntry(now);
    rateLimiter.set(userId, entry);
  }

  if (entry.penaltyUntil && now < entry.penaltyUntil) {
    return { allowed: false, retryAfter: entry.penaltyUntil - now };
  }

  if (now - entry.windowStart > RATE_LIMIT.WINDOW_SIZE_MS) {
    entry.windowStart = now;
    entry.count = 0;
    entry.penaltyUntil = null;
  }

  if (now - entry.burstStart > RATE_LIMIT.BURST_WINDOW_MS) {
    entry.burstStart = now;
    entry.burstCount = 0;
  }

  if (entry.count >= RATE_LIMIT.MESSAGES_PER_WINDOW) {
    entry.penaltyUntil = now + RATE_LIMIT.PENALTY_DURATION_MS;
    logger.warn('User rate limited', { userId, count: entry.count });
    return { allowed: false, retryAfter: RATE_LIMIT.PENALTY_DURATION_MS };
  }

  if (entry.burstCount >= RATE_LIMIT.BURST_LIMIT) {
    return { allowed: false, retryAfter: RATE_LIMIT.BURST_WINDOW_MS - (now - entry.burstStart) };
  }

  entry.count++;
  entry.burstCount++;
  rateLimiter.set(userId, entry);

  return { allowed: true };
}

startCleanup();

module.exports = {
  checkRateLimit,
  clearRateLimiter,
  clearUserRateLimit,
  startCleanup,
  stopCleanup,
  RATE_LIMIT,
};
