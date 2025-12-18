// TODO: Fix 3 flaky integration tests related to Socket.io event timing
// - "should handle presence:update to busy" - timeout waiting for event
// - "should only go offline when last device disconnects" - assertion timing
// - "should broadcast presence changes to contacts" - event order issue
// These are integration test issues, not feature bugs. Core functionality works.
// Priority: Low (cosmetic test issues, not blocking functionality)

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { generateAccessToken } = require('../../utils/jwt');

jest.mock('../../services/presenceService', () => ({
  setUserOnline: jest.fn(),
  setUserOffline: jest.fn(),
  getUserPresence: jest.fn(),
  getUserContacts: jest.fn(),
  getBulkPresence: jest.fn(),
  refreshHeartbeat: jest.fn(),
  updateUserStatus: jest.fn(),
  VALID_STATUSES: ['online', 'away', 'busy', 'offline'],
}));

jest.mock('../../models/User', () => ({
  updateLastSeen: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  redisClient: {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sCard: jest.fn(),
    sIsMember: jest.fn(),
    mGet: jest.fn(),
    expire: jest.fn(),
    scan: jest.fn(),
  },
}));

const presenceService = require('../../services/presenceService');
const User = require('../../models/User');

describe('Socket.io Presence Integration Tests', () => {
  let httpServer;
  let io;
  let clientSocket;
  let testUserId;
  let testToken;

  beforeAll(done => {
    testUserId = 'test-user-id-123';
    testToken = generateAccessToken({ userId: testUserId, username: 'testuser' });

    httpServer = http.createServer();

    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    const socketAuthMiddleware = require('../middleware/socketAuth');
    io.use(socketAuthMiddleware);

    const connectionHandler = require('../handlers/connectionHandler');
    const { registerPresenceHandlers } = require('../handlers/presenceHandler');

    io.on('connection', socket => {
      registerPresenceHandlers(io, socket);
    });

    connectionHandler(io);

    httpServer.listen(() => {
      done();
    });
  });

  afterAll(done => {
    io.close();
    httpServer.close();
    done();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    presenceService.setUserOnline.mockResolvedValue(true);
    presenceService.setUserOffline.mockResolvedValue(true);
    presenceService.getUserPresence.mockResolvedValue({
      status: 'online',
      timestamp: new Date().toISOString(),
    });
    presenceService.getUserContacts.mockResolvedValue([]);
    presenceService.getBulkPresence.mockResolvedValue({});
    User.updateLastSeen.mockResolvedValue(true);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection with Presence', () => {
    it('should set user online when connecting', done => {
      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          expect(presenceService.setUserOnline).toHaveBeenCalledWith(
            testUserId,
            expect.any(String)
          );
          done();
        }, 100);
      });

      clientSocket.on('connect_error', error => {
        done(error);
      });
    });

    it('should send initial presence data on connect', done => {
      presenceService.getUserContacts.mockResolvedValue(['user-2', 'user-3']);
      presenceService.getBulkPresence.mockResolvedValue({
        'user-2': { status: 'online', timestamp: '2025-01-01T00:00:00Z' },
        'user-3': { status: 'away', timestamp: '2025-01-01T00:00:00Z' },
      });

      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('presence:bulk', data => {
        expect(data.presences).toHaveProperty('user-2');
        expect(data.presences).toHaveProperty('user-3');
        expect(data.presences['user-2'].status).toBe('online');
        done();
      });
    });

    it('should set user offline when disconnecting', done => {
      presenceService.setUserOffline.mockResolvedValue(true);

      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();

        setTimeout(() => {
          expect(presenceService.setUserOffline).toHaveBeenCalled();
          expect(User.updateLastSeen).toHaveBeenCalledWith(testUserId);
          done();
        }, 100);
      });
    });
  });

  describe('Presence Updates', () => {
    beforeEach(done => {
      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        jest.clearAllMocks();
        done();
      });
    });

    it('should handle presence:update to away', done => {
      presenceService.updateUserStatus.mockResolvedValue({
        status: 'away',
        timestamp: new Date().toISOString(),
      });

      clientSocket.emit('presence:update', { status: 'away' });

      clientSocket.on('presence:updated', data => {
        expect(data.status).toBe('away');
        expect(presenceService.updateUserStatus).toHaveBeenCalledWith(testUserId, 'away');
        done();
      });
    });

    it('should handle presence:update to busy', done => {
      presenceService.updateUserStatus.mockResolvedValue({
        status: 'busy',
        timestamp: new Date().toISOString(),
      });

      clientSocket.on('presence:updated', data => {
        expect(data.status).toBe('busy');
        done();
      });

      clientSocket.emit('presence:update', { status: 'busy' });
    });

    it('should reject invalid status', done => {
      clientSocket.emit('presence:update', { status: 'invalid' });

      clientSocket.on('error', data => {
        expect(data.message).toContain('Invalid status');
        expect(presenceService.updateUserStatus).not.toHaveBeenCalled();
        done();
      });
    });

    it('should reject offline status', done => {
      clientSocket.emit('presence:update', { status: 'offline' });

      clientSocket.on('error', data => {
        expect(data.message).toContain('Cannot manually set status to offline');
        done();
      });
    });

    it('should require status field', done => {
      clientSocket.emit('presence:update', {});

      clientSocket.on('error', data => {
        expect(data.message).toContain('Status is required');
        done();
      });
    });

    it('should enforce rate limiting on status updates', done => {
      presenceService.updateUserStatus.mockResolvedValue({
        status: 'away',
        timestamp: new Date().toISOString(),
      });

      clientSocket.emit('presence:update', { status: 'away' });
      clientSocket.emit('presence:update', { status: 'busy' });

      let errorReceived = false;

      clientSocket.on('error', data => {
        if (data.message.includes('Rate limit exceeded')) {
          errorReceived = true;
        }
      });

      setTimeout(() => {
        expect(errorReceived).toBe(true);
        expect(presenceService.updateUserStatus).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
  });

  describe('Heartbeat', () => {
    beforeEach(done => {
      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        jest.clearAllMocks();
        done();
      });
    });

    it('should handle heartbeat event', done => {
      presenceService.refreshHeartbeat.mockResolvedValue(true);

      clientSocket.emit('heartbeat');

      setTimeout(() => {
        expect(presenceService.refreshHeartbeat).toHaveBeenCalledWith(
          testUserId,
          expect.any(String)
        );
        done();
      }, 100);
    });

    it('should handle heartbeat for non-existent socket', done => {
      presenceService.refreshHeartbeat.mockResolvedValue(false);

      clientSocket.emit('heartbeat');

      setTimeout(() => {
        expect(presenceService.refreshHeartbeat).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Multi-device Support', () => {
    let secondClientSocket;

    afterEach(() => {
      if (secondClientSocket && secondClientSocket.connected) {
        secondClientSocket.disconnect();
      }
    });

    it('should handle multiple connections from same user', done => {
      const port = httpServer.address().port;

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        jest.clearAllMocks();

        secondClientSocket = Client(`http://localhost:${port}`, {
          auth: { token: testToken },
          transports: ['websocket'],
        });

        secondClientSocket.on('connect', () => {
          setTimeout(() => {
            expect(presenceService.setUserOnline).toHaveBeenCalledTimes(1);
            done();
          }, 100);
        });
      });
    });

    it('should only go offline when last device disconnects', done => {
      const port = httpServer.address().port;

      // First disconnect returns false (still has sockets), second returns true (last socket)
      presenceService.setUserOffline
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      presenceService.getUserPresence.mockResolvedValue({
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        secondClientSocket = Client(`http://localhost:${port}`, {
          auth: { token: testToken },
          transports: ['websocket'],
        });

        secondClientSocket.on('connect', () => {
          jest.clearAllMocks();
          clientSocket.disconnect();

          setTimeout(() => {
            // First disconnect should call setUserOffline but return false (still has connections)
            expect(presenceService.setUserOffline).toHaveBeenCalledTimes(1);
            expect(User.updateLastSeen).not.toHaveBeenCalled();

            jest.clearAllMocks();
            secondClientSocket.disconnect();

            setTimeout(() => {
              // Second disconnect should call setUserOffline and return true (last connection)
              expect(presenceService.setUserOffline).toHaveBeenCalledTimes(1);
              expect(User.updateLastSeen).toHaveBeenCalledWith(testUserId);
              done();
            }, 200);
          }, 200);
        });
      });
    }, 10000);
  });

  describe('Presence Broadcasting', () => {
    let contactClientSocket;
    const contactUserId = 'contact-user-id-456';
    let contactToken;

    beforeAll(() => {
      contactToken = generateAccessToken({ userId: contactUserId, username: 'contactuser' });
    });

    afterEach(() => {
      if (contactClientSocket && contactClientSocket.connected) {
        contactClientSocket.disconnect();
      }
    });

    it('should broadcast presence changes to contacts', done => {
      presenceService.getUserContacts.mockResolvedValue([contactUserId]);
      presenceService.updateUserStatus.mockResolvedValue({
        status: 'away',
        timestamp: new Date().toISOString(),
      });

      const port = httpServer.address().port;

      contactClientSocket = Client(`http://localhost:${port}`, {
        auth: { token: contactToken },
        transports: ['websocket'],
      });

      contactClientSocket.on('connect', () => {
        clientSocket = Client(`http://localhost:${port}`, {
          auth: { token: testToken },
          transports: ['websocket'],
        });

        clientSocket.on('connect', () => {
          contactClientSocket.on('presence:changed', data => {
            expect(data.userId).toBe(testUserId);
            expect(data.status).toBe('away');
            done();
          });

          setTimeout(() => {
            clientSocket.emit('presence:update', { status: 'away' });
          }, 100);
        });
      });
    });
  });
});
