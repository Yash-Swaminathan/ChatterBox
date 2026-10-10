const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const Contact = require('../../models/Contact');
const ContactRequest = require('../../models/ContactRequest');
const { generateAccessToken } = require('../../utils/jwt');

jest.mock('../../models/User');
jest.mock('../../models/Conversation');
jest.mock('../../models/Contact');
jest.mock('../../models/ContactRequest');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (_req, _res, next) => next());
});

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_VISITOR_ID = '33333333-3333-4333-8333-333333333333';

describe('Owner-only mode', () => {
  const originalEnv = { ...process.env };
  let ownerToken;
  let visitorToken;

  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    ownerToken = generateAccessToken({ userId: OWNER_ID });
    visitorToken = generateAccessToken({ userId: VISITOR_ID });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_USER_ID = OWNER_ID;
    process.env.OWNER_ONLY_MODE = 'true';

    // Controllers reached past the guard just report "not found"; the guard is what is under test
    User.searchUsers = jest.fn().mockResolvedValue({ users: [], total: 0 });
    User.isValidUUID = jest.fn().mockReturnValue(true);
    User.getPublicUserById = jest.fn().mockResolvedValue(null);
    User.findById = jest.fn().mockResolvedValue(null);
    User.findByIds = jest.fn().mockResolvedValue([]);
    Conversation.getOrCreateDirect = jest.fn();
    Conversation.createGroup = jest.fn();
    Contact.create = jest.fn();
    // No accepted connections unless a test says otherwise
    ContactRequest.filterConnected = jest.fn().mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/users/search', () => {
    it('should refuse a visitor', async () => {
      const response = await as(visitorToken, request(app).get('/api/users/search?q=jo'));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('OWNER_ONLY');
      expect(User.searchUsers).not.toHaveBeenCalled();
    });

    it('should allow the owner', async () => {
      const response = await as(ownerToken, request(app).get('/api/users/search?q=jo'));

      expect(response.status).toBe(200);
      expect(User.searchUsers).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:userId', () => {
    it("should refuse a visitor viewing another visitor's profile", async () => {
      const response = await as(visitorToken, request(app).get(`/api/users/${OTHER_VISITOR_ID}`));

      expect(response.status).toBe(403);
      expect(User.getPublicUserById).not.toHaveBeenCalled();
    });

    it("should allow a visitor to view the owner's profile", async () => {
      const response = await as(visitorToken, request(app).get(`/api/users/${OWNER_ID}`));

      expect(response.status).not.toBe(403);
      expect(User.getPublicUserById).toHaveBeenCalledWith(OWNER_ID);
    });

    it('should allow a visitor to view their own profile', async () => {
      const response = await as(visitorToken, request(app).get(`/api/users/${VISITOR_ID}`));

      expect(response.status).not.toBe(403);
    });

    it("should allow the owner to view a visitor's profile", async () => {
      const response = await as(ownerToken, request(app).get(`/api/users/${VISITOR_ID}`));

      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/conversations/direct', () => {
    it('should refuse a visitor starting a chat with another visitor', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/direct')).send({
        participantId: OTHER_VISITOR_ID,
      });

      expect(response.status).toBe(403);
      expect(Conversation.getOrCreateDirect).not.toHaveBeenCalled();
    });

    it('should allow a visitor to start a chat with the owner', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/direct')).send({
        participantId: OWNER_ID,
      });

      expect(response.status).not.toBe(403);
      expect(User.findById).toHaveBeenCalledWith(OWNER_ID);
    });

    it('should allow the owner to start a chat with a visitor', async () => {
      const response = await as(ownerToken, request(app).post('/api/conversations/direct')).send({
        participantId: VISITOR_ID,
      });

      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/conversations/group', () => {
    const body = { participantIds: [VISITOR_ID, OTHER_VISITOR_ID, OWNER_ID] };

    it('should refuse a visitor', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/group')).send(
        body
      );

      expect(response.status).toBe(403);
      expect(Conversation.createGroup).not.toHaveBeenCalled();
    });

    it('should allow the owner', async () => {
      const response = await as(ownerToken, request(app).post('/api/conversations/group')).send(
        body
      );

      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/contacts', () => {
    it('should refuse a visitor adding another visitor', async () => {
      const response = await as(visitorToken, request(app).post('/api/contacts')).send({
        userId: OTHER_VISITOR_ID,
      });

      expect(response.status).toBe(403);
      expect(Contact.create).not.toHaveBeenCalled();
    });

    it('should allow a visitor to add the owner', async () => {
      const response = await as(visitorToken, request(app).post('/api/contacts')).send({
        userId: OWNER_ID,
      });

      expect(response.status).not.toBe(403);
    });
  });

  describe('with an accepted connection', () => {
    beforeEach(() => {
      ContactRequest.filterConnected.mockResolvedValue([OTHER_VISITOR_ID]);
    });

    it("should let a visitor view the connection's profile", async () => {
      const response = await as(visitorToken, request(app).get(`/api/users/${OTHER_VISITOR_ID}`));

      expect(response.status).not.toBe(403);
      expect(User.getPublicUserById).toHaveBeenCalledWith(OTHER_VISITOR_ID);
    });

    it('should let a visitor start a chat with the connection', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/direct')).send({
        participantId: OTHER_VISITOR_ID,
      });

      expect(response.status).not.toBe(403);
      expect(User.findById).toHaveBeenCalledWith(OTHER_VISITOR_ID);
    });

    it('should let a visitor create a group of the owner and connections', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/group')).send({
        participantIds: [VISITOR_ID, OTHER_VISITOR_ID, OWNER_ID],
      });

      expect(response.status).not.toBe(403);
    });

    it('should refuse a group that includes someone who is not a connection', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/group')).send({
        participantIds: [OTHER_VISITOR_ID, OWNER_ID, '55555555-5555-4555-8555-555555555555'],
      });

      expect(response.status).toBe(403);
      expect(Conversation.createGroup).not.toHaveBeenCalled();
    });

    it('should still refuse user search', async () => {
      const response = await as(visitorToken, request(app).get('/api/users/search?q=jo'));

      expect(response.status).toBe(403);
    });
  });

  describe('with the mode off', () => {
    beforeEach(() => {
      delete process.env.OWNER_ONLY_MODE;
    });

    it('should let a visitor search users', async () => {
      const response = await as(visitorToken, request(app).get('/api/users/search?q=jo'));

      expect(response.status).toBe(200);
    });

    it('should let a visitor start a chat with another visitor', async () => {
      const response = await as(visitorToken, request(app).post('/api/conversations/direct')).send({
        participantId: OTHER_VISITOR_ID,
      });

      expect(response.status).not.toBe(403);
    });
  });
});
