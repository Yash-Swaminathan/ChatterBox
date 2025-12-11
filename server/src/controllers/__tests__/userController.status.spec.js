/**
 * User Controller - Status Update Tests
 *
 * Tests for user online status management:
 * - PUT /api/users/me/status - Update user's online status
 *
 * Coverage:
 * - Status updates (online, away, busy, offline)
 * - Automatic last_seen timestamp updates
 * - Validation errors (missing status, invalid status, extra fields)
 * - Type validation (status must be string)
 * - Authentication requirements
 * - User not found scenarios
 * - Database errors and model validation errors
 */

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { generateAccessToken } = require('../../utils/jwt');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (_req, _res, next) => next());
});

describe('User Controller - Status Updates', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
  };

  let authToken;

  beforeAll(() => {
    authToken = generateAccessToken({ userId: mockUser.id });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mock functions are properly set up
    User.updateUserStatus = jest.fn();
  });

  describe('PUT /api/users/me/status', () => {
    it('should update status to online successfully', async () => {
      const result = {
        id: mockUser.id,
        status: 'online',
        last_seen: new Date(),
      };

      User.updateUserStatus.mockResolvedValue(result);

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'online' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('online');
      expect(response.body.data).toHaveProperty('last_seen');
      expect(User.updateUserStatus).toHaveBeenCalledWith(mockUser.id, 'online');
    });

    it('should update status to away successfully', async () => {
      const result = {
        id: mockUser.id,
        status: 'away',
        last_seen: new Date(),
      };

      User.updateUserStatus.mockResolvedValue(result);

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'away' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('away');
    });

    it('should update status to busy successfully', async () => {
      const result = {
        id: mockUser.id,
        status: 'busy',
        last_seen: new Date(),
      };

      User.updateUserStatus.mockResolvedValue(result);

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'busy' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('busy');
    });

    it('should update status to offline successfully', async () => {
      const result = {
        id: mockUser.id,
        status: 'offline',
        last_seen: new Date(),
      };

      User.updateUserStatus.mockResolvedValue(result);

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'offline' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('offline');
    });

    it('should return 400 if status is missing', async () => {
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if extra fields are provided', async () => {
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'online', extra_field: 'not allowed' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if status is not a string', async () => {
      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app).put('/api/users/me/status').send({ status: 'online' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 if user not found', async () => {
      User.updateUserStatus.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'online' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 400 if model throws validation error', async () => {
      User.updateUserStatus.mockRejectedValue(
        new Error('Status must be one of: online, offline, away, busy')
      );

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'online' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    it('should return 500 if database error occurs', async () => {
      User.updateUserStatus.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .put('/api/users/me/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'online' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
