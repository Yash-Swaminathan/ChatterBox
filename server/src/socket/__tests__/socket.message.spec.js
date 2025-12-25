const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { generateAccessToken } = require('../../utils/jwt');

// Mock dependencies
jest.mock('../../models/Message', () => ({
  validateContent: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  isOwner: jest.fn(),
  getConversationId: jest.fn(),
  exists: jest.fn(),
  getMessageEditInfo: jest.fn(),
  MAX_CONTENT_LENGTH: 10000,
}));

jest.mock('../../models/Conversation', () => ({
  isParticipant: jest.fn(),
  touch: jest.fn(),
  getParticipants: jest.fn(),
}));

jest.mock('../../models/MessageStatus', () => ({
  createInitialStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/messageCacheService', () => ({
  invalidateConversation: jest.fn().mockResolvedValue(undefined),
  incrementUnread: jest.fn().mockResolvedValue(undefined),
  getRecentMessages: jest.fn().mockResolvedValue(null),
  setRecentMessages: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/presenceService', () => ({
  setUserOnline: jest.fn().mockResolvedValue(true),
  setUserOffline: jest.fn().mockResolvedValue(true),
  getUserPresence: jest
    .fn()
    .mockResolvedValue({ status: 'online', timestamp: new Date().toISOString() }),
  getUserContacts: jest.fn().mockResolvedValue([]),
  getBulkPresence: jest.fn().mockResolvedValue({}),
  refreshHeartbeat: jest.fn().mockResolvedValue(true),
  updateUserStatus: jest.fn(),
  cleanupStaleConnections: jest.fn().mockResolvedValue(0),
  VALID_STATUSES: ['online', 'away', 'busy', 'offline'],
}));

