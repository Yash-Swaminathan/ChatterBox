jest.mock('../../models/Contact');
jest.mock('../../models/User');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { generateAccessToken } = require('../../utils/jwt');
const Contact = require('../../models/Contact');
const User = require('../../models/User');

describe('Contact Controller Integration Tests', () => {
  let authToken;
  let userId;
  let contactUserId;
  let contactId;
  let otherContactId;

  beforeAll(() => {
    userId = '550e8400-e29b-41d4-a716-446655440000';
    contactUserId = '550e8400-e29b-41d4-a716-446655440001';
    contactId = '550e8400-e29b-41d4-a716-446655440002';
    otherContactId = '550e8400-e29b-41d4-a716-446655440003';
    authToken = generateAccessToken({
      userId,
      username: 'testuser',
      email: 'test@example.com',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SKIP_RATE_LIMIT = 'true';
  });

  afterAll(() => {
    delete process.env.SKIP_RATE_LIMIT;
  });

  describe('POST /api/contacts - Add Contact', () => {
    it('should add contact successfully', async () => {
      User.findById = jest.fn().mockResolvedValue({
        id: contactUserId,
        username: 'alice',
        email: 'alice@example.com',
      });

      Contact.create = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        nickname: null,
        isBlocked: false,
        isFavorite: false,
        addedAt: new Date(),
        created: true,
      });

      Contact.getContactDetails = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        nickname: null,
        isBlocked: false,
        isFavorite: false,
        addedAt: new Date(),
        user: {
          id: contactUserId,
          username: 'alice',
          email: 'alice@example.com',
        },
      });

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.id).toBe(contactId);
      expect(response.body.data.created).toBe(true);
      expect(User.findById).toHaveBeenCalledWith(contactUserId);
      expect(Contact.create).toHaveBeenCalledWith(userId, contactUserId, undefined);
    });

    it('should return 200 if contact already exists (idempotent)', async () => {
      User.findById = jest.fn().mockResolvedValue({
        id: contactUserId,
        username: 'alice',
      });

      Contact.create = jest.fn().mockResolvedValue({
        id: otherContactId,
        userId,
        contactUserId,
        created: false,
      });

      Contact.getContactDetails = jest.fn().mockResolvedValue({
        id: otherContactId,
        userId,
        contactUserId,
        user: { id: contactUserId, username: 'alice' },
      });

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(false);
    });

    it('should return 400 if trying to add self', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('Cannot add yourself');
    });

    it('should return 404 if target user does not exist', async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('User not found');
    });

    it('should add contact with nickname', async () => {
      User.findById = jest.fn().mockResolvedValue({
        id: contactUserId,
        username: 'alice',
      });

      Contact.create = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        nickname: 'Best Friend',
        created: true,
      });

      Contact.getContactDetails = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        nickname: 'Best Friend',
        user: { id: contactUserId, username: 'alice' },
      });

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId, nickname: 'Best Friend' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.nickname).toBe('Best Friend');
      expect(Contact.create).toHaveBeenCalledWith(userId, contactUserId, 'Best Friend');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .send({ userId: contactUserId })
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
      expect(response.body.error.message).toBe('No authentication token provided');
    });

    it('should validate userId format (must be UUID)', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'invalid-uuid' })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('valid UUID');
    });

    it('should validate nickname length (max 100)', async () => {
      const longNickname = 'a'.repeat(101);

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId, nickname: longNickname })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('100 characters');
    });

    it('should handle database errors gracefully', async () => {
      User.findById = jest.fn().mockResolvedValue({
        id: contactUserId,
        username: 'alice',
      });

      Contact.create = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: contactUserId })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should require userId in request body', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('userId is required');
    });
  });

  describe('GET /api/contacts - List Contacts', () => {
    it('should list contacts with default pagination', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([
        {
          id: 'contact-1',
          userId,
          contactUserId: 'user-1',
          nickname: 'Alice',
          user: { id: 'user-1', username: 'alice' },
        },
        {
          id: 'contact-2',
          userId,
          contactUserId: 'user-2',
          nickname: null,
          user: { id: 'user-2', username: 'bob' },
        },
      ]);

      Contact.countByUser = jest.fn().mockResolvedValue(2);

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
      expect(response.body.data.pagination.limit).toBe(50);
      expect(response.body.data.pagination.offset).toBe(0);
      expect(Contact.findByUser).toHaveBeenCalledWith(userId, 50, 0, false);
    });

    it('should respect limit parameter (max 200)', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([]);
      Contact.countByUser = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/api/contacts?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Contact.findByUser).toHaveBeenCalledWith(userId, 10, 0, false);
    });

    it('should respect offset parameter', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([]);
      Contact.countByUser = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/api/contacts?offset=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Contact.findByUser).toHaveBeenCalledWith(userId, 50, 10, false);
    });

    it('should filter blocked contacts by default', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([]);
      Contact.countByUser = jest.fn().mockResolvedValue(0);

      await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Contact.findByUser).toHaveBeenCalledWith(userId, 50, 0, false);
    });

    it('should include blocked contacts when requested', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([]);
      Contact.countByUser = jest.fn().mockResolvedValue(0);

      await request(app)
        .get('/api/contacts?includeBlocked=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Contact.findByUser).toHaveBeenCalledWith(userId, 50, 0, true);
    });

    it('should return empty array if no contacts', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue([]);
      Contact.countByUser = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should return hasMore flag correctly', async () => {
      Contact.findByUser = jest.fn().mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `contact-${i}`,
          userId,
          contactUserId: `user-${i}`,
        }))
      );
      Contact.countByUser = jest.fn().mockResolvedValue(20);

      const response = await request(app)
        .get('/api/contacts?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    it('should validate limit parameter (must be 1-200)', async () => {
      const response = await request(app)
        .get('/api/contacts?limit=300')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/contacts/:contactId - Remove Contact', () => {
    it('should delete contact successfully', async () => {
      Contact.findById = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
      });

      Contact.deleteContact = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed successfully');
      expect(Contact.deleteContact).toHaveBeenCalledWith(contactId);
    });

    it('should return 404 if contact not found', async () => {
      Contact.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/contacts/${otherContactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Contact not found');
    });

    it('should return 403 if user does not own contact', async () => {
      Contact.findById = jest.fn().mockResolvedValue({
        id: contactId,
        userId: 'other-user-id',
        contactUserId,
      });

      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('permission');
    });

    it('should validate contactId format (UUID)', async () => {
      const response = await request(app)
        .delete('/api/contacts/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('valid UUID');
    });

    it('should handle database errors gracefully', async () => {
      Contact.findById = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
      });

      Contact.deleteContact = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('PUT /api/contacts/:contactId - Update Contact', () => {
    it('should update nickname successfully', async () => {
      Contact.findById = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        isFavorite: false,
      });

      Contact.updateNickname = jest.fn().mockResolvedValue({
        id: contactId,
        nickname: 'New Nickname',
      });

      Contact.getContactDetails = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        nickname: 'New Nickname',
        user: { id: contactUserId, username: 'alice' },
      });

      const response = await request(app)
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nickname: 'New Nickname' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.nickname).toBe('New Nickname');
      expect(Contact.updateNickname).toHaveBeenCalledWith(contactId, 'New Nickname');
    });

    it('should update favorite status successfully', async () => {
      Contact.findById = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        isFavorite: false,
      });

      Contact.toggleFavorite = jest.fn().mockResolvedValue({
        id: contactId,
        isFavorite: true,
      });

      Contact.getContactDetails = jest.fn().mockResolvedValue({
        id: contactId,
        userId,
        contactUserId,
        isFavorite: true,
        user: { id: contactUserId, username: 'alice' },
      });

      const response = await request(app)
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isFavorite: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Contact.toggleFavorite).toHaveBeenCalledWith(contactId);
    });

    it('should return 404 if contact not found', async () => {
      Contact.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/contacts/${otherContactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nickname: 'Test' })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });

    it('should validate nickname length (max 100)', async () => {
      const longNickname = 'a'.repeat(101);

      const response = await request(app)
        .put('/api/contacts/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nickname: longNickname })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('100 characters');
    });

    it('should validate isFavorite type (boolean)', async () => {
      const response = await request(app)
        .put('/api/contacts/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isFavorite: 'true' })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('boolean');
    });

    it('should require at least one field', async () => {
      const response = await request(app)
        .put('/api/contacts/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('At least one field');
    });
  });

  describe('GET /api/contacts/exists/:userId - Check Contact Exists', () => {
    it('should return true if contact exists', async () => {
      Contact.isContact = jest.fn().mockResolvedValue(true);
      Contact.findByUser = jest.fn().mockResolvedValue([
        { id: contactId, contactUserId },
      ]);

      const response = await request(app)
        .get(`/api/contacts/exists/${contactUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(true);
      expect(response.body.data.contactId).toBe(contactId);
    });

    it('should return false if contact does not exist', async () => {
      Contact.isContact = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .get(`/api/contacts/exists/${contactUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(false);
      expect(response.body.data.contactId).toBeNull();
    });

    it('should validate userId format (UUID)', async () => {
      const response = await request(app)
        .get('/api/contacts/exists/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('valid UUID');
    });
  });
});
