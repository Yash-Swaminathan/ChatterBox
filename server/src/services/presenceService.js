const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

// TODO: Future Enhancement - Add custom status messages (e.g., "In a meeting", "Be back soon")
// Priority: Medium (nice-to-have for better UX)

// TODO: Future Enhancement - Add "last seen X minutes ago" calculation
// Priority: Low (cosmetic feature)

// TODO: Future Enhancement - Add privacy settings (hide online status)
// Store in user preferences table: { hide_online_status: boolean }
// Priority: Medium (important for user privacy)

// TODO: Future Enhancement - Track presence history/analytics
// Store daily active users, peak online times, etc.
// Priority: Low (analytics feature)

// TODO: Performance Optimization - Monitor Redis memory usage
// Set up alerts if presence data exceeds 500MB
// Consider using Redis Sorted Sets for time-based cleanup
// Priority: Medium (production monitoring)

const PRESENCE_TTL = parseInt(process.env.PRESENCE_TTL || '60', 10);
const CONTACT_CACHE_TTL = parseInt(process.env.CONTACT_CACHE_TTL || '300', 10);
const VALID_STATUSES = ['online', 'away', 'busy', 'offline'];

/**
 * Set user as online in Redis
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {Promise<boolean>} Success status
 */
async function setUserOnline(userId, socketId) {
  try {
    const presence = {
      status: 'online',
      timestamp: new Date().toISOString(),
      socketId,
    };

    await redisClient.setEx(`presence:${userId}`, PRESENCE_TTL, JSON.stringify(presence));

    await redisClient.sAdd(`user:sockets:${userId}`, socketId);

    logger.info('User set to online', { userId, socketId });
    return true;
  } catch (error) {
    logger.error('Error setting user online', { userId, error: error.message });
    return false;
  }
}

/**
 * Set user as offline in Redis (if last socket)
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {Promise<boolean>} Success status
 */
