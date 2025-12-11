/**
 * User Controller - Public Profile Tests
 *
 * Tests for public user profile retrieval:
 * - GET /api/users/:userId - Get public user profile by ID
 *
 * Coverage:
 * - Success cases for public profile retrieval
 * - UUID format validation
 * - User not found scenarios
 * - Authentication requirements
 * - Database errors
 * - Ensures sensitive data (email, phone, password) is not exposed
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

describe('User Controller - Public Profile', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockPublicUser = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    username: 'publicuser',
    display_name: 'Public User',
    bio: 'Public bio',
    avatar_url: null,
    status: 'online',
    last_seen: new Date(),
    created_at: new Date(),
  };

  let authToken;

  beforeAll(() => {
    authToken = generateAccessToken({ userId: mockUser.id });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mock functions are properly set up
    User.isValidUUID = jest.fn();
    User.getPublicUserById = jest.fn();
  });

  describe('GET /api/users/:userId', () => {
    it('should return public user profile successfully', async () => {
      User.isValidUUID.mockReturnValue(true);
      User.getPublicUserById.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .get(`/api/users/${mockPublicUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id', mockPublicUser.id);
      expect(response.body.data.user).toHaveProperty('username');
      expect(response.body.data.user).not.toHaveProperty('email');
      expect(response.body.data.user).not.toHaveProperty('phone_number');
      expect(User.getPublicUserById).toHaveBeenCalledWith(mockPublicUser.id);
    });

    it('should return 400 if userId is invalid UUID format', async () => {
      User.isValidUUID.mockReturnValue(false);

      const response = await request(app)
        .get('/api/users/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_UUID_FORMAT');
    });

    it('should return 404 if user not found', async () => {
      User.isValidUUID.mockReturnValue(true);
      User.getPublicUserById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/users/${mockPublicUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app).get(`/api/users/${mockPublicUser.id}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 if database error occurs', async () => {
      User.isValidUUID.mockReturnValue(true);
      User.getPublicUserById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/users/${mockPublicUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
