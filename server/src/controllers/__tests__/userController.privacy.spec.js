const request = require('supertest');
const app = require('../../app');
const { generateAccessToken } = require('../../utils/jwt');

// Mock the User model
jest.mock('../../models/User');
const User = require('../../models/User');

describe('PUT /api/users/me/privacy', () => {
  let validAccessToken;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    // Generate a valid access token for testing
    validAccessToken = generateAccessToken({
      id: testUserId,
      username: 'testuser',
      email: 'test@example.com',
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should update read receipt privacy setting to true', async () => {
      // Mock successful update
      User.updateReadReceiptPrivacy.mockResolvedValue({
        id: testUserId,
        hide_read_status: true,
      });

      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: true })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hide_read_status: true,
        },
        message: 'Privacy settings updated successfully',
      });

      expect(User.updateReadReceiptPrivacy).toHaveBeenCalledWith(testUserId, true);
    });

    it('should update read receipt privacy setting to false', async () => {
      // Mock successful update
      User.updateReadReceiptPrivacy.mockResolvedValue({
        id: testUserId,
        hide_read_status: false,
      });

      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: false })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hide_read_status: false,
        },
      });

      expect(User.updateReadReceiptPrivacy).toHaveBeenCalledWith(testUserId, false);
    });
  });

  describe('Validation Errors', () => {
    it('should reject string value for hide_read_status', async () => {
      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: 'yes' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'hide_read_status must be a boolean',
        },
      });

      expect(User.updateReadReceiptPrivacy).not.toHaveBeenCalled();
    });

    it('should reject number value for hide_read_status', async () => {
      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: 1 })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(User.updateReadReceiptPrivacy).not.toHaveBeenCalled();
    });

    it('should reject null value for hide_read_status', async () => {
      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: null })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should reject missing hide_read_status field', async () => {
      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      await request(app).put('/api/users/me/privacy').send({ hide_read_status: true }).expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', 'Bearer invalid-token')
        .send({ hide_read_status: true })
        .expect(401);
    });

    it('should reject missing Authorization header', async () => {
      await request(app).put('/api/users/me/privacy').send({ hide_read_status: true }).expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow 10 requests within 15 minutes', async () => {
      User.updateReadReceiptPrivacy.mockResolvedValue({
        id: testUserId,
        hide_read_status: true,
      });

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .put('/api/users/me/privacy')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({ hide_read_status: i % 2 === 0 });

        expect(response.status).toBe(200);
      }

      expect(User.updateReadReceiptPrivacy).toHaveBeenCalledTimes(10);
    });

    // Note: Rate limiting is disabled in test environment, so we can't test the 11th request being blocked
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      User.updateReadReceiptPrivacy.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: true })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to update privacy settings',
        },
      });
    });

    it('should handle user not found errors', async () => {
      User.updateReadReceiptPrivacy.mockRejectedValue(new Error('User not found or inactive'));

      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ hide_read_status: true })
        .expect(500);

      expect(response.body.error.code).toBe('SERVER_ERROR');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent updates correctly', async () => {
      User.updateReadReceiptPrivacy.mockResolvedValue({
        id: testUserId,
        hide_read_status: true,
      });

      // Send multiple concurrent requests
      const promises = [
        request(app)
          .put('/api/users/me/privacy')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({ hide_read_status: true }),
        request(app)
          .put('/api/users/me/privacy')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({ hide_read_status: false }),
      ];

      const responses = await Promise.all(promises);

      // Both should succeed (PostgreSQL handles concurrency)
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
    });

    it('should handle empty request body gracefully', async () => {
      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should ignore extra fields in request', async () => {
      User.updateReadReceiptPrivacy.mockResolvedValue({
        id: testUserId,
        hide_read_status: true,
      });

      const response = await request(app)
        .put('/api/users/me/privacy')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          hide_read_status: true,
          extra_field: 'should be ignored',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(User.updateReadReceiptPrivacy).toHaveBeenCalledWith(testUserId, true);
    });
  });
});
