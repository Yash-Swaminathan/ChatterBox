const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../config/database');
const { generateAccessToken } = require('../../utils/jwt');
const { hashPassword } = require('../../utils/bcrypt');

describe('Message Search API', () => {
  let testUsers = [];
  let testConversations = [];
  let testMessages = [];
  let authTokens = {};

  beforeAll(async () => {
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM conversation_participants');
    await pool.query('DELETE FROM conversations');
    await pool.query("DELETE FROM users WHERE email LIKE '%test-search-%'");

    const userCount = 3;
    for (let i = 0; i < userCount; i++) {
      const hashedPassword = await hashPassword('Password123');
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, is_active, email_verified)
         VALUES ($1, $2, $3, true, true)
         RETURNING id, username, email`,
        [`searchuser${i}`, `test-search-${i}@example.com`, hashedPassword]
      );
      testUsers.push(result.rows[0]);
      authTokens[result.rows[0].id] = generateAccessToken({
        userId: result.rows[0].id,
        username: result.rows[0].username,
      });
    }

    const convResult1 = await pool.query(
      `INSERT INTO conversations (type)
       VALUES ('direct')
       RETURNING id`
    );
    testConversations.push(convResult1.rows[0].id);

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [testConversations[0], testUsers[0].id, testUsers[1].id]
    );

    const convResult2 = await pool.query(
      `INSERT INTO conversations (type)
       VALUES ('direct')
       RETURNING id`
    );
    testConversations.push(convResult2.rows[0].id);

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [testConversations[1], testUsers[0].id, testUsers[2].id]
    );

    const messageTexts = [
      'Hello world, this is a test message',
      'Running through the forest quickly',
      'The quick brown fox jumps',
      'Database query optimization',
      'Full-text search with PostgreSQL',
      'React components and hooks',
      'Node.js backend development',
      'Testing with Jest framework',
      'API endpoint integration',
      'Message search functionality',
    ];

    for (let i = 0; i < messageTexts.length; i++) {
      const convId = i % 2 === 0 ? testConversations[0] : testConversations[1];
      const senderId = i % 2 === 0 ? testUsers[0].id : testUsers[1].id;

      const msgResult = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [convId, senderId, messageTexts[i]]
      );
      testMessages.push({ id: msgResult.rows[0].id, content: messageTexts[i] });
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM messages WHERE conversation_id = ANY($1)', [testConversations]);
    await pool.query('DELETE FROM conversation_participants WHERE conversation_id = ANY($1)', [
      testConversations,
    ]);
    await pool.query('DELETE FROM conversations WHERE id = ANY($1)', [testConversations]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [testUsers.map(u => u.id)]);
    await pool.end();
  });

  describe('1. Basic Search', () => {
    test('should return messages from global search', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=message')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toBeDefined();
      expect(response.body.data.messages.length).toBeGreaterThan(0);
      expect(response.body.data.query).toBe('message');
    });

    test('should return messages from conversation-scoped search', async () => {
      const response = await request(app)
        .get(`/api/messages/search?q=test&conversationId=${testConversations[0]}`)
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversationId).toBe(testConversations[0]);
    });

    test('should exclude soft-deleted messages by default', async () => {
      const msgToDelete = testMessages[0].id;
      await pool.query('UPDATE messages SET deleted_at = NOW() WHERE id = $1', [msgToDelete]);

      const response = await request(app)
        .get('/api/messages/search?q=Hello')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      const foundDeleted = response.body.data.messages.some(m => m.id === msgToDelete);
      expect(foundDeleted).toBe(false);

      await pool.query('UPDATE messages SET deleted_at = NULL WHERE id = $1', [msgToDelete]);
    });

    test('should return validation error for empty query', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return empty array when no results found', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=nonexistentquery12345xyz')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.hasMore).toBe(false);
    });
  });

  describe('2. Full-Text Search Accuracy', () => {
    test('should find exact word match', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=PostgreSQL')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      const found = response.body.data.messages.some(m => m.content.includes('PostgreSQL'));
      expect(found).toBe(true);
    });

    test('should handle stemming (run finds running)', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=run')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      const found = response.body.data.messages.some(m => m.content.includes('Running'));
      expect(found).toBe(true);
    });

    test('should be case-insensitive', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=HELLO')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      const found = response.body.data.messages.some(m => m.content.toLowerCase().includes('hello'));
      expect(found).toBe(true);
    });

    test('should not match partial words', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=hel')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages.length).toBe(0);
    });

    test('should sanitize special characters', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=%27OR%201=1--')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('3. Privacy & Authorization', () => {
    test('should only return messages from user conversations', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=message')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      response.body.data.messages.forEach(msg => {
        expect([testConversations[0], testConversations[1]]).toContain(msg.conversation_id);
      });
    });

    test.skip('should not return messages from conversation user left', async () => {
      // SKIP: left_at column doesn't exist yet - planned for Week 7-8 (group chats)
      // Will implement when conversation_participants.left_at is added
      await pool.query(
        'UPDATE conversation_participants SET left_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
        [testConversations[0], testUsers[0].id]
      );

      const response = await request(app)
        .get('/api/messages/search?q=test')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      const foundFromLeft = response.body.data.messages.some(
        m => m.conversation_id === testConversations[0]
      );
      expect(foundFromLeft).toBe(false);

      await pool.query(
        'UPDATE conversation_participants SET left_at = NULL WHERE conversation_id = $1 AND user_id = $2',
        [testConversations[0], testUsers[0].id]
      );
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await request(app).get('/api/messages/search?q=test');

      expect(response.status).toBe(401);
    });
  });

  describe('4. Pagination', () => {
    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test&limit=2')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages.length).toBeLessThanOrEqual(2);
    });

    test('should return nextCursor when more results exist', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test&limit=1')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      if (response.body.data.hasMore) {
        expect(response.body.data.nextCursor).toBeTruthy();
        expect(response.body.data.nextCursor).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z:[a-f0-9-]{36}$/);
      }
    });

    test('should return hasMore: false on last page', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=nonexistentxyz')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.data.hasMore).toBe(false);
      expect(response.body.data.nextCursor).toBeNull();
    });

    test('should return validation error for invalid cursor format', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test&cursor=invalid-cursor')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Edge Cases', () => {
    test('should trim whitespace from query', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=%20%20message%20%20')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject query with only whitespace', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=%20%20%20')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle invalid conversationId format', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test&conversationId=not-a-uuid')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return empty results for non-existent conversationId', async () => {
      const fakeUuid = '00000000-0000-4000-8000-000000000000'; // Valid v4 UUID that doesn't exist
      const response = await request(app)
        .get(`/api/messages/search?q=test&conversationId=${fakeUuid}`)
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages).toEqual([]);
    });

    test('should handle limit outside valid range', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test&limit=200')
        .set('Authorization', `Bearer ${authTokens[testUsers[0].id]}`);

      expect(response.status).toBe(400);
    });
  });
});
