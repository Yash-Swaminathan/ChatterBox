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

describe('User Controller - Search', () => {
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
    User.searchUsers = jest.fn();
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
});
