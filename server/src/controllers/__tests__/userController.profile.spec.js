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

describe('User Controller - Profile Management', () => {
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

  let authToken;

  beforeAll(() => {
    authToken = generateAccessToken({ userId: mockUser.id });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mock functions are properly set up
    User.getUserById = jest.fn();
    User.updateUserProfile = jest.fn();
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
          email: 'newemail@example.com',
        });

      expect(response.status).toBe(200);
      expect(User.updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'New Name',
      });
    });

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
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: null,
          bio: 'Valid bio',
        });

      expect(response.status).toBe(400);
    });
  });
});
