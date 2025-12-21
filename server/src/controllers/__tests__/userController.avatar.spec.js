// Mock dependencies FIRST, before any imports
jest.mock('../../models/User');
jest.mock('../../services/uploadService', () => ({
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('../../config/storage', () => ({
  initializeBucket: jest.fn().mockResolvedValue(),
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getFileNameFromUrl: jest.fn(),
  testConnection: jest.fn(),
  BUCKET_NAME: 'test-bucket',
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (_req, _res, next) => next());
});

// Import modules AFTER mocks
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const uploadService = require('../../services/uploadService');
const { generateAccessToken } = require('../../utils/jwt');

describe('User Controller - Avatar Upload', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    avatar_url: null,
  };

  let authToken;

  beforeAll(() => {
    authToken = generateAccessToken({ userId: mockUser.id });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock functions for User model
    User.getUserById = jest.fn();
    User.updateUserProfile = jest.fn();
    // Don't reset uploadService mocks - they're set up in the factory function
  });

  // Helper to create a mock image buffer
  const createMockImageBuffer = (sizeInBytes = 1024) => {
    return Buffer.alloc(sizeInBytes);
  };

  describe('Success cases', () => {
    it('should upload JPEG avatar successfully', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);
      uploadService.deleteAvatar.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.avatar_url).toBe(newAvatarUrl);
      expect(response.body.message).toBe('Avatar uploaded successfully');
      expect(uploadService.uploadAvatar).toHaveBeenCalled();
      expect(User.updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        avatar_url: newAvatarUrl,
      });
    });

    it('should upload PNG avatar successfully', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.png';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(2048), 'test.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.avatar_url).toBe(newAvatarUrl);
    });

    it('should upload GIF avatar successfully', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.gif';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1500), 'test.gif');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should replace existing avatar and delete old one', async () => {
      const oldAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/old.jpg';
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/new.jpg';
      const userWithAvatar = { ...mockUser, avatar_url: oldAvatarUrl };
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(userWithAvatar);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);
      uploadService.deleteAvatar.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'new.jpg');

      expect(response.status).toBe(200);
      expect(response.body.data.user.avatar_url).toBe(newAvatarUrl);
      expect(uploadService.deleteAvatar).toHaveBeenCalledWith(oldAvatarUrl);
    });

    it('should succeed even if old avatar deletion fails', async () => {
      const oldAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/old.jpg';
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/new.jpg';
      const userWithAvatar = { ...mockUser, avatar_url: oldAvatarUrl };
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(userWithAvatar);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);
      uploadService.deleteAvatar.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'new.jpg');

      // Should still succeed
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Validation errors (400)', () => {
    it('should return 400 if no file provided', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_FILE_PROVIDED');
    });

    it('should return 400 for file too large (>5MB)', async () => {
      const largeBuffer = createMockImageBuffer(6 * 1024 * 1024); // 6MB

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', largeBuffer, 'large.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('should return 400 for invalid file type (PDF)', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'document.pdf');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(['INVALID_FILE_TYPE', 'INVALID_FILE_EXTENSION']).toContain(response.body.error.code);
    });

    it('should return 400 for invalid file type (TXT)', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(512), 'file.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for wrong field name', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication errors (401)', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid auth token', async () => {
      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', 'Bearer invalid-token')
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(401);
    });
  });

  describe('Server errors (500)', () => {
    it('should return 404 if user not found', async () => {
      User.getUserById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 500 if upload to MinIO fails', async () => {
      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockRejectedValue(new Error('MinIO connection failed'));

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UPLOAD_FAILED');
    });

    it('should return 500 and cleanup if database update fails', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(null);
      uploadService.deleteAvatar.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATABASE_UPDATE_FAILED');
      expect(uploadService.deleteAvatar).toHaveBeenCalledWith(newAvatarUrl);
    });

    it('should return 500 and cleanup if database throws error', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockRejectedValue(new Error('Database error'));
      uploadService.deleteAvatar.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(uploadService.deleteAvatar).toHaveBeenCalledWith(newAvatarUrl);
    });

    it('should handle unexpected errors gracefully', async () => {
      User.getUserById.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Edge cases', () => {
    it('should handle maximum allowed file size (5MB)', async () => {
      // Use slightly less than 5MB to avoid boundary issues with Multer
      const maxBuffer = createMockImageBuffer(5 * 1024 * 1024 - 1024);
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', maxBuffer, 'max-size.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle minimum file size', async () => {
      const minBuffer = createMockImageBuffer(100);
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', minBuffer, 'tiny.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle special characters in filename', async () => {
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(mockUser);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'my avatar (1) [final].jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle user with no existing avatar', async () => {
      const userWithoutAvatar = { ...mockUser, avatar_url: null };
      const newAvatarUrl = 'http://localhost:9000/chatterbox-avatars/avatars/user-id/avatar.jpg';
      const updatedUser = { ...mockUser, avatar_url: newAvatarUrl };

      User.getUserById.mockResolvedValue(userWithoutAvatar);
      uploadService.uploadAvatar.mockResolvedValue(newAvatarUrl);
      User.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/me/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', createMockImageBuffer(1024), 'first-avatar.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(uploadService.deleteAvatar).not.toHaveBeenCalled();
    });
  });
});
