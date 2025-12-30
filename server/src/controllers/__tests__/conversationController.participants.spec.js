jest.mock('../../models/Conversation');
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
const { getBulkPresence } = require('../../services/presenceService');
const { pool } = require('../../config/database');
const { closeRedis } = require('../../config/redis');

describe('GET /api/conversations/:conversationId/participants', () => {
  let authToken;
  let userId;
  let conversationId;

  beforeAll(() => {
    userId = '550e8400-e29b-41d4-a716-446655440000';
    conversationId = '550e8400-e29b-41d4-a716-446655440099'; // Valid UUID (no prefix)
    authToken = generateAccessToken({
      userId,
      username: 'testuser',
      email: 'test@example.com',
    });
  });

  afterAll(async () => {
    // Close database connections to prevent Jest warning
    await pool.end();
    // Close Redis connection
    await closeRedis();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return all participants for a group conversation', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: 'https://example.com/avatar1.jpg',
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
        {
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          username: 'alice',
          display_name: 'Alice Smith',
          avatar_url: 'https://example.com/avatar2.jpg',
          is_admin: false,
          joined_at: '2025-12-29T10:01:00Z',
        },
        {
          user_id: '550e8400-e29b-41d4-a716-446655440002',
          username: 'bob',
          display_name: 'Bob Jones',
          avatar_url: null,
          is_admin: false,
          joined_at: '2025-12-29T10:02:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
        name: 'Test Group',
      });

      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);

      getBulkPresence.mockResolvedValue({
        [userId]: { status: 'online', lastSeen: null },
        '550e8400-e29b-41d4-a716-446655440001': {
          status: 'away',
          lastSeen: '2025-12-29T11:00:00Z',
        },
        '550e8400-e29b-41d4-a716-446655440002': {
          status: 'offline',
          lastSeen: '2025-12-29T09:00:00Z',
        },
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).toHaveLength(3);
      expect(response.body.data.totalCount).toBe(3);

      // Verify first participant (admin)
      const admin = response.body.data.participants[0];
      expect(admin.userId).toBe(userId);
      expect(admin.username).toBe('testuser');
      expect(admin.isAdmin).toBe(true);
      expect(admin.presenceStatus).toBe('online');
      expect(admin.lastSeen).toBeNull();

      // Verify second participant
      const alice = response.body.data.participants[1];
      expect(alice.userId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(alice.isAdmin).toBe(false);
      expect(alice.presenceStatus).toBe('away');
      expect(alice.lastSeen).toBe('2025-12-29T11:00:00Z');

      // Verify batch presence lookup was called
      expect(getBulkPresence).toHaveBeenCalledWith([
        userId,
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ]);
    });

    it('should work for direct conversations (2 participants)', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null,
          is_admin: false,
          joined_at: '2025-12-29T10:00:00Z',
        },
        {
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          username: 'alice',
          display_name: 'Alice Smith',
          avatar_url: null,
          is_admin: false,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'direct',
      });

      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);

      getBulkPresence.mockResolvedValue({
        [userId]: { status: 'online', lastSeen: null },
        '550e8400-e29b-41d4-a716-446655440001': {
          status: 'online',
          lastSeen: null,
        },
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).toHaveLength(2);
      expect(response.body.data.totalCount).toBe(2);
    });

    it('should return admin role correctly (creator is admin)', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'creator',
          display_name: 'Creator',
          avatar_url: null,
          is_admin: true, // Creator is admin
          joined_at: '2025-12-29T10:00:00Z',
        },
        {
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          username: 'member',
          display_name: 'Member',
          avatar_url: null,
          is_admin: false, // Regular member
          joined_at: '2025-12-29T10:01:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const admin = response.body.data.participants.find(p => p.isAdmin);
      const member = response.body.data.participants.find(p => !p.isAdmin);

      expect(admin.userId).toBe(userId);
      expect(member.userId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should filter out participants who left (left_at NOT NULL)', async () => {
      // Model method getParticipants already filters with "WHERE left_at IS NULL"
      // So this test verifies that left participants are not returned
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
        // User who left is NOT in the results (filtered by model)
      ];

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Only 1 participant (the one who didn't leave)
      expect(response.body.data.participants).toHaveLength(1);
      expect(response.body.data.participants[0].userId).toBe(userId);
    });

    it('should enrich participants with presence status (batch lookup)', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'user1',
          display_name: 'User 1',
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
        {
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          username: 'user2',
          display_name: 'User 2',
          avatar_url: null,
          is_admin: false,
          joined_at: '2025-12-29T10:01:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);

      getBulkPresence.mockResolvedValue({
        [userId]: { status: 'online', lastSeen: null },
        '550e8400-e29b-41d4-a716-446655440001': {
          status: 'offline',
          lastSeen: '2025-12-29T09:00:00Z',
        },
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants[0].presenceStatus).toBe('online');
      expect(response.body.data.participants[0].lastSeen).toBeNull();
      expect(response.body.data.participants[1].presenceStatus).toBe('offline');
      expect(response.body.data.participants[1].lastSeen).toBe('2025-12-29T09:00:00Z');

      // Verify batch lookup was called (not N+1 queries)
      expect(getBulkPresence).toHaveBeenCalledTimes(1);
    });

    it('should default presence to offline if not found in presence service', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);

      // Presence service returns empty object (user not found)
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants[0].presenceStatus).toBe('offline');
      expect(response.body.data.participants[0].lastSeen).toBeNull();
    });
  });

  describe('Error Cases', () => {
    it('should return 404 if conversation does not exist', async () => {
      Conversation.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should return 403 if requester is not a participant', async () => {
      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      Conversation.isParticipant.mockResolvedValue(false); // User not a participant

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toBe('You are not a participant in this conversation');
    });

    it('should return 401 if no authentication token provided', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should return 400 if conversationId is not a valid UUID', async () => {
      const response = await request(app)
        .get('/api/conversations/invalid-uuid/participants')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('valid UUID');
    });

    it('should return 500 if database error occurs', async () => {
      Conversation.findById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to retrieve participants');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty group (only creator left)', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'creator',
          display_name: 'Creator',
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);
    });

    it('should handle participants with null avatar URLs', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null, // Null avatar
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants[0].avatarUrl).toBeNull();
    });

    it('should handle participants with null display names', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: null, // Null display name
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({});

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants[0].displayName).toBeNull();
    });

    it('should handle large groups (50+ participants)', async () => {
      // Generate 50 participants
      const mockParticipants = Array.from({ length: 50 }, (_, i) => ({
        user_id: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`,
        username: `user${i}`,
        display_name: `User ${i}`,
        avatar_url: null,
        is_admin: i === 0, // First user is admin
        joined_at: '2025-12-29T10:00:00Z',
      }));

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({}); // All offline

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.participants).toHaveLength(50);
      expect(response.body.data.totalCount).toBe(50);

      // Verify batch presence lookup was called once (not 50 times)
      expect(getBulkPresence).toHaveBeenCalledTimes(1);
    });

    it('should handle presence service errors gracefully', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: null,
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);

      // Presence service throws error
      getBulkPresence.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should still return participants with default offline status
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).toHaveLength(1);
      expect(response.body.data.participants[0].presenceStatus).toBe('offline');
      expect(response.body.data.participants[0].lastSeen).toBeNull();
    });
  });

  describe('Response Format Validation', () => {
    it('should return correct response structure', async () => {
      const mockParticipants = [
        {
          user_id: userId,
          username: 'testuser',
          display_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
          is_admin: true,
          joined_at: '2025-12-29T10:00:00Z',
        },
      ];

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });
      Conversation.isParticipant.mockResolvedValue(true);
      Conversation.getParticipants.mockResolvedValue(mockParticipants);
      getBulkPresence.mockResolvedValue({
        [userId]: { status: 'online', lastSeen: null },
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate top-level structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);

      // Validate data structure
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(Array.isArray(response.body.data.participants)).toBe(true);

      // Validate participant object structure
      const participant = response.body.data.participants[0];
      expect(participant).toHaveProperty('userId');
      expect(participant).toHaveProperty('username');
      expect(participant).toHaveProperty('displayName');
      expect(participant).toHaveProperty('avatarUrl');
      expect(participant).toHaveProperty('isAdmin');
      expect(participant).toHaveProperty('joinedAt');
      expect(participant).toHaveProperty('presenceStatus');
      expect(participant).toHaveProperty('lastSeen');
    });
  });
});
