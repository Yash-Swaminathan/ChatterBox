jest.mock('../../models/Conversation');
jest.mock('../../models/User');
jest.mock('../../services/presenceService', () => ({
  getBulkPresence: jest.fn(),
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
const { getBulkPresence } = require('../../services/presenceService');

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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'offline' } });

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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

      // Make requests in parallel for faster test execution
      const requests = Array.from({ length: 65 }, () =>
        request(app)
          .post('/api/conversations/direct')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ participantId: otherUserId })
      );

      const responses = await Promise.all(requests);

      // Verify all requests succeeded (rate limiting bypassed in test env)
      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    }, 30000);
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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

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

      getBulkPresence.mockResolvedValue({
        'user-1': { status: 'online' },
        'user-2': { status: 'away' },
      });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.conversations[0].participants[0].status).toBe('online');
      expect(response.body.conversations[0].participants[1].status).toBe('away');
      expect(getBulkPresence).toHaveBeenCalledTimes(1);
      expect(getBulkPresence).toHaveBeenCalledWith(['user-1', 'user-2']);
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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

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

      getBulkPresence.mockResolvedValue({ [otherUserId]: { status: 'online' } });

      const response = await request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ participantId: otherUserId })
        .expect(201);

      expect(response.body.conversation.participants[0].username).toBe('🚀 test user 👍');
    });
  });

  describe('POST /api/conversations/group', () => {
    let creatorId;
    let user2Id;
    let user3Id;
    let creatorToken;

    beforeAll(() => {
      creatorId = '550e8400-e29b-41d4-a716-446655440010';
      user2Id = '550e8400-e29b-41d4-a716-446655440011';
      user3Id = '550e8400-e29b-41d4-a716-446655440012';
      creatorToken = generateAccessToken({
        userId: creatorId,
        username: 'creator',
        email: 'creator@example.com',
      });
    });

    beforeEach(() => {
      jest.clearAllMocks();
      User.findByIds = jest.fn();
      Conversation.createGroup = jest.fn();
      Conversation.findById = jest.fn();
      getBulkPresence.mockResolvedValue({
        [creatorId]: { status: 'online' },
        [user2Id]: { status: 'offline' },
        [user3Id]: { status: 'online' },
      });
    });

    it('should create group with provided name', async () => {
      const participantIds = [creatorId, user2Id, user3Id];

      User.findByIds.mockResolvedValue([
        { id: creatorId, username: 'creator' },
        { id: user2Id, username: 'user2' },
        { id: user3Id, username: 'user3' },
      ]);

      Conversation.createGroup.mockResolvedValue({
        conversation: {
          id: 'group-123',
          type: 'group',
          name: 'Project Team',
          created_by: creatorId,
        },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'group-123',
        type: 'group',
        name: 'Project Team',
        created_by: creatorId,
        participants: [
          { userId: creatorId, username: 'creator' },
          { userId: user2Id, username: 'user2' },
          { userId: user3Id, username: 'user3' },
        ],
      });

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          participantIds,
          name: 'Project Team',
        })
        .expect(201);

      expect(response.body.conversation).toBeDefined();
      expect(response.body.conversation.name).toBe('Project Team');
      expect(response.body.conversation.type).toBe('group');
      expect(response.body.created).toBe(true);
      expect(User.findByIds).toHaveBeenCalledWith(participantIds);
      expect(Conversation.createGroup).toHaveBeenCalledWith(creatorId, participantIds, {
        name: 'Project Team',
        avatarUrl: undefined,
      });
    });

    it('should create group with auto-generated name if not provided', async () => {
      const participantIds = [creatorId, user2Id, user3Id];

      User.findByIds.mockResolvedValue([
        { id: creatorId, username: 'alice' },
        { id: user2Id, username: 'bob' },
        { id: user3Id, username: 'carol' },
      ]);

      Conversation.createGroup.mockResolvedValue({
        conversation: {
          id: 'group-456',
          type: 'group',
          name: 'alice, bob, and 1 other', // Auto-generated
          created_by: creatorId,
        },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'group-456',
        type: 'group',
        name: 'alice, bob, and 1 other',
        created_by: creatorId,
        participants: [
          { userId: creatorId, username: 'alice' },
          { userId: user2Id, username: 'bob' },
          { userId: user3Id, username: 'carol' },
        ],
      });

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds })
        .expect(201);

      expect(response.body.conversation.name).toBe('alice, bob, and 1 other');
      expect(Conversation.createGroup).toHaveBeenCalledWith(creatorId, participantIds, {
        name: undefined,
        avatarUrl: undefined,
      });
    });

    it('should reject if creator not in participantIds', async () => {
      const user4Id = '550e8400-e29b-41d4-a716-446655440013';
      const participantIds = [user2Id, user3Id, user4Id]; // Missing creator (but has 3 participants)

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('Creator must be included');
    });

    it('should reject if less than 3 participants', async () => {
      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds: [creatorId, user2Id] })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('at least 3 participants');
    });

    it('should reject if participant not found', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';
      const participantIds = [creatorId, user2Id, nonExistentId];

      User.findByIds.mockResolvedValue([
        { id: creatorId, username: 'creator' },
        { id: user2Id, username: 'user2' },
        // nonExistentId not in results
      ]);

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('User(s) not found');
    });

    it('should reject if participantIds has duplicates', async () => {
      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds: [creatorId, user2Id, user2Id] })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('must not contain duplicates');
    });

    it('should reject if more than 100 participants', async () => {
      const tooManyParticipants = Array(101)
        .fill()
        .map((_, i) => `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`);

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds: tooManyParticipants })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('cannot have more than 100 participants');
    });

    it('should reject if name is empty string', async () => {
      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          participantIds: [creatorId, user2Id, user3Id],
          name: '   ', // Only whitespace
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('must not be empty');
    });

    it('should reject if name exceeds 100 characters', async () => {
      const longName = 'A'.repeat(101);

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          participantIds: [creatorId, user2Id, user3Id],
          name: longName,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('must not exceed 100 characters');
    });

    it('should reject if avatarUrl is invalid', async () => {
      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          participantIds: [creatorId, user2Id, user3Id],
          avatarUrl: 'not-a-valid-url',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('must be a valid URL');
    });

    it('should create group with avatarUrl', async () => {
      const participantIds = [creatorId, user2Id, user3Id];
      const avatarUrl = 'https://example.com/avatar.png';

      User.findByIds.mockResolvedValue([
        { id: creatorId, username: 'creator' },
        { id: user2Id, username: 'user2' },
        { id: user3Id, username: 'user3' },
      ]);

      Conversation.createGroup.mockResolvedValue({
        conversation: {
          id: 'group-789',
          type: 'group',
          name: 'Team',
          avatar_url: avatarUrl,
          created_by: creatorId,
        },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'group-789',
        type: 'group',
        name: 'Team',
        avatar_url: avatarUrl,
        created_by: creatorId,
        participants: [
          { userId: creatorId, username: 'creator' },
          { userId: user2Id, username: 'user2' },
          { userId: user3Id, username: 'user3' },
        ],
      });

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds, name: 'Team', avatarUrl })
        .expect(201);

      expect(response.body.conversation.avatar_url).toBe(avatarUrl);
      expect(Conversation.createGroup).toHaveBeenCalledWith(creatorId, participantIds, {
        name: 'Team',
        avatarUrl,
      });
    });

    it('should enrich participants with presence data', async () => {
      const participantIds = [creatorId, user2Id, user3Id];

      User.findByIds.mockResolvedValue([
        { id: creatorId, username: 'creator' },
        { id: user2Id, username: 'user2' },
        { id: user3Id, username: 'user3' },
      ]);

      Conversation.createGroup.mockResolvedValue({
        conversation: { id: 'group-presence', type: 'group', name: 'Test' },
        created: true,
      });

      Conversation.findById.mockResolvedValue({
        id: 'group-presence',
        type: 'group',
        name: 'Test',
        participants: [
          { userId: creatorId, username: 'creator' },
          { userId: user2Id, username: 'user2' },
          { userId: user3Id, username: 'user3' },
        ],
      });

      const response = await request(app)
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ participantIds, name: 'Test' })
        .expect(201);

      expect(response.body.conversation.participants[0].status).toBe('online');
      expect(response.body.conversation.participants[1].status).toBe('offline');
      expect(response.body.conversation.participants[2].status).toBe('online');
      expect(getBulkPresence).toHaveBeenCalledWith(participantIds);
    });
  });
});
