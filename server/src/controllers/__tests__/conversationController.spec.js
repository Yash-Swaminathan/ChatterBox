jest.mock('../../models/Conversation');
jest.mock('../../models/User');
jest.mock('../../services/presenceService', () => ({
  getUserPresence: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { generateAccessToken } = require('../../utils/jwt');
const Conversation = require('../../models/Conversation');
const User = require('../../models/User');
const { getUserPresence: presenceServiceGetUserPresence } = require('../../services/presenceService');

describe('Conversation Controller Integration Tests', () => {
  let authToken;
  let userId;
  let otherUserId;

  beforeAll(() => {
    userId = '550e8400-e29b-41d4-a716-446655440000';
    otherUserId = '550e8400-e29b-41d4-a716-446655440001';
    authToken = generateAccessToken({
      userId,
      username: 'testuser',
      email: 'test@example.com',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById = jest.fn();
    Conversation.getOrCreateDirect = jest.fn();
    Conversation.findById = jest.fn();
    Conversation.findByUser = jest.fn();
  });

  describe('POST /api/conversations/direct', () => {
    it('should create new direct conversation', async () => {
      User.findById.mockResolvedValue({
        id: otherUserId,
        username: 'otheruser',
        email: 'other@example.com',
      });

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: 'conv-123', type: 'direct' },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'conv-123',
        type: 'direct',
        participants: [
          {
            userId: otherUserId,
            username: 'otheruser',
            email: 'other@example.com',
          },
        ],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(201);

      expect(response.body.conversation).toBeDefined();
      expect(response.body.conversation.id).toBe('conv-123');
      expect(response.body.created).toBe(true);
      expect(response.body.conversation.participants[0].status).toBe('online');
      expect(User.findById).toHaveBeenCalledWith(otherUserId);
      expect(Conversation.getOrCreateDirect).toHaveBeenCalledWith(userId, otherUserId);
    });

    it('should return existing conversation if already exists', async () => {
      User.findById.mockResolvedValue({
        id: otherUserId,
        username: 'otheruser',
        email: 'other@example.com',
      });

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: 'conv-existing', type: 'direct' },
        created: false,
      });

      Conversation.findById.mockResolvedValue({
        id: 'conv-existing',
        type: 'direct',
        participants: [
          {
            userId: otherUserId,
            username: 'otheruser',
          },
        ],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'offline' });

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(200);

      expect(response.body.conversation.id).toBe('conv-existing');
      expect(response.body.created).toBe(false);
    });

    it('should reject creating conversation with yourself', async () => {
      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: userId })
        .expect(400);

      expect(response.body.message).toContain('yourself');
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should return 404 if participant user not found', async () => {
      User.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(404);

      expect(response.body.message).toContain('not found');
      expect(Conversation.getOrCreateDirect).not.toHaveBeenCalled();
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: 'invalid-uuid' })
        .expect(400);

      expect(response.body.message).toContain('UUID');
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should reject missing participantId', async () => {
      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('required');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/conversations/direct')
        .send({ participantId: otherUserId })
        .expect(401);

      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      User.findById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(500);

      expect(response.body.message).toContain('Failed to create conversation');
    });

    it('should skip rate limiting in test environment', async () => {
      User.findById.mockResolvedValue({
        id: otherUserId,
        username: 'otheruser',
      });

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: 'conv-123', type: 'direct' },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'conv-123',
        type: 'direct',
        participants: [{ userId: otherUserId }],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      for (let i = 0; i < 65; i++) {
        const response = await request(app)
          .post('/api/conversations/direct')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ participantId: otherUserId });

        expect(response.status).not.toBe(429);
      }
    });
  });

  describe('GET /api/conversations', () => {
    it('should return user conversations', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: [
          {
            id: 'conv-1',
            type: 'direct',
            participants: [
              {
                userId: otherUserId,
                username: 'otheruser',
              },
            ],
          },
        ],
        total: 1,
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].id).toBe('conv-1');
      expect(response.body.conversations[0].participants[0].status).toBe('online');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should return empty array if user has no conversations', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: [],
        total: 0,
      });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should respect limit and offset parameters', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: [],
        total: 50,
      });

      const response = await request(app)
        .get('/api/conversations?limit=10&offset=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Conversation.findByUser).toHaveBeenCalledWith(userId, {
        limit: 10,
        offset: 5,
        type: undefined,
      });

      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(5);
      expect(response.body.pagination.total).toBe(50);
    });

    it('should filter by type when provided', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: [],
        total: 0,
      });

      await request(app)
        .get('/api/conversations?type=direct')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Conversation.findByUser).toHaveBeenCalledWith(userId, {
        limit: 20,
        offset: 0,
        type: 'direct',
      });
    });

    it('should reject invalid limit', async () => {
      let response = await request(app)
        .get('/api/conversations?limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('limit');

      response = await request(app)
        .get('/api/conversations?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('limit');
    });

    it('should reject invalid offset', async () => {
      const response = await request(app)
        .get('/api/conversations?offset=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('offset');
    });

    it('should reject invalid type', async () => {
      const response = await request(app)
        .get('/api/conversations?type=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('type');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/conversations').expect(401);

      expect(Conversation.findByUser).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      Conversation.findByUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.message).toContain('Failed to retrieve conversations');
    });

    it('should calculate hasMore pagination flag correctly', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: new Array(20).fill({ id: 'conv', type: 'direct', participants: [] }),
        total: 50,
      });

      let response = await request(app)
        .get('/api/conversations?limit=20&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.hasMore).toBe(true);

      Conversation.findByUser.mockResolvedValue({
        conversations: new Array(10).fill({ id: 'conv', type: 'direct', participants: [] }),
        total: 50,
      });

      response = await request(app)
        .get('/api/conversations?limit=20&offset=40')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should include participant online status', async () => {
      Conversation.findByUser.mockResolvedValue({
        conversations: [
          {
            id: 'conv-1',
            type: 'direct',
            participants: [
              { userId: 'user-1', username: 'user1' },
              { userId: 'user-2', username: 'user2' },
            ],
          },
        ],
        total: 1,
      });

      presenceServiceGetUserPresence
        .mockResolvedValueOnce({ status: 'online' })
        .mockResolvedValueOnce({ status: 'away' });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations[0].participants[0].status).toBe('online');
      expect(response.body.conversations[0].participants[1].status).toBe('away');
      expect(presenceServiceGetUserPresence).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should prevent duplicate conversations between same users', async () => {
      const conversationId = 'conv-same';

      User.findById.mockResolvedValue({
        id: otherUserId,
        username: 'otheruser',
      });

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: conversationId, type: 'direct' },
        created: false,
      });

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'direct',
        participants: [{ userId: otherUserId }],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      const response1 = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId });

      const otherUserToken = generateAccessToken({
        userId: otherUserId,
        username: 'otheruser',
        email: 'other@example.com',
      });

      User.findById.mockResolvedValue({
        id: userId,
        username: 'testuser',
      });

      const response2 = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ participantId: userId });

      expect(response1.body.conversation.id).toBe(conversationId);
      expect(response2.body.conversation.id).toBe(conversationId);
    });

    it('should handle concurrent conversation creation', async () => {
      User.findById.mockResolvedValue({
        id: otherUserId,
        username: 'otheruser',
      });

      const conversationId = 'conv-concurrent';

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: conversationId, type: 'direct' },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'direct',
        participants: [{ userId: otherUserId }],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/conversations/direct')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ participantId: otherUserId }),
        request(app)
          .post('/api/conversations/direct')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ participantId: otherUserId }),
      ]);

      expect(response1.body.conversation.id).toBe(conversationId);
      expect(response2.body.conversation.id).toBe(conversationId);
    });

    it('should handle special characters in usernames', async () => {
      User.findById.mockResolvedValue({
        id: otherUserId,
        username: '🚀 test user 👍',
        email: 'emoji@example.com',
      });

      Conversation.getOrCreateDirect.mockResolvedValue({
        conversation: { id: 'conv-emoji', type: 'direct' },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'conv-emoji',
        type: 'direct',
        participants: [
          {
            userId: otherUserId,
            username: '🚀 test user 👍',
          },
        ],
      });

      presenceServiceGetUserPresence.mockResolvedValue({ status: 'online' });

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(201);

      expect(response.body.conversation.participants[0].username).toBe('🚀 test user 👍');
    });
  });
});
