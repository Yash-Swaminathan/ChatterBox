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
  // shutdown from process manager or hosting environment
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    logger.info('SIGTERM received, initiating graceful shutdown');

    // Close Socket.io connections first
    if (io) {
      io.close(() => {
        logger.info('Socket.io closed');
      });
    }

    // Then close HTTP server
    server.close(err => {
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

  // force shutdown
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    logger.info('SIGINT received, initiating graceful shutdown');

    // Close Socket.io connections first
    if (io) {
      io.close(() => {
        logger.info('Socket.io closed');
      });
    }

    // Then close HTTP server
    server.close(err => {
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
}

// Start the server
startServer();