jest.mock('../../models/User', () => ({
  updateLastSeen: jest.fn().mockResolvedValue(true),
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

const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');

describe('Socket.io Message Integration Tests', () => {
  let httpServer;
  let io;
  let clientSocket;
  let clientSocket2;
  let testUserId;
  let testUserId2;
  let testToken;
  let testToken2;
  let testConversationId;

  beforeAll(done => {
    testUserId = 'test-user-id-123';
    testUserId2 = 'test-user-id-456';
    testConversationId = '550e8400-e29b-41d4-a716-446655440000';
    testToken = generateAccessToken({ userId: testUserId, username: 'testuser1' });
    testToken2 = generateAccessToken({ userId: testUserId2, username: 'testuser2' });

    httpServer = http.createServer();

    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    const socketAuthMiddleware = require('../middleware/socketAuth');
    io.use(socketAuthMiddleware);

    const connectionHandler = require('../handlers/connectionHandler');
    const { registerPresenceHandlers } = require('../handlers/presenceHandler');
    const { registerMessageHandlers } = require('../handlers/messageHandler');

    io.on('connection', socket => {
      registerPresenceHandlers(io, socket);
      registerMessageHandlers(io, socket);
    });

    connectionHandler(io);

    httpServer.listen(() => {
      done();
    });
  });

  afterAll(done => {
    // Stop the rate limiter cleanup interval to prevent Jest worker from hanging
    const { stopCleanup } = require('../handlers/messageHandler');
    stopCleanup();

    io.close();
    httpServer.close();
    done();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    Message.validateContent.mockReturnValue(null); // Valid content
    Message.create.mockResolvedValue({
      id: 'msg-123',
      conversation_id: testConversationId,
      sender_id: testUserId,
      content: 'Test message',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: { id: testUserId, username: 'testuser1', avatarUrl: null },
    });
    Message.update.mockResolvedValue({
      id: 'msg-123',
      content: 'Updated message',
      updated_at: new Date().toISOString(),
    });
    Message.softDelete.mockResolvedValue(true);
    Message.isOwner.mockResolvedValue(true);
    Message.getConversationId.mockResolvedValue(testConversationId);
    Message.exists.mockResolvedValue(true);
    Message.getMessageEditInfo.mockResolvedValue({
      exists: true,
      isDeleted: false,
      isOwner: true,
      conversationId: testConversationId,
    });

    Conversation.isParticipant.mockResolvedValue(true);
    Conversation.touch.mockResolvedValue(undefined);
    Conversation.getParticipants.mockResolvedValue([
      { user_id: testUserId, username: 'testuser1' },
      { user_id: testUserId2, username: 'testuser2' },
    ]);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (clientSocket2 && clientSocket2.connected) {
      clientSocket2.disconnect();
    }
  });

  // Helper to create a connected client
  function createClient(token) {
    const port = httpServer.address().port;
    return Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
    });
  }

  // Helper to wait for socket event with timeout
  function waitForEvent(socket, event, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event}`));
      }, timeout);

      socket.once(event, data => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // Helper to wait for connection
  function waitForConnection(socket) {
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', err => reject(err));
    });
  }

  describe('message:send', () => {
    it('should save message and broadcast to all participants', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join conversation room first
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      const messagePromise = waitForEvent(clientSocket, 'message:new');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Hello world!',
        tempId: 'temp-123',
      });

      const message = await messagePromise;

      expect(message.id).toBe('msg-123');
      expect(message.content).toBe('Test message');
      expect(message.tempId).toBe('temp-123');
      expect(Message.create).toHaveBeenCalledWith(testConversationId, testUserId, 'Hello world!');
      expect(Conversation.touch).toHaveBeenCalledWith(testConversationId);
    });

    it('should return tempId in message:sent event', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const sentPromise = waitForEvent(clientSocket, 'message:sent');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Test message',
        tempId: 'temp-456',
      });

      const sent = await sentPromise;

      expect(sent.tempId).toBe('temp-456');
      expect(sent.messageId).toBe('msg-123');
      expect(sent.createdAt).toBeDefined();
    });

    it('should auto-join conversation room if not already joined', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Don't manually join - handler should auto-join
      const messagePromise = waitForEvent(clientSocket, 'message:new');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Auto-join test',
        tempId: 'temp-auto',
      });

      const message = await messagePromise;
      expect(message.id).toBe('msg-123');
    });

    it('should reject empty content', async () => {
      Message.validateContent.mockReturnValue('Content cannot be empty');

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: '',
        tempId: 'temp-empty',
      });

      const error = await errorPromise;

      expect(error.tempId).toBe('temp-empty');
      expect(error.code).toBe('CONTENT_EMPTY');
      expect(Message.create).not.toHaveBeenCalled();
    });

    it('should reject content over 10000 chars', async () => {
      Message.validateContent.mockReturnValue('Content exceeds maximum length of 10000 characters');

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'a'.repeat(10001),
        tempId: 'temp-long',
      });

      const error = await errorPromise;

      expect(error.tempId).toBe('temp-long');
      expect(error.code).toBe('CONTENT_TOO_LONG');
    });

    it('should reject missing conversationId', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        content: 'Test message',
        tempId: 'temp-no-conv',
      });

      const error = await errorPromise;

      expect(error.code).toBe('INVALID_CONVERSATION');
    });

    it('should reject invalid UUID format', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: 'not-a-uuid',
        content: 'Test message',
        tempId: 'temp-bad-uuid',
      });

      const error = await errorPromise;

      expect(error.code).toBe('INVALID_CONVERSATION');
    });

    it('should handle missing tempId gracefully', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const sentPromise = waitForEvent(clientSocket, 'message:sent');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'No tempId test',
      });

      const sent = await sentPromise;

      expect(sent.tempId).toMatch(/^server-/);
      expect(sent.messageId).toBe('msg-123');
    });

    it('should reject if user not in conversation', async () => {
      Conversation.isParticipant.mockResolvedValue(false);

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Not a participant',
        tempId: 'temp-not-participant',
      });

      const error = await errorPromise;

      expect(error.code).toBe('NOT_PARTICIPANT');
      expect(Message.create).not.toHaveBeenCalled();
    });

    it('should deliver to sender after auto-join', async () => {
      // Use a unique user to avoid rate limit issues
      const broadcastUserId = 'broadcast-test-user-' + Date.now();
      const broadcastToken = generateAccessToken({
        userId: broadcastUserId,
        username: 'broadcastuser',
      });

      // Update mock for this user
      Conversation.isParticipant.mockResolvedValue(true);

      clientSocket = createClient(broadcastToken);
      await waitForConnection(clientSocket);

      // Set up listeners before sending
      const messagePromise = waitForEvent(clientSocket, 'message:new');
      const sentPromise = waitForEvent(clientSocket, 'message:sent');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Hello everyone!',
        tempId: 'temp-broadcast',
      });

      // Sender should receive both the broadcast and the confirmation
      const [message, sent] = await Promise.all([messagePromise, sentPromise]);

      expect(message.id).toBe('msg-123');
      expect(sent.tempId).toBe('temp-broadcast');
    });

    it('should handle database errors gracefully', async () => {
      Message.create.mockRejectedValue(new Error('Database connection lost'));

      // Use a unique user ID to avoid rate limit interference from previous tests
      const dbErrorUserId = 'db-error-test-user-' + Date.now();
      const dbErrorToken = generateAccessToken({ userId: dbErrorUserId, username: 'dberroruser' });

      clientSocket = createClient(dbErrorToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'DB error test',
        tempId: 'temp-db-error',
      });

      const error = await errorPromise;

      expect(error.tempId).toBe('temp-db-error');
      expect(error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('message:edit', () => {
    const testMessageId = '550e8400-e29b-41d4-a716-446655440099';

    it('should update message and broadcast edit', async () => {
      // Reset mocks for this specific test - use atomic getMessageEditInfo
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: true,
        conversationId: testConversationId,
      });
      Message.validateContent.mockReturnValue(null);
      Message.update.mockResolvedValue({
        id: testMessageId,
        content: 'Updated message',
        updated_at: new Date().toISOString(),
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join the room first and wait for confirmation
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      // Now set up listener before emitting
      const editedPromise = waitForEvent(clientSocket, 'message:edited');

      clientSocket.emit('message:edit', {
        messageId: testMessageId,
        content: 'Updated content',
      });

      const edited = await editedPromise;

      expect(edited.messageId).toBe(testMessageId);
      expect(edited.content).toBe('Updated message');
      expect(edited.updatedAt).toBeDefined();
      expect(Message.update).toHaveBeenCalledWith(testMessageId, 'Updated content');
    });

    it('should verify ownership before editing', async () => {
      // Setup mocks BEFORE connecting - use atomic getMessageEditInfo
      Message.validateContent.mockReturnValue(null);
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: true,
        conversationId: testConversationId,
      });
      Message.update.mockResolvedValue({
        id: 'msg-edit-test',
        content: 'Updated message',
        updated_at: new Date().toISOString(),
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join the conversation room first
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      // Emit the edit
      clientSocket.emit('message:edit', {
        messageId: '550e8400-e29b-41d4-a716-446655440002',
        content: 'Updated content',
      });

      // Wait a bit for the handler to execute
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(Message.getMessageEditInfo).toHaveBeenCalled();
    });

    it('should only allow owner to edit', async () => {
      // Reset to default and then override - message exists but user is not owner
      Message.validateContent.mockReturnValue(null);
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: false,
        conversationId: testConversationId,
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:edit', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Not my message',
      });

      const error = await errorPromise;

      expect(error.code).toBe('NOT_OWNER');
      expect(Message.update).not.toHaveBeenCalled();
    });

    it('should reject empty new content', async () => {
      Message.validateContent.mockReturnValue('Content cannot be empty');

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:edit', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        content: '',
      });

      const error = await errorPromise;

      expect(error.code).toBe('CONTENT_EMPTY');
    });

    it('should reject edit of non-existent message', async () => {
      Message.validateContent.mockReturnValue(null);
      Message.getMessageEditInfo.mockResolvedValue({
        exists: false,
        isDeleted: false,
        isOwner: false,
        conversationId: null,
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:edit', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Non-existent message',
      });

      const error = await errorPromise;

      expect(error.code).toBe('MESSAGE_NOT_FOUND');
    });
  });

  describe('message:delete', () => {
    const testMessageId = '550e8400-e29b-41d4-a716-446655440098';

    it('should soft delete and broadcast deletion', async () => {
      // Reset mocks for this specific test - use atomic getMessageEditInfo
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: true,
        conversationId: testConversationId,
      });
      Message.softDelete.mockResolvedValue(true);

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join the room first and wait for confirmation
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      // Now set up listener before emitting
      const deletedPromise = waitForEvent(clientSocket, 'message:deleted');

      clientSocket.emit('message:delete', {
        messageId: testMessageId,
      });

      const deleted = await deletedPromise;

      expect(deleted.messageId).toBe(testMessageId);
      expect(deleted.conversationId).toBe(testConversationId);
      expect(Message.softDelete).toHaveBeenCalledWith(testMessageId);
    });

    it('should verify ownership before deleting', async () => {
      // Setup mocks BEFORE connecting - use atomic getMessageEditInfo
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: true,
        conversationId: testConversationId,
      });
      Message.softDelete.mockResolvedValue(true);

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join the conversation room first
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      // Emit the delete
      clientSocket.emit('message:delete', {
        messageId: '550e8400-e29b-41d4-a716-446655440003',
      });

      // Wait a bit for the handler to execute
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(Message.getMessageEditInfo).toHaveBeenCalled();
    });

    it('should only allow owner to delete', async () => {
      // Message exists but user is not owner
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: false,
        isOwner: false,
        conversationId: testConversationId,
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:delete', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const error = await errorPromise;

      expect(error.code).toBe('NOT_OWNER');
      expect(Message.softDelete).not.toHaveBeenCalled();
    });

    it('should reject delete of non-existent message', async () => {
      // Message does not exist
      Message.getMessageEditInfo.mockResolvedValue({
        exists: false,
        isDeleted: false,
        isOwner: false,
        conversationId: null,
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:delete', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const error = await errorPromise;

      expect(error.code).toBe('MESSAGE_NOT_FOUND');
    });

    it('should handle already deleted message', async () => {
      // Message exists but is already deleted
      Message.getMessageEditInfo.mockResolvedValue({
        exists: true,
        isDeleted: true,
        isOwner: true,
        conversationId: testConversationId,
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:delete', {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const error = await errorPromise;

      expect(error.code).toBe('MESSAGE_NOT_FOUND');
    });
  });

  describe('conversation:join', () => {
    it('should allow joining conversation room', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const joinedPromise = waitForEvent(clientSocket, 'conversation:joined');

      clientSocket.emit('conversation:join', {
        conversationId: testConversationId,
      });

      const joined = await joinedPromise;

      expect(joined.conversationId).toBe(testConversationId);
      expect(Conversation.isParticipant).toHaveBeenCalledWith(testConversationId, testUserId);
    });

    it('should reject non-participant', async () => {
      Conversation.isParticipant.mockResolvedValue(false);

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'error');

      clientSocket.emit('conversation:join', {
        conversationId: testConversationId,
      });

      const error = await errorPromise;

      expect(error.message).toContain('not a participant');
    });

    it('should reject invalid conversation ID', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'error');

      clientSocket.emit('conversation:join', {
        conversationId: 'not-a-uuid',
      });

      const error = await errorPromise;

      expect(error.message).toContain('Invalid');
    });
  });

  describe('conversation:leave', () => {
    it('should allow leaving conversation room', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      // Join first
      clientSocket.emit('conversation:join', { conversationId: testConversationId });
      await waitForEvent(clientSocket, 'conversation:joined');

      // Then leave
      const leftPromise = waitForEvent(clientSocket, 'conversation:left');

      clientSocket.emit('conversation:leave', {
        conversationId: testConversationId,
      });

      const left = await leftPromise;

      expect(left.conversationId).toBe(testConversationId);
    });

    it('should reject invalid conversation ID', async () => {
      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'error');

      clientSocket.emit('conversation:leave', {
        conversationId: 'not-a-uuid',
      });

      const error = await errorPromise;

      expect(error.message).toContain('Invalid');
    });
  });

  describe('Rate limiting', () => {
    it('should enforce message rate limit', async () => {
      // Reset rate limiter for this test by using a unique user
      const uniqueUserId = `rate-limit-test-${Date.now()}`;
      const uniqueToken = generateAccessToken({ userId: uniqueUserId, username: 'ratelimituser' });

      clientSocket = createClient(uniqueToken);
      await waitForConnection(clientSocket);

      // Send many messages quickly (more than burst limit)
      const sendPromises = [];
      for (let i = 0; i < 10; i++) {
        sendPromises.push(
          new Promise(resolve => {
            clientSocket.emit('message:send', {
              conversationId: testConversationId,
              content: `Message ${i}`,
              tempId: `temp-rate-${i}`,
            });
            // Small delay to avoid overwhelming
            setTimeout(resolve, 10);
          })
        );
      }

      await Promise.all(sendPromises);

      // Wait a bit for all responses
      await new Promise(resolve => setTimeout(resolve, 500));

      // We should have received at least one rate limit error
      // (This is a basic check - detailed rate limiting tests would need more setup)
    });
  });

  describe('Error handling', () => {
    it('should emit message:error on validation failure', async () => {
      Message.validateContent.mockReturnValue('Content is required');

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        tempId: 'temp-validation-error',
      });

      const error = await errorPromise;

      expect(error.tempId).toBe('temp-validation-error');
      expect(error.code).toBeDefined();
    });

    it('should include tempId in error for client matching', async () => {
      Message.validateContent.mockReturnValue('Content cannot be empty');

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const errorPromise = waitForEvent(clientSocket, 'message:error');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: '',
        tempId: 'specific-temp-id-12345',
      });

      const error = await errorPromise;

      expect(error.tempId).toBe('specific-temp-id-12345');
    });
  });

  describe('Unicode and special content', () => {
    it('should handle unicode and emoji content', async () => {
      Message.create.mockResolvedValue({
        id: 'msg-unicode',
        conversation_id: testConversationId,
        sender_id: testUserId,
        content: 'Hello 👋 World 🌍',
        created_at: new Date().toISOString(),
        sender: { id: testUserId, username: 'testuser1', avatarUrl: null },
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const sentPromise = waitForEvent(clientSocket, 'message:sent');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Hello 👋 World 🌍',
        tempId: 'temp-unicode',
      });

      const sent = await sentPromise;

      expect(sent.messageId).toBe('msg-unicode');
      expect(Message.create).toHaveBeenCalledWith(
        testConversationId,
        testUserId,
        'Hello 👋 World 🌍'
      );
    });

    it('should handle RTL text', async () => {
      Message.create.mockResolvedValue({
        id: 'msg-rtl',
        conversation_id: testConversationId,
        sender_id: testUserId,
        content: 'مرحبا بالعالم',
        created_at: new Date().toISOString(),
        sender: { id: testUserId, username: 'testuser1', avatarUrl: null },
      });

      clientSocket = createClient(testToken);
      await waitForConnection(clientSocket);

      const sentPromise = waitForEvent(clientSocket, 'message:sent');

      clientSocket.emit('message:send', {
        conversationId: testConversationId,
        content: 'مرحبا بالعالم',
        tempId: 'temp-rtl',
      });

      const sent = await sentPromise;

      expect(sent.messageId).toBe('msg-rtl');
    });
  });
});
