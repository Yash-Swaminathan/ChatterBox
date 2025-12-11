const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { generateAccessToken } = require('../utils/jwt');

// Mock the User model
jest.mock('../models/User');

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock express-rate-limit to avoid rate limiting during tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (_req, _res, next) => next());
});

describe('User Controller Tests', () => {
  // Sample user data
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    phone_number: null,
    display_name: 'Test User',
    bio: 'This is my bio',
    avatar_url: null,
    status: 'online',
    last_seen: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
    email_verified: false,
    phone_verified: false,
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
    // Generate a valid token for testing
    authToken = generateAccessToken({ userId: mockUser.id });
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('should return current user profile successfully', async () => {
      User.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id', mockUser.id);
      expect(response.body.data.user).toHaveProperty('username', mockUser.username);
      expect(response.body.data.user).toHaveProperty('email', mockUser.email);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(User.getUserById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should return 401 if invalid token provided', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 if user not found', async () => {
      User.getUserById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 500 if database error occurs', async () => {
      User.getUserById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update display_name successfully', async () => {
      const updatedUser = { ...mockUser, display_name: 'New Name' };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.display_name).toBe('New Name');
      expect(User.updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'New Name',
      });
    });

    it('should update bio successfully', async () => {
      const updatedUser = { ...mockUser, bio: 'New bio text' };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bio: 'New bio text' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.bio).toBe('New bio text');
    });

    it('should update status successfully', async () => {
      const updatedUser = { ...mockUser, status: 'away' };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'away' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.status).toBe('away');
    });

    it('should update multiple fields successfully', async () => {
      const updatedUser = {
        ...mockUser,
        display_name: 'New Name',
        bio: 'New bio',
        status: 'busy',
      };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'New Name',
          bio: 'New bio',
          status: 'busy',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.display_name).toBe('New Name');
      expect(response.body.data.user.bio).toBe('New bio');
      expect(response.body.data.user.status).toBe('busy');
    });

    it('should return 400 if no fields provided', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if display_name is empty string', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if display_name is too long', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'a'.repeat(101) });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if bio is too long', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bio: 'a'.repeat(501) });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow empty bio (clearing bio)', async () => {
      const updatedUser = { ...mockUser, bio: '' };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bio: '' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.bio).toBe('');
    });

    it('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if display_name is not a string', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app).put('/api/users/me').send({ display_name: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 if user not found', async () => {
      User.updateUserProfile.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 500 if database error occurs', async () => {
      User.updateUserProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'New Name' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should ignore invalid fields and only update valid ones', async () => {
      const updatedUser = { ...mockUser, display_name: 'New Name' };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'New Name',
          invalid_field: 'should be ignored',
          email: 'newemail@example.com', // email update not allowed via this endpoint
        });

      expect(response.status).toBe(200);
      expect(User.updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'New Name',
      });
    });
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

  describe('GET /api/users/search', () => {
    it('should search users by username successfully', async () => {
      const searchResults = {
        users: [
          { id: '1', username: 'john', display_name: 'John Doe', status: 'online' },
          { id: '2', username: 'johnny', display_name: 'Johnny Smith', status: 'away' },
        ],
        total: 2,
      };

      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=john')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 20);
      expect(response.body.pagination).toHaveProperty('offset', 0);
      expect(response.body.pagination).toHaveProperty('hasMore', false);
      expect(User.searchUsers).toHaveBeenCalledWith('john', 20, 0);
    });

    it('should search users by email successfully', async () => {
      const searchResults = {
        users: [{ id: '1', username: 'testuser', display_name: 'Test', status: 'online' }],
        total: 1,
      };

      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=test@example.com')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(User.searchUsers).toHaveBeenCalledWith('test@example.com', 20, 0);
    });

    it('should handle pagination parameters correctly', async () => {
      const searchResults = {
        users: [
          { id: '1', username: 'user1', display_name: 'User 1', status: 'online' },
          { id: '2', username: 'user2', display_name: 'User 2', status: 'away' },
        ],
        total: 25,
      };

      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=user&limit=10&offset=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(5);
      expect(response.body.pagination.total).toBe(25);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(User.searchUsers).toHaveBeenCalledWith('user', 10, 5);
    });

    it('should cap limit at maximum (50)', async () => {
      const searchResults = { users: [], total: 0 };
      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=test&limit=100')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(User.searchUsers).toHaveBeenCalledWith('test', 50, 0);
    });

    it('should use default pagination if not provided', async () => {
      const searchResults = { users: [], total: 0 };
      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(User.searchUsers).toHaveBeenCalledWith('test', 20, 0);
    });

    it('should return empty results for no matches', async () => {
      User.searchUsers.mockResolvedValue({ users: [], total: 0 });

      const response = await request(app)
        .get('/api/users/search?q=nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_QUERY');
    });

    it('should return 400 if query is too short (< 2 chars)', async () => {
      const response = await request(app)
        .get('/api/users/search?q=a')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QUERY_TOO_SHORT');
    });

    it('should return 401 if no auth token provided', async () => {
      const response = await request(app).get('/api/users/search?q=test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 if database error occurs', async () => {
      User.searchUsers.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/search?q=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should not return sensitive fields in search results', async () => {
      const searchResults = {
        users: [
          {
            id: '1',
            username: 'john',
            display_name: 'John Doe',
            bio: 'Hello',
            avatar_url: null,
            status: 'online',
            created_at: new Date(),
          },
        ],
        total: 1,
      };

      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=john')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const user = response.body.data.users[0];
      expect(user).not.toHaveProperty('email');
      expect(user).not.toHaveProperty('phone_number');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      const searchResults = { users: [], total: 0 };
      User.searchUsers.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/users/search?q=test&limit=invalid&offset=-5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Should use defaults: limit=20, offset=0
      expect(User.searchUsers).toHaveBeenCalledWith('test', 20, 0);
    });
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

  describe('Edge Cases and Security', () => {
    it('should not allow updating email through profile update', async () => {
      const updatedUser = { ...mockUser };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'New Name',
          email: 'hacker@example.com',
        });

      expect(response.status).toBe(200);
      expect(User.updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'New Name',
      });
      // Email should not be in the update object
      expect(User.updateUserProfile).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: expect.anything() })
      );
    });

    it('should not allow updating password through profile update', async () => {
      const updatedUser = { ...mockUser };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'New Name',
          password: 'newpassword123',
        });

      expect(response.status).toBe(200);
      expect(User.updateUserProfile).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ password: expect.anything() })
      );
    });

    it('should handle null values in update gracefully', async () => {
      const updatedUser = { ...mockUser };
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: null,
          bio: 'Valid bio',
        });

      // Null display_name should fail validation
      expect(response.status).toBe(400);
    });
  });
});
