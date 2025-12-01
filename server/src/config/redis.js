const redis = require('redis');
require('dotenv').config();

// Redis client configuration
// TODO: In production, set REDIS_URL to use authentication and TLS (for example: redis://:password@host:6379).
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Too many reconnection attempts, giving up');
        return new Error('Too many retries');
      }
      // Exponential backoff: 50ms, 100ms, 200ms, etc.
      const delay = Math.min(retries * 50, 3000);
      console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
  },
});

// Redis event handlers
redisClient.on('connect', () => {
  console.log('Redis: Connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis: Connected and ready');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redisClient.on('reconnecting', () => {
  console.log('Redis: Reconnecting...');
});

redisClient.on('end', () => {
  console.log('Redis: Connection closed');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return true;
  } catch (err) {
    console.error('❌ Redis connection error:', err.message);
    return false;
  }
};

// Test Redis connection
const testConnection = async () => {
  try {
    const pong = await redisClient.ping();
    console.log('Redis ping successful:', pong);
    return true;
  } catch (err) {
    console.error('Redis ping failed:', err.message);
    return false;
  }
};

// Close Redis connection
const closeRedis = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log('Redis connection closed gracefully');
    }
  } catch (err) {
    console.error('Error closing Redis connection:', err.message);
  }
};

// Set a key with optional expiration
const set = async (key, value, expirationSeconds = null) => {
  try {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (expirationSeconds) {
      await redisClient.setEx(key, expirationSeconds, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (err) {
    console.error('Redis SET error:', err.message);
    return false;
  }
};

// Get a key and parse JSON if applicable
const get = async (key) => {
  try {
    const value = await redisClient.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (err) {
    console.error('Redis GET error:', err.message);
    return null;
  }
};

// Delete a key
const del = async (key) => {
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.error('Redis DEL error:', err.message);
    return false;
  }
};

// Check if key exists
const exists = async (key) => {
  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (err) {
    console.error('Redis EXISTS error:', err.message);
    return false;
  }
};

// Set expiration on a key (in seconds)
const expire = async (key, seconds) => {
  try {
    await redisClient.expire(key, seconds);
    return true;
  } catch (err) {
    console.error('Redis EXPIRE error:', err.message);
    return false;
  }
};

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
