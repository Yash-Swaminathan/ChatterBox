const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const logger = require('../utils/logger');
const connectionHandler = require('./handlers/connectionHandler');

// TODO: Week 3, Day 3-4 - Add authentication middleware
// TODO: Week 3, Day 5-7 - Add presence tracking on connection
// TODO: Week 4 - Add message event handlers
// TODO: Production - Configure sticky sessions in load balancer (Nginx)
// TODO: Production - Enable Socket.io monitoring/metrics (socket.io-admin)

let io = null;

/**
 * Initialize Socket.io server with Redis adapter
 * @param {http.Server} httpServer - Express HTTP server instance
 * @returns {SocketIO.Server} Initialized Socket.io server
 */
async function initializeSocket(httpServer) {
  try {
    // Create Socket.io instance
    io = socketIO(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000', 10), // 60 seconds
      pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000', 10), // 25 seconds
      maxHttpBufferSize: 1e6, // 1 MB max payload
      transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
      allowEIO3: true, // Enable compatibility with older clients
    });

    logger.info('Socket.io server created', {
      cors: process.env.CLIENT_URL || 'http://localhost:5173',
      transports: ['websocket', 'polling'],
    });

    // Initialize Redis adapter for multi-server support
    await initializeRedisAdapter(io);

    // Set up connection handlers
    connectionHandler(io);

    logger.info('Socket.io initialization complete', {
      adapterType: io.sockets.adapter.constructor.name,
    });

    return io;
  } catch (error) {
    logger.error('Failed to initialize Socket.io', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Initialize Redis adapter for Socket.io
 * Enables WebSocket synchronization across multiple server instances
 * @param {SocketIO.Server} io - Socket.io server instance
 */
async function initializeRedisAdapter(io) {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    if (!process.env.REDIS_URL) {
      logger.warn('REDIS_URL not set, using default redis://localhost:6379');
    }

    logger.info('Initializing Redis adapter', { redisUrl });

    // Create Redis clients with connection pooling and retry strategy
    const redisConfig = {
      url: redisUrl,
      socket: {
        reconnectStrategy: retries => {
          if (retries > 10) {
            logger.error('Redis max reconnection attempts reached');
            return new Error('Redis reconnection failed');
          }
          const delay = Math.min(retries * 50, 500);
          logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
        connectTimeout: 5000,
      },
    };

    const pubClient = createClient(redisConfig);
    const subClient = pubClient.duplicate();

    // Error handlers
    pubClient.on('error', err => {
      logger.error('Redis pub client error', { error: err.message });
    });

    subClient.on('error', err => {
      logger.error('Redis sub client error', { error: err.message });
    });

    // Connection handlers
    pubClient.on('connect', () => {
      logger.info('Redis pub client connected');
    });

    subClient.on('connect', () => {
      logger.info('Redis sub client connected');
    });

    // Reconnection handlers
    pubClient.on('reconnecting', () => {
      logger.warn('Redis pub client reconnecting');
    });

    subClient.on('reconnecting', () => {
      logger.warn('Redis sub client reconnecting');
    });

    // Connect to Redis with timeout
    const connectionTimeout = 10000; // 10 seconds
    await Promise.race([
      Promise.all([pubClient.connect(), subClient.connect()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
      ),
    ]);

    // Attach Redis adapter to Socket.io
    io.adapter(createAdapter(pubClient, subClient));

    logger.info('Redis adapter connected successfully', {
      adapterType: 'RedisAdapter',
      redis: redisUrl,
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing Redis connections');
      try {
        await Promise.all([pubClient.quit(), subClient.quit()]);
        logger.info('Redis connections closed successfully');
      } catch (err) {
        logger.error('Error closing Redis connections', { error: err.message });
      }
    });
  } catch (error) {
    logger.warn('Redis adapter initialization failed, falling back to single-server mode', {
      error: error.message,
      reason: 'Socket.io will continue in single-instance mode without Redis',
    });
    // Don't throw - allow server to continue without Redis adapter
    // Socket.io will work in single-server mode (in-memory adapter)
  }
}

/**
 * Get Socket.io instance
 * @returns {SocketIO.Server|null} Socket.io server instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  }
  return io;
}

module.exports = {
  initializeSocket,
  getIO,
};
