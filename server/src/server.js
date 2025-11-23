require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Start server
const server = app.listen(PORT, () => {
  console.log(' Server Started!');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// shutdown from process manager or hosting environment
process.on('SIGTERM', () => {
  console.log('Shutting down');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// force shutdown
process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
