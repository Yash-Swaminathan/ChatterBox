const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { generateAccessToken } = require('../../utils/jwt');
const socketAuthMiddleware = require('../middleware/socketAuth');
const connectionHandler = require('../handlers/connectionHandler');
const { disconnectUser } = require('../handlers/connectionHandler');

describe('Socket.io Authentication Integration', () => {
  let httpServer;
  let io;
  let clientSocket;

  const TEST_PORT = 3002; // Different port to avoid conflicts

  beforeAll(done => {
    // Create HTTP server
    httpServer = http.createServer();

    // Create Socket.io server with auth middleware
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        credentials: true,
      },
      pingTimeout: 5000,
      pingInterval: 2000,
    });

    // Apply authentication middleware
    io.use(socketAuthMiddleware);

    // Apply connection handler for full functionality
    connectionHandler(io);

    // Start server
    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterAll(done => {
    io.close();
    httpServer.close(() => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Successful Authentication', () => {
    it('should connect with valid token in auth', done => {
      const token = generateAccessToken({
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Should not error: ${error.message}`));
      });
    });

    it('should connect with valid token in query', done => {
      const token = generateAccessToken({
        userId: 'user-456',
        username: 'queryuser',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}?token=${token}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Should not error: ${error.message}`));
      });
    });

    it('should receive auth:success event on successful connection', done => {
      const token = generateAccessToken({
        userId: 'user-789',
        username: 'successuser',
        email: 'success@example.com',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('auth:success', data => {
        expect(data).toMatchObject({
          userId: 'user-789',
          username: 'successuser',
        });
        expect(data.connectedAt).toBeDefined();
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Should not error: ${error.message}`));
      });
    });
  });

  describe('Failed Authentication', () => {
    it('should reject connection without token', done => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toBe('Authentication token required');
        done();
      });
    });

    it('should reject connection with invalid token', done => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'invalid-token-123' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toBe('Invalid token');
        done();
      });
    });

    it('should reject connection with expired token', done => {
      const expiredToken = generateAccessToken(
        {
          userId: 'user-999',
          username: 'expireduser',
        },
        '-1h' // Expired
      );

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with expired token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toBe('Token expired');
        done();
      });
    });

    it('should reject connection with malformed token', done => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'not.a.jwt.token' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with malformed token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toMatch(/Invalid token|Authentication failed/);
        done();
      });
    });
  });

  describe('Multi-Device Support', () => {
    let clientSocket2;

    afterEach(() => {
      if (clientSocket2 && clientSocket2.connected) {
        clientSocket2.disconnect();
      }
    });

    it('should allow multiple connections with same user token', done => {
      const token = generateAccessToken({
        userId: 'user-multi',
        username: 'multiuser',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Connect second client with same user token
        clientSocket2 = Client(`http://localhost:${TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
          expect(clientSocket.connected).toBe(true);
          expect(clientSocket2.connected).toBe(true);
          expect(clientSocket.id).not.toBe(clientSocket2.id);
          done();
        });
      });
    });

    it('should receive messages on all user devices', done => {
      const token = generateAccessToken({
        userId: 'user-broadcast',
        username: 'broadcastuser',
      });

      let receivedCount = 0;

      const checkDone = () => {
        receivedCount++;
        if (receivedCount === 2) {
          done();
        }
      };

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.on('test:notification', data => {
          expect(data.message).toBe('Hello all devices!');
          checkDone();
        });

        // Connect second device
        clientSocket2 = Client(`http://localhost:${TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
          clientSocket2.on('test:notification', data => {
            expect(data.message).toBe('Hello all devices!');
            checkDone();
          });

          // Emit to user room
          io.to('user:user-broadcast').emit('test:notification', {
            message: 'Hello all devices!',
          });
        });
      });
    });
  });

  describe('Force Disconnect', () => {
    it('should receive force:disconnect event when forcefully disconnected', done => {
      const token = generateAccessToken({
        userId: 'user-force',
        username: 'forceuser',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.on('force:disconnect', data => {
          expect(data.reason).toBe('test_disconnect');
          expect(data.timestamp).toBeDefined();
        });

        clientSocket.on('disconnect', () => {
          done();
        });

        // Force disconnect user
        setTimeout(() => {
          const count = disconnectUser(io, 'user-force', 'test_disconnect');
          expect(count).toBe(1);
        }, 100);
      });
    });

    it('should disconnect all user devices when forced', done => {
      const token = generateAccessToken({
        userId: 'user-force-multi',
        username: 'forcemultiuser',
      });

      let disconnectedCount = 0;

      const checkDone = () => {
        disconnectedCount++;
        if (disconnectedCount === 2) {
          expect(clientSocket.connected).toBe(false);
          expect(clientSocket2.connected).toBe(false);
          done();
        }
      };

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      let clientSocket2;

      clientSocket.on('connect', () => {
        clientSocket.on('disconnect', checkDone);

        // Connect second device
        clientSocket2 = Client(`http://localhost:${TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
          clientSocket2.on('disconnect', checkDone);

          // Force disconnect all devices
          setTimeout(() => {
            const count = disconnectUser(io, 'user-force-multi', 'security_incident');
            expect(count).toBe(2);
          }, 100);
        });
      });
    });
  });

  describe('User Rooms', () => {
    it('should join user-specific room on connection', done => {
      const token = generateAccessToken({
        userId: 'user-room',
        username: 'roomuser',
      });

      let serverSocket;

      io.on('connection', socket => {
        serverSocket = socket;
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Check if socket joined user room
        setTimeout(() => {
          expect(serverSocket.rooms.has('user:user-room')).toBe(true);
          expect(serverSocket.rooms.has(serverSocket.id)).toBe(true); // Default room
          done();
        }, 100);
      });
    });

    it('should receive messages sent to user room', done => {
      const token = generateAccessToken({
        userId: 'user-room-msg',
        username: 'roommsguser',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.on('user:message', data => {
          expect(data.text).toBe('Direct message');
          done();
        });

        // Send message to user room
        setTimeout(() => {
          io.to('user:user-room-msg').emit('user:message', {
            text: 'Direct message',
          });
        }, 100);
      });
    });
  });

  describe('Connection Cleanup', () => {
    it('should clean up user connection tracking on disconnect', done => {
      const token = generateAccessToken({
        userId: 'user-cleanup',
        username: 'cleanupuser',
      });

      clientSocket = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Disconnect after a short delay
        setTimeout(() => {
          clientSocket.disconnect();
        }, 100);
      });

      clientSocket.on('disconnect', () => {
        // User connections should be cleaned up
        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });
});
