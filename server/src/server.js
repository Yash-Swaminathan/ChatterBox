require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initializeBucket } = require('./config/storage');
const { connectRedis } = require('./config/redis');
const { startReminderSweep, stopReminderSweep } = require('./services/messageNotifications');
const { initializeSocket } = require('./socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

/**
 * Stop at startup with a clear message if required settings are missing, rather
 * than starting and failing on the first login. Warn about optional ones.
 */
function checkConfiguration() {
  const missing = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.OWNER_USER_ID) {
    logger.warn('OWNER_USER_ID is not set: new users get no conversation with the owner');
  }
  if (process.env.OWNER_ONLY_MODE !== 'true') {
    logger.warn('OWNER_ONLY_MODE is not "true": users can search for and message each other');
  }
  if (!process.env.APP_URL) {
    logger.warn('APP_URL is not set: links in emails will point to the wrong address');
  }
  if (!process.env.NTFY_TOPIC) {
    logger.warn('NTFY_TOPIC is not set: push notifications are disabled');
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    logger.warn('RESEND_API_KEY or EMAIL_FROM is not set: emails, including password resets, are disabled');
  }
}

// Initialize MinIO bucket before starting server
async function startServer() {
  try {
    checkConfiguration();

    // Object storage only backs avatar uploads, so the app starts without it
    try {
      await initializeBucket();
      logger.info('MinIO initialized successfully');
    } catch (error) {
      logger.warn('Object storage unavailable: avatar uploads are disabled', {
        error: error.message,
      });
    }

    // Connect the shared Redis client used for presence, message cache and unread counts.
    // These degrade gracefully without Redis, so a failed connection is not fatal.
    const redisConnected = await connectRedis();
    if (redisConnected) {
      logger.info('Redis client connected');
    } else {
      logger.warn('Redis client not connected: presence and caching are unavailable');
    }

    // Create HTTP server from Express app
    const httpServer = http.createServer(app);

    // Initialize Socket.io with Redis adapter
    const io = await initializeSocket(httpServer);
    logger.info('Socket.io initialized successfully');

    // Attach Socket.io to Express app for REST API access
    app.set('io', io);

    // Start server (both HTTP and WebSocket)
    httpServer.listen(PORT, () => {
      console.log('Server Started!');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Server running on: http://localhost:${PORT}`);
      console.log(`WebSocket server ready on: ws://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Remind the owner about visitors who are still waiting for a reply
    startReminderSweep();

    // Graceful shutdown handlers
    setupShutdownHandlers(httpServer, io);
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupShutdownHandlers(server, io) {
  const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
  let isShuttingDown = false;

  const gracefulShutdown = signal => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    isShuttingDown = true;
    stopReminderSweep();

    console.log(`\n${signal} received, shutting down gracefully...`);
    logger.info(`${signal} received, initiating graceful shutdown`);

    // Set up force-kill timeout
    const shutdownTimer = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      console.error('Shutdown timeout - forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    // Close Socket.io connections first, then HTTP server
    if (io) {
      io.close(() => {
        logger.info('Socket.io closed');

        // After Socket.io is closed, close HTTP server
        server.close(err => {
          clearTimeout(shutdownTimer);
          // io.close() has usually closed the HTTP server already; that is not a failure
          if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
            console.error('Error closing server:', err);
            logger.error('Error during shutdown', { error: err.message });
            process.exit(1);
          }
          console.log('Server closed');
          logger.info('Server shutdown complete');
          process.exit(0);
        });
      });
    } else {
      // No Socket.io to close, just close HTTP server
      server.close(err => {
        clearTimeout(shutdownTimer);
        if (err) {
          console.error('Error closing server:', err);
          logger.error('Error during shutdown', { error: err.message });
          process.exit(1);
        }
        console.log('Server closed');
        logger.info('Server shutdown complete');
        process.exit(0);
      });
    }
  };

  // Handle shutdown from process manager or hosting environment
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle Ctrl+C in terminal
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Start the server
startServer();
