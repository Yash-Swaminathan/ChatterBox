const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
// TODO: Uncomment after implementing database tests
// const { testConnection: testPostgres } = require('./config/database');
// const { testConnection: testRedis } = require('./config/redis');

const app = express();

// Behind a hosting platform's proxy the client address is in X-Forwarded-For.
// Without this every visitor shares one IP and one rate limit.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Avatars are served from object storage on another origin
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  })
);

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
const contactRoutes = require('./routes/contacts');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contacts', contactRoutes);

// Temporary root API endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ChatterBox API',
    version: '1.0.0',
  });
});

// In production the same server also serves the built React app, so the site,
// the API and the WebSocket share one origin
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, '../../client/dist');
const serveClient =
  (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') &&
  fs.existsSync(path.join(clientDist, 'index.html'));

if (serveClient) {
  app.use(express.static(clientDist));

  // Client-side routes (/chat, /login, ...) all load the app shell
  app.use((req, res, next) => {
    const isPageRequest =
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/socket.io') &&
      !path.extname(req.path);

    if (!isPageRequest) {
      return next();
    }
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

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
