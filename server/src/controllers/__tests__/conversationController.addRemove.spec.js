jest.mock('../../models/Conversation');
jest.mock('../../config/database');
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
const { pool } = require('../../config/database');
const { closeRedis } = require('../../config/redis');

describe('POST /api/conversations/:conversationId/participants - Add Participants', () => {
  let authToken;
  let adminUserId;
  let conversationId;
  let mockClient;

  beforeAll(() => {
    adminUserId = '550e8400-e29b-41d4-a716-446655440000';
    conversationId = '550e8400-e29b-41d4-a716-446655440099';
    authToken = generateAccessToken({
      userId: adminUserId,
      username: 'admin',
      email: 'admin@example.com',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database client for transactions
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    pool.query = jest.fn();
  });

  afterAll(async () => {
    await closeRedis();
  });

  describe('Success Cases', () => {
    it('should add single participant to group (admin-only)', async () => {
      const userToAdd = '550e8400-e29b-41d4-a716-446655440001';

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
        name: 'Test Group',
      });

      // Mock isAdmin check (requireAdmin middleware)
      Conversation.isAdmin.mockResolvedValue(true);

      // Mock pool.query for user existence check
      pool.query.mockResolvedValueOnce({
        rows: [{ id: userToAdd }],
      });

      Conversation.addParticipants.mockResolvedValue([
        {
          id: userToAdd,
          username: 'alice',
          display_name: 'Alice Smith',
          avatar_url: null,
        },
      ]);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [userToAdd] })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Participants added successfully');
      expect(response.body.data.participants).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.participants[0].id).toBe(userToAdd);
    });

    it('should add multiple participants (batch operation)', async () => {
      const usersToAdd = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ];

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      // Mock isAdmin check (requireAdmin middleware)
      Conversation.isAdmin.mockResolvedValue(true);

      pool.query.mockResolvedValueOnce({
        rows: usersToAdd.map((id, i) => ({ id })),
      });

      Conversation.addParticipants.mockResolvedValue(
        usersToAdd.map((id, i) => ({
          id,
          username: `user${i}`,
          display_name: `User ${i}`,
          avatar_url: null,
        }))
      );

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: usersToAdd })
        .expect(201);

      expect(response.body.data.count).toBe(3);
      expect(Conversation.addParticipants).toHaveBeenCalledWith(
        conversationId,
        usersToAdd
      );
    });

    it('should emit Socket.io event when participants added', async () => {
      const userToAdd = '550e8400-e29b-41d4-a716-446655440001';

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      // Mock isAdmin check (requireAdmin middleware)
      Conversation.isAdmin.mockResolvedValue(true);

      pool.query.mockResolvedValueOnce({
        rows: [{ id: userToAdd }],
      });

      Conversation.addParticipants.mockResolvedValue([
        { id: userToAdd, username: 'alice' },
      ]);

      // Mock Socket.io
      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      app.set('io', mockIo);

      await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [userToAdd] })
        .expect(201);

      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:participant-added',
        expect.objectContaining({
          conversationId,
          participants: expect.any(Array),
          addedBy: adminUserId,
        })
      );

      app.set('io', undefined);
    });
  });

  describe('Authorization Cases', () => {
    it('should return 403 if non-admin tries to add participants', async () => {
      const nonAdminToken = generateAccessToken({
        userId: '550e8400-e29b-41d4-a716-446655440002',
        username: 'member',
        email: 'member@example.com',
      });

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      // Non-admin user
      Conversation.isAdmin.mockResolvedValue(false);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toBe('Only admins can perform this action');
    });

    it('should return 401 if no authentication token provided', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 if userIds is not an array', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toBe('userIds must be an array');
    });

    it('should return 400 if userIds is empty array', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [] })
        .expect(400);

      expect(response.body.message).toBe('userIds array cannot be empty');
    });

    it('should return 400 if more than 10 users in batch', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      const tooManyUsers = Array.from({ length: 11 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`
      );

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: tooManyUsers })
        .expect(400);

      expect(response.body.message).toBe('Cannot add more than 10 participants at once');
    });

    it('should return 400 if invalid UUID in userIds', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: ['invalid-uuid'] })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('Invalid UUID format');
    });

    it('should return 400 if duplicate userIds in request', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      const userId = '550e8400-e29b-41d4-a716-446655440001';

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [userId, userId] })
        .expect(400);

      expect(response.body.message).toBe('Duplicate user IDs in request');
    });

    it('should return 400 if conversationId is invalid UUID', async () => {
      const response = await request(app)
        .post('/api/conversations/invalid-uuid/participants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 if conversation does not exist', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);
      Conversation.findById.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should return 400 if conversation is not a group', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'direct', // Not a group
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(400);

      expect(response.body.message).toBe(
        'Can only add participants to group conversations'
      );
    });

    it('should return 404 if one or more users do not exist', async () => {
      const usersToAdd = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440099', // Doesn't exist
      ];

      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      // Only first user exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id: usersToAdd[0] }],
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: usersToAdd })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Users not found');
      expect(response.body.message).toContain(usersToAdd[1]);
    });

    it('should return 500 if database error occurs', async () => {
      // Mock isAdmin check (requireAdmin middleware runs first)
      Conversation.isAdmin.mockResolvedValue(true);

      Conversation.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: ['550e8400-e29b-41d4-a716-446655440001'] })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to add participants');
    });
  });
});

describe('DELETE /api/conversations/:conversationId/participants/:userId - Remove Participant', () => {
  let authToken;
  let adminUserId;
  let conversationId;
  let mockClient;

  beforeAll(() => {
    adminUserId = '550e8400-e29b-41d4-a716-446655440000';
    conversationId = '550e8400-e29b-41d4-a716-446655440099';
    authToken = generateAccessToken({
      userId: adminUserId,
      username: 'admin',
      email: 'admin@example.com',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database client for transactions
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    pool.query = jest.fn();
  });

  afterAll(async () => {
    await closeRedis();
  });

  describe('Success Cases - Admin Removing Others', () => {
    it('should allow admin to remove another participant', async () => {
      const targetUserId = '550e8400-e29b-41d4-a716-446655440001';

      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'group',
      });

      // Mock transaction query - returns participant data with window functions
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          // Return participant data with counts
          return Promise.resolve({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                active_count: '3',  // 3 active participants
                admin_count: '2',   // 2 admins
              },
              {
                user_id: adminUserId,
                is_admin: true,
                active_count: '3',
                admin_count: '2',
              },
            ],
          });
        } else if (query.includes('SET left_at')) {
          // Remove participant query
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Participant removed successfully');
      expect(response.body.data.userId).toBe(targetUserId);
    });

    it('should emit Socket.io event when participant removed', async () => {
      const targetUserId = '550e8400-e29b-41d4-a716-446655440001';

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: targetUserId, is_admin: false, active_count: '3', admin_count: '2' },
              { user_id: adminUserId, is_admin: true, active_count: '3', admin_count: '2' },
            ],
          });
        } else if (query.includes('SET left_at')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      app.set('io', mockIo);

      await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:participant-removed',
        expect.objectContaining({
          conversationId,
          userId: targetUserId,
          removedBy: adminUserId,
          isSelfRemoval: false,
        })
      );

      app.set('io', undefined);
    });
  });

  describe('Success Cases - Self Removal', () => {
    it('should allow user to remove themselves (self-removal)', async () => {
      const memberUserId = '550e8400-e29b-41d4-a716-446655440001';
      const memberToken = generateAccessToken({
        userId: memberUserId,
        username: 'member',
        email: 'member@example.com',
      });

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - member removing self
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: memberUserId, is_admin: false, active_count: '3', admin_count: '2' },
            ],
          });
        } else if (query.includes('SET left_at')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('You have left the conversation');
      expect(response.body.data.userId).toBe(memberUserId);
    });

    it('should emit Socket.io event with isSelfRemoval=true', async () => {
      const memberUserId = '550e8400-e29b-41d4-a716-446655440001';
      const memberToken = generateAccessToken({
        userId: memberUserId,
        username: 'member',
        email: 'member@example.com',
      });

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: memberUserId, is_admin: false, active_count: '3', admin_count: '2' },
            ],
          });
        } else if (query.includes('SET left_at')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      app.set('io', mockIo);

      await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:participant-removed',
        expect.objectContaining({
          userId: memberUserId,
          removedBy: memberUserId,
          isSelfRemoval: true,
        })
      );

      app.set('io', undefined);
    });
  });

  describe('Last Admin Protection', () => {
    it('should auto-promote oldest member when last admin leaves', async () => {
      const oldestMemberId = '550e8400-e29b-41d4-a716-446655440002';

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - last admin leaving, auto-promote oldest
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          // Last admin (admin_count = 1)
          return Promise.resolve({
            rows: [
              { user_id: adminUserId, is_admin: true, active_count: '2', admin_count: '1' },
            ],
          });
        } else if (query.includes('ORDER BY joined_at ASC')) {
          // Get oldest member
          return Promise.resolve({
            rows: [{ user_id: oldestMemberId }],
          });
        } else if (query.includes('SET is_admin = true')) {
          // Promote to admin
          return Promise.resolve({ rowCount: 1 });
        } else if (query.includes('SET left_at')) {
          // Remove admin
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      app.set('io', mockIo);

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.adminPromoted).toBe(oldestMemberId);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conversation:admin-promoted',
        expect.objectContaining({
          userId: oldestMemberId,
          reason: 'last_admin_leaving',
        })
      );

      app.set('io', undefined);
    });

    it('should prevent removing last participant from group', async () => {
      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - last participant (active_count = 1)
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: adminUserId, is_admin: true, active_count: '1', admin_count: '1' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe(
        'Cannot remove the last participant from a group'
      );
    });

    it('should handle case where last admin leaves and no other members exist', async () => {
      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - only admin, no other members
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: adminUserId, is_admin: true, active_count: '1', admin_count: '1' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toBe(
        'Cannot remove the last participant from a group'
      );
    });
  });

  describe('Authorization Cases', () => {
    it('should return 403 if non-admin tries to remove another user', async () => {
      const memberUserId = '550e8400-e29b-41d4-a716-446655440001';
      const targetUserId = '550e8400-e29b-41d4-a716-446655440002';

      const memberToken = generateAccessToken({
        userId: memberUserId,
        username: 'member',
        email: 'member@example.com',
      });

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - member (not admin) trying to remove another
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: targetUserId, is_admin: false, active_count: '3', admin_count: '2' },
              { user_id: memberUserId, is_admin: false, active_count: '3', admin_count: '2' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${targetUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toBe('Only admins can remove other participants');
    });

    it('should return 401 if no authentication token provided', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 if conversationId is invalid UUID', async () => {
      const response = await request(app)
        .delete('/api/conversations/invalid-uuid/participants/550e8400-e29b-41d4-a716-446655440001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });

    it('should return 400 if userId is invalid UUID', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/invalid-uuid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 if conversation does not exist', async () => {
      Conversation.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should return 400 if conversation is not a group', async () => {
      Conversation.findById.mockResolvedValue({
        id: conversationId,
        type: 'direct',
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toBe(
        'This action is only available for group conversations'
      );
    });

    it('should return 404 if user is not a participant', async () => {
      const nonParticipantId = '550e8400-e29b-41d4-a716-446655440099';

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - target user not found in participants
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [], // User not found
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${nonParticipantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe(
        'User is not a participant in this conversation'
      );
    });

    it('should return 404 if participant already removed (left_at set)', async () => {
      const targetUserId = '550e8400-e29b-41d4-a716-446655440001';

      Conversation.findById.mockResolvedValue({ id: conversationId, type: 'group' });

      // Mock transaction query - returns participant but SET left_at fails
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              { user_id: targetUserId, is_admin: false, active_count: '2', admin_count: '1' },
              { user_id: adminUserId, is_admin: true, active_count: '2', admin_count: '1' },
            ],
          });
        } else if (query.includes('SET left_at')) {
          // Already removed (rowCount = 0)
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Participant not found or already removed');
    });

    it('should return 500 if database error occurs', async () => {
      Conversation.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .delete(`/api/conversations/${conversationId}/participants/${adminUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to remove participant');
    });
  });
});