async function setUserOffline(userId, socketId) {
  try {
    const removed = await redisClient.sRem(`user:sockets:${userId}`, socketId);

    if (removed === 0) {
      logger.debug('Socket ID not found in user sockets', { userId, socketId });
      return false;
    }

    const socketCount = await redisClient.sCard(`user:sockets:${userId}`);

    if (socketCount === 0) {
      const presence = {
        status: 'offline',
        timestamp: new Date().toISOString(),
      };

      await redisClient.setEx(`presence:${userId}`, PRESENCE_TTL, JSON.stringify(presence));

      logger.info('User set to offline (last socket)', { userId });
      return true;
    }

    logger.debug('User still has active sockets', {
      userId,
      socketCount,
    });
    return false;
  } catch (error) {
    logger.error('Error setting user offline', {
      userId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Update user status (away, busy, online)
 * @param {string} userId - User ID
 * @param {string} status - New status
 * @returns {Promise<Object|null>} Updated presence or null
 */
async function updateUserStatus(userId, status) {
  try {
    if (!VALID_STATUSES.includes(status)) {
      logger.warn('Invalid status value', { userId, status });
      return null;
    }

    const currentPresence = await getUserPresence(userId);

    if (!currentPresence) {
      logger.warn('Cannot update status for offline user', { userId });
      return null;
    }

    const presence = {
      ...currentPresence,
      status,
      timestamp: new Date().toISOString(),
    };

    await redisClient.setEx(`presence:${userId}`, PRESENCE_TTL, JSON.stringify(presence));

    logger.info('User status updated', { userId, status });
    return presence;
  } catch (error) {
    logger.error('Error updating user status', {
      userId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user presence from Redis
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Presence object or null
 */
async function getUserPresence(userId) {
  try {
    const presenceData = await redisClient.get(`presence:${userId}`);

    if (!presenceData) {
      return null;
    }

    return JSON.parse(presenceData);
  } catch (error) {
    logger.error('Error getting user presence', {
      userId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get presence for multiple users (bulk query)
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} Map of userId to presence
 */
async function getBulkPresence(userIds) {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    const keys = userIds.map(id => `presence:${id}`);
    const results = await redisClient.mGet(keys);

    const presenceMap = {};

    userIds.forEach((userId, index) => {
      if (results[index]) {
        try {
          presenceMap[userId] = JSON.parse(results[index]);
        } catch {
          logger.warn('Failed to parse presence data', { userId });
          presenceMap[userId] = null;
        }
      } else {
        presenceMap[userId] = null;
      }
    });

    return presenceMap;
  } catch (error) {
    logger.error('Error getting bulk presence', { error: error.message });
    return {};
  }
}

/**
 * Refresh heartbeat (update Redis TTL)
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {Promise<boolean>} Success status
 */
async function refreshHeartbeat(userId, socketId) {
  try {
    const isMember = await redisClient.sIsMember(`user:sockets:${userId}`, socketId);

    if (!isMember) {
      logger.warn('Heartbeat for non-existent socket', { userId, socketId });
      return false;
    }

    const extended = await redisClient.expire(`presence:${userId}`, PRESENCE_TTL);

    if (extended) {
      logger.debug('Heartbeat refreshed', { userId, socketId });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error refreshing heartbeat', {
      userId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Get user's contacts from database (with caching)
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of contact user IDs
 */
async function getUserContacts(userId) {
  try {
    const cacheKey = `user:contacts:${userId}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT contact_user_id
      FROM contacts
      WHERE user_id = $1 AND is_blocked = false
    `;

    const result = await pool.query(query, [userId]);
    const contactIds = result.rows.map(row => row.contact_user_id);

    await redisClient.setEx(cacheKey, CONTACT_CACHE_TTL, JSON.stringify(contactIds));

    return contactIds;
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist yet', { userId });
      return [];
    }

    logger.error('Error getting user contacts', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get online contacts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Map of online contact IDs to presence
 */
async function getOnlineContacts(userId) {
  try {
    const contactIds = await getUserContacts(userId);

    if (contactIds.length === 0) {
      return {};
    }

    const presenceMap = await getBulkPresence(contactIds);

    const onlineContacts = {};
    Object.entries(presenceMap).forEach(([contactId, presence]) => {
      if (presence && presence.status !== 'offline') {
        onlineContacts[contactId] = presence;
      }
    });

    return onlineContacts;
  } catch (error) {
    logger.error('Error getting online contacts', {
      userId,
      error: error.message,
    });
    return {};
  }
}

/**
 * Clean up stale connections (connections without heartbeat)
 * @returns {Promise<number>} Number of cleaned up users
 */
async function cleanupStaleConnections() {
  try {
    let cursor = '0';
    let cleanedCount = 0;

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: 'user:sockets:*',
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys;

      for (const key of keys) {
        const userId = key.replace('user:sockets:', '');
        const presence = await getUserPresence(userId);

        if (!presence) {
          await redisClient.del(key);
          cleanedCount++;
          logger.info('Cleaned up stale socket set', { userId });
        }
      }
    } while (cursor !== '0');

    if (cleanedCount > 0) {
      logger.info('Stale connection cleanup complete', { cleanedCount });
    }

    return cleanedCount;
  } catch (error) {
    logger.error('Error cleaning up stale connections', {
      error: error.message,
    });
    return 0;
  }
}

/**
 * Invalidate contact cache for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function invalidateContactCache(userId) {
  try {
    await redisClient.del(`user:contacts:${userId}`);
    logger.debug('Contact cache invalidated', { userId });
    return true;
  } catch (error) {
    logger.error('Error invalidating contact cache', {
      userId,
      error: error.message,
    });
    return false;
  }
}

module.exports = {
  setUserOnline,
  setUserOffline,
  updateUserStatus,
  getUserPresence,
  getBulkPresence,
  refreshHeartbeat,
  getUserContacts,
  getOnlineContacts,
  cleanupStaleConnections,
  invalidateContactCache,
  VALID_STATUSES,
};
