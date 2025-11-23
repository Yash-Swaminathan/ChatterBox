const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());

// CORS - allows frontend to connect from different port
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - test if server is running
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ChatterBox API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// TODO: Add API routes here (Phase 1, Week 1)
// Example structure:
// const authRoutes = require('./routes/auth.routes');
// const userRoutes = require('./routes/user.routes');
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

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