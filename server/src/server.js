require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initializeBucket } = require('./config/storage');
const { initializeSocket } = require('./socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Initialize MinIO bucket before starting server
async function startServer() {
  try {
    // Initialize MinIO bucket
    await initializeBucket();
    logger.info('MinIO initialized successfully');

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
          if (err) {
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
