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

describe('Conversation Controller - Group Settings', () => {
  let authToken;
  let nonAdminToken;
  let adminUserId;
  let memberUserId;
  let conversationId;
  let mockClient;
  let mockIo;

  beforeAll(() => {
    adminUserId = '550e8400-e29b-41d4-a716-446655440000';
    memberUserId = '550e8400-e29b-41d4-a716-446655440001';
    conversationId = '550e8400-e29b-41d4-a716-446655440099';

    authToken = generateAccessToken({
      userId: adminUserId,
      username: 'admin',
      email: 'admin@example.com',
    });

    nonAdminToken = generateAccessToken({
      userId: memberUserId,
      username: 'member',
      email: 'member@example.com',
    });

    // Mock Socket.io
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    app.set('io', mockIo);
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

  // ============================================================================
  // PUT /api/conversations/:conversationId - Update Group Settings
  // ============================================================================

  describe('PUT /api/conversations/:conversationId - Update Group Settings', () => {
    // --------------------------------------------------------------------------
    // Success Cases (7 tests)
    // --------------------------------------------------------------------------
    describe('Success Cases', () => {
      it('should update group name only (admin)', async () => {
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Updated Group Name',
          avatar_url: null,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Updated Group Name' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.name).toBe('Updated Group Name');
        expect(Conversation.updateGroupMetadata).toHaveBeenCalledWith(
          conversationId,
          { name: 'Updated Group Name' },
          mockClient // Transaction client
        );
      });

      it('should update avatar URL only (admin)', async () => {
        const avatarUrl = 'https://example.com/avatar.jpg';
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Test Group',
          avatar_url: avatarUrl,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.avatarUrl).toBe(avatarUrl);
        expect(Conversation.updateGroupMetadata).toHaveBeenCalledWith(
          conversationId,
          { avatarUrl },
          mockClient // Transaction client
        );
      });

      it('should update both name and avatar (admin)', async () => {
        const name = 'New Name';
        const avatarUrl = 'https://example.com/new-avatar.png';
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name,
          avatar_url: avatarUrl,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name, avatarUrl })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.name).toBe(name);
        expect(response.body.data.conversation.avatarUrl).toBe(avatarUrl);
      });

      it('should allow null avatar to remove it', async () => {
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Test Group',
          avatar_url: null,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: null })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.avatarUrl).toBeNull();
        expect(Conversation.updateGroupMetadata).toHaveBeenCalledWith(
          conversationId,
          { avatarUrl: null },
          mockClient // Transaction client
        );
      });

      it('should trim whitespace from name', async () => {
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Trimmed Name',
          avatar_url: null,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: '  Trimmed Name  ' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.name).toBe('Trimmed Name');
      });

      it('should return updated conversation data', async () => {
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Updated',
          avatar_url: 'https://example.com/avatar.jpg',
          created_by: adminUserId,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-07T00:00:00Z',
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Updated' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation).toMatchObject({
          id: conversationId,
          type: 'group',
          name: 'Updated',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdBy: adminUserId,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-07T00:00:00Z',
        });
      });

      it('should emit conversation:updated Socket.io event with correct data', async () => {
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'New Name',
          avatar_url: 'https://example.com/avatar.jpg',
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(200);

        expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
        expect(mockIo.emit).toHaveBeenCalledWith(
          'conversation:updated',
          expect.objectContaining({
            conversationId,
            updates: expect.objectContaining({
              name: 'New Name',
              avatarUrl: 'https://example.com/avatar.jpg',
            }),
            updatedBy: expect.objectContaining({
              id: adminUserId,
            }),
            updatedAt: expect.any(String),
          })
        );
      });
    });

    // --------------------------------------------------------------------------
    // Authorization (2 tests)
    // --------------------------------------------------------------------------
    describe('Authorization', () => {
      it('should reject non-admin users (403 Forbidden)', async () => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(false);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${nonAdminToken}`)
          .send({ name: 'New Name' })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('admin');
      });

      it('should reject unauthenticated requests (401 Unauthorized)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .send({ name: 'New Name' })
          .expect(401);

        expect(response.body.error.code).toBe('NO_TOKEN');
      });
    });

    // --------------------------------------------------------------------------
    // Validation (8 tests)
    // --------------------------------------------------------------------------
    describe('Validation', () => {
      beforeEach(() => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
      });

      it('should reject empty name after trim (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: '   ' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('empty');
      });

      it('should reject name > 100 characters (400)', async () => {
        const longName = 'a'.repeat(101);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: longName })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('100 characters');
      });

      it('should reject name that is not a string (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 12345 })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('string');
      });

      it('should reject invalid avatar URL format (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: 'not-a-url' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('valid URL');
      });

      it('should reject avatarUrl that is not a string or null (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: 12345 })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('string or null');
      });

      it('should reject empty avatarUrl after trim (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: '   ' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('empty');
      });

      it('should reject request with no fields provided (400)', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('At least one field');
      });

      it('should reject avatarUrl with javascript: protocol (400) - XSS protection', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: 'javascript:alert(1)' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('HTTP or HTTPS');
      });
    });

    // --------------------------------------------------------------------------
    // Error Cases (6 tests)
    // --------------------------------------------------------------------------
    describe('Error Cases', () => {
      it('should return 404 for non-existent conversation', async () => {
        Conversation.findById.mockResolvedValue(null);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
        expect(response.body.message).toContain('not found');
      });

      it('should return 400 for direct conversation (not group)', async () => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'direct',
        });

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toContain('group');
      });

      it('should return 400 for invalid conversation UUID format', async () => {
        const response = await request(app)
          .put('/api/conversations/invalid-uuid')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('UUID');
      });

      it('should handle database errors gracefully (500)', async () => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateGroupMetadata.mockRejectedValue(
          new Error('Database connection failed')
        );

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(500);

        expect(response.body.error).toBe('Internal Server Error');
        expect(response.body.message).toContain('Failed to update');
      });

      it('should handle missing conversation in DB (404)', async () => {
        Conversation.findById.mockResolvedValue(null);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
      });

      it('should handle missing user in participants table (403)', async () => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(false);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'New Name' })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });
    });

    // --------------------------------------------------------------------------
    // Edge Cases (2 tests)
    // --------------------------------------------------------------------------
    describe('Edge Cases', () => {
      beforeEach(() => {
        Conversation.findById.mockResolvedValue({
          id: conversationId,
          type: 'group',
        });
        Conversation.isAdmin.mockResolvedValue(true);
      });

      it('should handle very long valid URLs (up to 500 chars)', async () => {
        const longUrl = `https://example.com/${'a'.repeat(450)}.jpg`;
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: 'Test',
          avatar_url: longUrl,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ avatarUrl: longUrl })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.avatarUrl).toBe(longUrl);
      });

      it('should handle unicode/emoji in group name', async () => {
        const unicodeName = 'Group 🎉 नमस्ते مرحبا 你好';
        const updatedConversation = {
          id: conversationId,
          type: 'group',
          name: unicodeName,
          avatar_url: null,
          created_by: adminUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        Conversation.updateGroupMetadata.mockResolvedValue(updatedConversation);

        const response = await request(app)
          .put(`/api/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: unicodeName })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conversation.name).toBe(unicodeName);
      });
    });
  });

  // ============================================================================
  // PUT /api/conversations/:conversationId/participants/:userId/role
  // ============================================================================

  describe('PUT /api/conversations/:conversationId/participants/:userId/role - Update Role', () => {
    const targetUserId = '550e8400-e29b-41d4-a716-446655440002';
    const thirdUserId = '550e8400-e29b-41d4-a716-446655440003';

    // --------------------------------------------------------------------------
    // Success Cases (8 tests)
    // --------------------------------------------------------------------------
    describe('Success Cases', () => {
      it('should promote member to admin', async () => {
        // Mock transaction queries
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            // conversation check
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            // target participant check
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            // user details
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
          joined_at: new Date().toISOString(),
          last_read_at: null,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.participant.isAdmin).toBe(true);
        expect(response.body.data.participant.role).toBe('admin');
        expect(response.body.data.participant.userId).toBe(targetUserId);
        expect(response.body.data.participant.username).toBe('alice');
      });

      it('should demote admin to member', async () => {
        // Mock transaction queries
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2); // 2 admins, so demotion is safe
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: false,
          joined_at: new Date().toISOString(),
          last_read_at: null,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.participant.isAdmin).toBe(false);
        expect(response.body.data.participant.role).toBe('member');
      });

      it('should return 200 for no-op (user already admin, promote to admin)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true, // Already admin
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('already admin');
        expect(response.body.data.participant.isAdmin).toBe(true);
      });

      it('should return 200 for no-op (user already member, demote to member)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false, // Already member
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('already member');
        expect(response.body.data.participant.isAdmin).toBe(false);
      });

      it('should emit conversation:admin-promoted event', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
          joined_at: new Date().toISOString(),
        });

        await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
        expect(mockIo.emit).toHaveBeenCalledWith(
          'conversation:admin-promoted',
          expect.objectContaining({
            conversationId,
            participant: expect.objectContaining({
              userId: targetUserId,
              username: 'alice',
              role: 'admin',
              isAdmin: true,
            }),
            changedBy: expect.objectContaining({
              id: adminUserId,
            }),
          })
        );
      });

      it('should emit conversation:admin-demoted event', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: false,
          joined_at: new Date().toISOString(),
        });

        await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(200);

        expect(mockIo.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
        expect(mockIo.emit).toHaveBeenCalledWith(
          'conversation:admin-demoted',
          expect.objectContaining({
            conversationId,
            participant: expect.objectContaining({
              userId: targetUserId,
              role: 'member',
              isAdmin: false,
            }),
          })
        );
      });

      it('should return participant with updated role', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: '2025-01-01T00:00:00Z',
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: 'https://example.com/alice.jpg',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
          joined_at: '2025-01-01T00:00:00Z',
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(response.body.data.participant).toMatchObject({
          userId: targetUserId,
          username: 'alice',
          displayName: 'Alice Smith',
          avatarUrl: 'https://example.com/alice.jpg',
          role: 'admin',
          isAdmin: true,
          joinedAt: '2025-01-01T00:00:00Z',
        });
      });

      it('should include user details in response (username, displayName, avatarUrl)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice Smith',
                avatar_url: 'https://example.com/avatar.jpg',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(response.body.data.participant.username).toBe('alice');
        expect(response.body.data.participant.displayName).toBe('Alice Smith');
        expect(response.body.data.participant.avatarUrl).toBe(
          'https://example.com/avatar.jpg'
        );
      });
    });

    // --------------------------------------------------------------------------
    // Authorization (3 tests)
    // --------------------------------------------------------------------------
    describe('Authorization', () => {
      it('should reject non-admin requester (403 Forbidden)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK (after auth check fails)

        Conversation.isAdmin.mockResolvedValue(false);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${nonAdminToken}`)
          .send({ role: 'admin' })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('admin');
      });

      it('should reject unauthenticated requests (401 Unauthorized)', async () => {
        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .send({ role: 'admin' })
          .expect(401);

        expect(response.body.error.code).toBe('NO_TOKEN');
      });

      it('should allow admin to change their own role (if not last admin)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: adminUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: adminUserId,
                username: 'admin',
                display_name: 'Admin User',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2); // 2 admins, so safe to demote self
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: adminUserId,
          is_admin: false,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${adminUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    // --------------------------------------------------------------------------
    // Last Admin Protection (4 tests)
    // --------------------------------------------------------------------------
    describe('Last Admin Protection', () => {
      it('should prevent demoting last admin (400 Bad Request)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(1); // Only 1 admin

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toContain('last admin');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });

      it('should allow demoting admin when 2+ admins exist', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: false,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should allow promoting member to admin (always)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should return clear error message for last admin demotion attempt', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(1);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'member' })
          .expect(400);

        expect(response.body.message).toContain('Promote another member first');
      });
    });

    // --------------------------------------------------------------------------
    // Validation (5 tests)
    // --------------------------------------------------------------------------
    describe('Validation', () => {
      it('should reject invalid role value (400)', async () => {
        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'superadmin' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('admin');
        expect(response.body.message).toContain('member');
      });

      it('should accept "admin" role (case-insensitive)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'ADMIN' }) // Uppercase
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should accept "member" role (case-insensitive)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount.mockResolvedValue(2);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: false,
        });

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'Member' }) // Mixed case
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should reject missing role field (400)', async () => {
        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('required');
      });

      it('should reject role that is not a string (400)', async () => {
        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 12345 })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('string');
      });
    });

    // --------------------------------------------------------------------------
    // Error Cases (7 tests)
    // --------------------------------------------------------------------------
    describe('Error Cases', () => {
      it('should return 404 for non-existent conversation', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // conversation check returns empty
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
        expect(response.body.message).toContain('not found');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });

      it('should return 404 for non-existent target user', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({ rows: [] }) // target user not found
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
        expect(response.body.message).toContain('Participant not found');
      });

      it('should return 404 for target user not in conversation', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({ rows: [] }) // participant query returns empty
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
      });

      it('should return 404 for target user who left conversation (left_at IS NOT NULL)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({ rows: [] }) // Query with left_at IS NULL returns empty
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(404);

        expect(response.body.error).toBe('Not Found');
        expect(response.body.message).toContain('not found');
      });

      it('should return 400 for direct conversation (not group)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'direct' }],
          })
          .mockResolvedValueOnce({ rows: [] });

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toContain('group');
      });

      it('should return 400 for invalid conversation UUID', async () => {
        const response = await request(app)
          .put(`/api/conversations/invalid-uuid/participants/${targetUserId}/role`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('UUID');
      });

      it('should return 400 for invalid user UUID', async () => {
        const response = await request(app)
          .put(`/api/conversations/${conversationId}/participants/invalid-uuid/role`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(400);

        expect(response.body.error).toBe('Validation Error');
        expect(response.body.message).toContain('UUID');
      });
    });

    // --------------------------------------------------------------------------
    // Transaction Safety (3 tests)
    // --------------------------------------------------------------------------
    describe('Transaction Safety', () => {
      it('should use transaction with row-level locking (FOR UPDATE)', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: targetUserId,
                is_admin: false,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: targetUserId,
                username: 'alice',
                display_name: 'Alice',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.updateParticipantRole.mockResolvedValue({
          conversation_id: conversationId,
          user_id: targetUserId,
          is_admin: true,
        });

        await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(200);

        // Verify transaction was used
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verify FOR UPDATE was used in query (check second query call)
        const conversationQuery = mockClient.query.mock.calls[1][0];
        expect(conversationQuery).toContain('FOR UPDATE');
      });

      it('should rollback on database error', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Database connection failed')); // Error on conversation check

        Conversation.isAdmin.mockResolvedValue(true);

        const response = await request(app)
          .put(
            `/api/conversations/${conversationId}/participants/${targetUserId}/role`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'admin' })
          .expect(500);

        expect(response.body.error).toBe('Internal Server Error');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should handle concurrent role changes without race conditions', async () => {
        // This test simulates two admins trying to demote each other simultaneously
        // One should succeed, one should fail with "Cannot demote last admin"

        // Setup: 2 admins initially
        const admin2UserId = thirdUserId;
        const admin2Token = generateAccessToken({
          userId: admin2UserId,
          username: 'admin2',
          email: 'admin2@example.com',
        });

        // Mock for first request (admin1 demotes admin2)
        const mockClient1 = {
          query: jest.fn(),
          release: jest.fn(),
        };

        // Mock for second request (admin2 demotes admin1)
        const mockClient2 = {
          query: jest.fn(),
          release: jest.fn(),
        };

        pool.connect
          .mockResolvedValueOnce(mockClient1)
          .mockResolvedValueOnce(mockClient2);

        // First request succeeds
        mockClient1.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: admin2UserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: admin2UserId,
                username: 'admin2',
                display_name: 'Admin 2',
                avatar_url: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        // Second request fails (last admin protection)
        mockClient2.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: conversationId, type: 'group' }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                user_id: adminUserId,
                is_admin: true,
                joined_at: new Date().toISOString(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        Conversation.isAdmin.mockResolvedValue(true);
        Conversation.getAdminCount
          .mockResolvedValueOnce(2) // First check: 2 admins
          .mockResolvedValueOnce(1); // Second check: 1 admin (after first demotion)

        Conversation.updateParticipantRole.mockResolvedValueOnce({
          conversation_id: conversationId,
          user_id: admin2UserId,
          is_admin: false,
        });

        // Execute both requests concurrently
        const [response1, response2] = await Promise.all([
          request(app)
            .put(
              `/api/conversations/${conversationId}/participants/${admin2UserId}/role`
            )
            .set('Authorization', `Bearer ${authToken}`)
            .send({ role: 'member' }),
          request(app)
            .put(
              `/api/conversations/${conversationId}/participants/${adminUserId}/role`
            )
            .set('Authorization', `Bearer ${admin2Token}`)
            .send({ role: 'member' }),
        ]);

        // One should succeed (200), one should fail (400)
        const statuses = [response1.status, response2.status].sort();
        expect(statuses).toEqual([200, 400]);

        // The failed request should have "last admin" error
        const failedResponse = response1.status === 400 ? response1 : response2;
        expect(failedResponse.body.message).toContain('last admin');

        // Verify both transactions were properly handled
        expect(mockClient1.release).toHaveBeenCalled();
        expect(mockClient2.release).toHaveBeenCalled();
      });
    });
  });
});
