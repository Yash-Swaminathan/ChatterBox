const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// TODO: Uncomment after implementing database tests
// const { testConnection: testPostgres } = require('./config/database');
// const { testConnection: testRedis } = require('./config/redis');

const app = express();

// Security middleware
app.use(helmet());

// allows frontend to connect
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ChatterBox API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// TODO: Add more routes as we build them
// const contactRoutes = require('./routes/contact.routes');  (Week 7)

// Temporary root API endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ChatterBox API',
    version: '1.0.0',
  });
});

// error handler for 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// error handler for other errors
app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Something went wrong!',
    },
  });
});

module.exports = app;
