const request = require('supertest');
const app = require('../../app');
const { query, closePool } = require('../../config/database');

const PASSWORD = 'TestPass123';
const SENT_MESSAGE = 'If that username exists, they will see your request';

async function cleanup() {
  await query("DELETE FROM users WHERE email LIKE '%creqtest@example.com'");
}

async function register(name) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username: `creq_${name}`, email: `${name}creqtest@example.com`, password: PASSWORD })
    .expect(201);

  return {
    id: response.body.data.user.id,
    username: `creq_${name}`,
    token: response.body.data.accessToken,
  };
}

const as = (user, req) => req.set('Authorization', `Bearer ${user.token}`);

const sendRequest = (from, username) =>
  as(from, request(app).post('/api/contact-requests')).send({ username });

const listRequests = (user, type) =>
  as(user, request(app).get(`/api/contact-requests${type ? `?type=${type}` : ''}`));

const respond = (user, requestId, action) =>
  as(user, request(app).put(`/api/contact-requests/${requestId}/${action}`));

async function receivedRequestId(user) {
  const response = await listRequests(user, 'received').expect(200);
  return response.body.data.requests[0]?.id;
}

describe('Contact requests API', () => {
  const originalEnv = { ...process.env };
  let alice;
  let bob;
  let carol;
  let io;
  let emitted;

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    process.env = originalEnv;
    app.set('io', undefined);
    await cleanup();
    await closePool();
  });

  beforeEach(async () => {
    await cleanup();
    alice = await register('alice');
    bob = await register('bob');
    carol = await register('carol');

    // Record socket events as { room(s), event, payload }
    emitted = [];
    io = {
      in: jest.fn(() => ({ socketsJoin: jest.fn() })),
      to: jest.fn(rooms => ({
        emit: (event, payload) => emitted.push({ rooms, event, payload }),
      })),
    };
    app.set('io', io);
  });

  describe('POST /api/contact-requests', () => {
    it('should require authentication', async () => {
      await request(app).post('/api/contact-requests').send({ username: bob.username }).expect(401);
    });

    it('should create a pending request and notify the recipient', async () => {
      const response = await sendRequest(alice, bob.username).expect(200);
      expect(response.body).toEqual({ success: true, message: SENT_MESSAGE });

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(1);
      expect(received.body.data.requests[0].user).toEqual({
        id: alice.id,
        username: alice.username,
        displayName: alice.username,
        avatarUrl: null,
      });

      const sent = await listRequests(alice, 'sent').expect(200);
      expect(sent.body.data.requests).toHaveLength(1);
      expect(sent.body.data.requests[0].user.username).toBe(bob.username);

      expect(emitted).toContainEqual({
        rooms: `user:${bob.id}`,
        event: 'contact-request:received',
        payload: { requestId: received.body.data.requests[0].id },
      });
    });

    it('should never return an email address', async () => {
      await sendRequest(alice, bob.username).expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      expect(JSON.stringify(received.body)).not.toContain('@example.com');
    });

    it('should respond identically for a username that does not exist', async () => {
      const real = await sendRequest(alice, bob.username).expect(200);
      const missing = await sendRequest(alice, 'creq_nobody_here').expect(200);

      expect(missing.body).toEqual(real.body);

      const result = await query(
        'SELECT COUNT(*)::int AS count FROM contact_requests WHERE sender_id = $1',
        [alice.id]
      );
      expect(result.rows[0].count).toBe(1);
    });

    it('should not match part of a username', async () => {
      await sendRequest(alice, bob.username.slice(0, -1)).expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
    });

    it('should not duplicate a request that is already pending', async () => {
      await sendRequest(alice, bob.username).expect(200);
      const again = await sendRequest(alice, bob.username).expect(200);
      expect(again.body.message).toBe(SENT_MESSAGE);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(1);
    });

    it('should refuse a request to yourself', async () => {
      const response = await sendRequest(alice, alice.username).expect(400);
      expect(response.body.error.code).toBe('CANNOT_REQUEST_SELF');
    });

    it.each([[''], ['ab'], ['has space'], ['a'.repeat(51)], [undefined], [123]])(
      'should reject the invalid username %p',
      async username => {
        const response = await sendRequest(alice, username).expect(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    );

    it('should connect both users when each has asked the other', async () => {
      await sendRequest(alice, bob.username).expect(200);
      const response = await sendRequest(bob, alice.username).expect(200);
      expect(response.body.message).toBe(SENT_MESSAGE);

      const row = await query('SELECT status FROM contact_requests WHERE sender_id = $1', [
        alice.id,
      ]);
      expect(row.rows[0].status).toBe('accepted');

      const conversations = await as(bob, request(app).get('/api/conversations')).expect(200);
      expect(conversations.body.conversations).toHaveLength(1);
    });

    it('should silently drop a request when either user has blocked the other', async () => {
      await query(
        'INSERT INTO contacts (user_id, contact_user_id, is_blocked) VALUES ($1, $2, TRUE)',
        [bob.id, alice.id]
      );

      await sendRequest(alice, bob.username).expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
    });

    it('should not create a request to the site owner', async () => {
      process.env.OWNER_USER_ID = bob.id;

      await sendRequest(alice, bob.username).expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
      process.env.OWNER_USER_ID = '';
    });
  });

  describe('GET /api/contact-requests', () => {
    it('should default to received requests', async () => {
      await sendRequest(alice, bob.username).expect(200);

      const response = await listRequests(bob).expect(200);
      expect(response.body.data.type).toBe('received');
      expect(response.body.data.requests).toHaveLength(1);
    });

    it('should reject an unknown type', async () => {
      await listRequests(bob, 'everything').expect(400);
    });

    it("should not show other people's requests", async () => {
      await sendRequest(alice, bob.username).expect(200);

      const received = await listRequests(carol, 'received').expect(200);
      const sent = await listRequests(carol, 'sent').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
      expect(sent.body.data.requests).toHaveLength(0);
    });
  });

  describe('PUT /api/contact-requests/:requestId/accept', () => {
    let requestId;

    beforeEach(async () => {
      await sendRequest(alice, bob.username).expect(200);
      requestId = await receivedRequestId(bob);
      emitted.length = 0;
    });

    it('should create contacts both ways and the direct conversation', async () => {
      const response = await respond(bob, requestId, 'accept').expect(200);
      const { conversationId } = response.body.data;
      expect(response.body.data.status).toBe('accepted');

      const contacts = await query(
        `SELECT user_id, contact_user_id FROM contacts
         WHERE (user_id = $1 AND contact_user_id = $2) OR (user_id = $2 AND contact_user_id = $1)`,
        [alice.id, bob.id]
      );
      expect(contacts.rows).toHaveLength(2);

      for (const user of [alice, bob]) {
        const conversations = await as(user, request(app).get('/api/conversations')).expect(200);
        expect(conversations.body.conversations.map(c => c.id)).toEqual([conversationId]);
      }
    });

    it('should tell the sender and put both users in the conversation room', async () => {
      const response = await respond(bob, requestId, 'accept').expect(200);
      const { conversationId } = response.body.data;

      expect(emitted).toContainEqual({
        rooms: `user:${alice.id}`,
        event: 'contact-request:accepted',
        payload: { requestId, conversationId },
      });
      expect(emitted).toContainEqual({
        rooms: [`user:${alice.id}`, `user:${bob.id}`],
        event: 'conversation:new',
        payload: { conversationId },
      });
    });

    it('should clear the request from both lists', async () => {
      await respond(bob, requestId, 'accept').expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      const sent = await listRequests(alice, 'sent').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
      expect(sent.body.data.requests).toHaveLength(0);
    });

    it('should not let the sender accept their own request', async () => {
      await respond(alice, requestId, 'accept').expect(404);
    });

    it('should not let a third user accept it', async () => {
      await respond(carol, requestId, 'accept').expect(404);
    });

    it('should not accept the same request twice', async () => {
      await respond(bob, requestId, 'accept').expect(200);
      await respond(bob, requestId, 'accept').expect(404);
    });

    it('should reject a malformed request ID', async () => {
      await respond(bob, 'not-a-uuid', 'accept').expect(400);
    });

    it('should lift the lockdown between the two users only', async () => {
      process.env.OWNER_ONLY_MODE = 'true';
      process.env.OWNER_USER_ID = '99999999-9999-4999-8999-999999999999';

      const direct = participantId =>
        as(alice, request(app).post('/api/conversations/direct')).send({ participantId });

      await direct(bob.id).expect(403);
      await respond(bob, requestId, 'accept').expect(200);

      await direct(bob.id).expect(200);
      await as(alice, request(app).get(`/api/users/${bob.id}`)).expect(200);
      await direct(carol.id).expect(403);
      await as(alice, request(app).get(`/api/users/${carol.id}`)).expect(403);

      process.env.OWNER_ONLY_MODE = '';
      process.env.OWNER_USER_ID = '';
    });
  });

  describe('PUT /api/contact-requests/:requestId/reject', () => {
    let requestId;

    beforeEach(async () => {
      await sendRequest(alice, bob.username).expect(200);
      requestId = await receivedRequestId(bob);
      emitted.length = 0;
    });

    it('should reject without creating anything or telling the sender', async () => {
      const response = await respond(bob, requestId, 'reject').expect(200);
      expect(response.body.data.status).toBe('rejected');

      const contacts = await query('SELECT 1 FROM contacts WHERE user_id = $1 OR user_id = $2', [
        alice.id,
        bob.id,
      ]);
      expect(contacts.rows).toHaveLength(0);
      expect(emitted).toHaveLength(0);
    });

    it('should not let anyone but the recipient reject it', async () => {
      await respond(alice, requestId, 'reject').expect(404);
      await respond(carol, requestId, 'reject').expect(404);
    });

    it('should ignore a re-send from the rejected sender within 30 days', async () => {
      await respond(bob, requestId, 'reject').expect(200);

      const response = await sendRequest(alice, bob.username).expect(200);
      expect(response.body.message).toBe(SENT_MESSAGE);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(0);
    });

    it('should allow a re-send once 30 days have passed', async () => {
      await respond(bob, requestId, 'reject').expect(200);
      await query(
        "UPDATE contact_requests SET responded_at = CURRENT_TIMESTAMP - INTERVAL '31 days' WHERE id = $1",
        [requestId]
      );

      await sendRequest(alice, bob.username).expect(200);

      const received = await listRequests(bob, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(1);
    });

    it('should let the person who rejected ask the other way straight away', async () => {
      await respond(bob, requestId, 'reject').expect(200);

      await sendRequest(bob, alice.username).expect(200);

      const received = await listRequests(alice, 'received').expect(200);
      expect(received.body.data.requests).toHaveLength(1);
      expect(received.body.data.requests[0].user.id).toBe(bob.id);
    });
  });
});
