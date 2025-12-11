require('dotenv').config();
const app = require('./app');
const { initializeBucket } = require('./config/storage');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// TODO: Add Socket.io server initialization (Phase 2, Week 3)
// const server = require('http').createServer(app);
// const io = require('./socket')(server);

// Initialize MinIO bucket before starting server
async function startServer() {
  try {
    // Initialize MinIO bucket
    await initializeBucket();
    logger.info('MinIO initialized successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log('Server Started!');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Server running on: http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown handlers
    setupShutdownHandlers(server);
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupShutdownHandlers(server) {
  // shutdown from process manager or hosting environment
  process.on('SIGTERM', () => {
    console.log('Shutting down');
    server.close(err => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }
      console.log('Server closed');
      process.exit(0);
    });
  });

  // force shutdown
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    server.close(err => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer();
