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

    logger.info('Initializing Redis adapter', { redisUrl });

    // Create Redis clients for pub/sub
    const pubClient = createClient({ url: redisUrl });
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

    // Connect to Redis
    await pubClient.connect();
    await subClient.connect();

    // Attach Redis adapter to Socket.io
    io.adapter(createAdapter(pubClient, subClient));

    logger.info('Redis adapter connected successfully', {
      adapterType: 'RedisAdapter',
      redis: redisUrl,
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing Redis connections');
      await pubClient.quit();
      await subClient.quit();
    });
  } catch (error) {
    logger.error('Redis adapter initialization failed, running in single-server mode', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - allow server to continue without Redis adapter
    // Socket.io will work in single-server mode
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
