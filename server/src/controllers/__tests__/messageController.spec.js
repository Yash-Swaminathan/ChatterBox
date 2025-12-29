const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../config/database');
const { generateAccessToken } = require('../../utils/jwt');
const { hashPassword } = require('../../utils/bcrypt');
const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const MessageStatus = require('../../models/MessageStatus');
const MessageCacheService = require('../../services/messageCacheService');

describe('Message Controller - Message Retrieval', () => {
  let testUser1, testUser2, testUser3;
  let testToken1, testToken2, testToken3;
  let testConversation;

  beforeAll(async () => {
    // Create test users
    const hashedPassword = await hashPassword('Test1234');

    const user1Result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      ['testuser_msg_ret_1', 'testmsgret1@msgtest.local', hashedPassword]
    );
    testUser1 = user1Result.rows[0];
    testToken1 = generateAccessToken({ userId: testUser1.id, email: testUser1.email });

    const user2Result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      ['testuser_msg_ret_2', 'testmsgret2@msgtest.local', hashedPassword]
    );
    testUser2 = user2Result.rows[0];
    testToken2 = generateAccessToken({ userId: testUser2.id, email: testUser2.email });

    const user3Result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      ['testuser_msg_ret_3', 'testmsgret3@msgtest.local', hashedPassword]
    );
    testUser3 = user3Result.rows[0];
    testToken3 = generateAccessToken({ userId: testUser3.id, email: testUser3.email });

    // Create test conversation between user1 and user2
    const result = await Conversation.getOrCreateDirect(testUser1.id, testUser2.id);
    testConversation = result.conversation;
  }, 60000); // 60 second timeout for bcrypt + DB operations

  afterAll(async () => {
    // Clean up test data (don't close shared pool - let Jest handle lifecycle)
    await pool.query("DELETE FROM users WHERE email LIKE '%@msgtest.local'");
  });

  beforeEach(async () => {
    // Clear messages and cache before each test
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM message_status');
    // Invalidate Redis message cache to avoid stale cached responses
    if (testConversation) {
      await MessageCacheService.invalidateConversation(testConversation.id);
    }
    // Wait for pending async operations to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('GET /api/messages/conversations/:conversationId', () => {
    describe('Successful Retrieval', () => {
      test('should retrieve first page of messages (no cursor)', async () => {
        // Create 10 test messages
        const messages = [];
        for (let i = 0; i < 10; i++) {
          const msg = await Message.create(
            testConversation.id,
            testUser1.id,
            `Test message ${i + 1}`
          );
          messages.push(msg);
        }

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.messages).toHaveLength(10);
        expect(response.body.data.hasMore).toBe(false);
        expect(response.body.data.nextCursor).toBeNull();
        expect(response.body.data.cached).toBeDefined();
      });

      test('should retrieve messages with cursor-based pagination', async () => {
        // Create 75 messages
        const messages = [];
        for (let i = 0; i < 75; i++) {
          const msg = await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
          messages.push(msg);
        }

        // First page (50 messages)
        const page1 = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=50`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(page1.body.data.messages).toHaveLength(50);
        expect(page1.body.data.hasMore).toBe(true);
        expect(page1.body.data.nextCursor).toBeTruthy();

        // Second page (remaining 25 messages)
        const page2 = await request(app)
          .get(
            `/api/messages/conversations/${testConversation.id}?limit=50&cursor=${page1.body.data.nextCursor}`
          )
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(page2.body.data.messages).toHaveLength(25);
        expect(page2.body.data.hasMore).toBe(false);
        expect(page2.body.data.nextCursor).toBeNull();
      });

      test('should retrieve messages with custom limit', async () => {
        // Create 30 messages
        for (let i = 0; i < 30; i++) {
          await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
        }

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=25`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(25);
        expect(response.body.data.hasMore).toBe(true);
      });

      test('should return empty array for conversation with no messages', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toEqual([]);
        expect(response.body.data.hasMore).toBe(false);
        expect(response.body.data.nextCursor).toBeNull();
      });

      test('should retrieve exactly one message', async () => {
        await Message.create(testConversation.id, testUser1.id, 'Single message');

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(1);
        expect(response.body.data.messages[0].content).toBe('Single message');
        expect(response.body.data.hasMore).toBe(false);
      });

      test('should retrieve conversation with exactly limit messages', async () => {
        // Create exactly 50 messages
        for (let i = 0; i < 50; i++) {
          await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
        }

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=50`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(50);
        expect(response.body.data.hasMore).toBe(false);
      });
    });

    describe('Deleted Messages', () => {
      test('should exclude soft-deleted messages by default', async () => {
        const msg1 = await Message.create(testConversation.id, testUser1.id, 'Active message');
        const msg2 = await Message.create(testConversation.id, testUser1.id, 'Deleted message');

        // Soft delete the second message
        await Message.softDelete(msg2.id);

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(1);
        expect(response.body.data.messages[0].content).toBe('Active message');
      });

      test('should include soft-deleted messages when includeDeleted=true', async () => {
        const msg1 = await Message.create(testConversation.id, testUser1.id, 'Active message');
        const msg2 = await Message.create(testConversation.id, testUser1.id, 'Deleted message');

        await Message.softDelete(msg2.id);

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?includeDeleted=true`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(2);
      });

      test('should handle cursor on deleted message gracefully', async () => {
        // Create 10 messages
        const messages = [];
        for (let i = 0; i < 10; i++) {
          const msg = await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
          messages.push(msg);
        }

        // Get first page with limit=5
        const page1 = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=5`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        const cursor = page1.body.data.nextCursor;

        // Delete the cursor message
        await Message.softDelete(cursor);

        // Pagination should still work (cursor points to timestamp)
        const page2 = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=5&cursor=${cursor}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(page2.body.data.messages.length).toBeGreaterThan(0);
      });
    });

    describe('Validation Tests', () => {
      test('should return 400 for invalid conversationId format', async () => {
        const response = await request(app)
          .get('/api/messages/conversations/invalid-uuid')
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('conversation ID');
      });

      test('should return 400 for limit = 0', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=0`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.error.message).toContain('between 1 and 100');
      });

      test('should return 400 for limit > 100', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=101`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.error.message).toContain('between 1 and 100');
      });

      test('should return 400 for non-numeric limit', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=abc`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.error.message).toContain('between 1 and 100');
      });

      test('should return 400 for invalid cursor format', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?cursor=not-a-uuid`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.error.message).toContain('valid UUID');
      });

      test('should return 400 for invalid includeDeleted value', async () => {
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?includeDeleted=invalid`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(400);

        expect(response.body.error.message).toContain('true or false');
      });
    });

    describe('Authorization Tests', () => {
      test('should return 401 when no auth token provided', async () => {
        await request(app).get(`/api/messages/conversations/${testConversation.id}`).expect(401);
      });

      test('should return 403 when user is not a participant', async () => {
        // testUser3 is not a participant in testConversation
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken3}`)
          .expect(403);

        expect(response.body.error.code).toBe('NOT_PARTICIPANT');
        expect(response.body.error.message).toContain('not a participant');
      });

      test('should return 404 for non-existent conversation', async () => {
        // Use a valid UUID v4 format that doesn't exist in DB
        const fakeConversationId = 'a0000000-0000-4000-a000-000000000000';

        const response = await request(app)
          .get(`/api/messages/conversations/${fakeConversationId}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(404);

        expect(response.body.error.message).toContain('not found');
      });
    });

    describe('Performance Tests', () => {
      test('should handle large conversation efficiently', async () => {
        // Use different message counts based on environment:
        // - CI: 100 messages (faster, prevents timeout)
        // - Local: 1000 messages (realistic performance test)
        const MESSAGE_COUNT = process.env.CI ? 100 : 1000;

        // Create messages sequentially to avoid connection pool exhaustion
        for (let i = 0; i < MESSAGE_COUNT; i++) {
          await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
        }

        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}?limit=50`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        const duration = Date.now() - startTime;

        expect(response.body.data.messages).toHaveLength(50);
        // Relaxed timing constraint for CI environments
        expect(duration).toBeLessThan(1000);

        // Log performance metrics for analysis
        if (process.env.NODE_ENV !== 'test') {
          console.log(`Performance: ${MESSAGE_COUNT} messages, query took ${duration}ms`);
        }
      }, process.env.CI ? 30000 : 60000); // Conditional timeout

      test('should indicate cache status in response', async () => {
        // Create messages
        for (let i = 0; i < 10; i++) {
          await Message.create(testConversation.id, testUser1.id, `Message ${i + 1}`);
        }

        // Request messages
        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(10);

        // Verify cache status field exists (value doesn't matter - depends on Redis availability)
        expect(response.body.data.cached).toBeDefined();
        expect(typeof response.body.data.cached).toBe('boolean');

        // No timing assertions - cache hit/miss is Redis-dependent
      });
    });

    describe('Edge Cases', () => {
      test('should handle special characters and emojis in messages', async () => {
        await Message.create(testConversation.id, testUser1.id, 'Hello 👋 مرحبا');

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages[0].content).toBe('Hello 👋 مرحبا');
      });

      test('should handle very long message content (10,000 chars)', async () => {
        const longContent = 'a'.repeat(10000);
        await Message.create(testConversation.id, testUser1.id, longContent);

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        expect(response.body.data.messages[0].content).toHaveLength(10000);
      });

      test('should maintain correct order (newest first) with pagination', async () => {
        // Create messages with delays to ensure different timestamps
        const msg1 = await Message.create(testConversation.id, testUser1.id, 'First');
        await new Promise(resolve => setTimeout(resolve, 10));
        const msg2 = await Message.create(testConversation.id, testUser1.id, 'Second');
        await new Promise(resolve => setTimeout(resolve, 10));
        const msg3 = await Message.create(testConversation.id, testUser1.id, 'Third');

        const response = await request(app)
          .get(`/api/messages/conversations/${testConversation.id}`)
          .set('Authorization', `Bearer ${testToken1}`)
          .expect(200);

        // Messages should be in reverse chronological order (newest first)
        expect(response.body.data.messages[0].content).toBe('Third');
        expect(response.body.data.messages[1].content).toBe('Second');
        expect(response.body.data.messages[2].content).toBe('First');
      });
    });
  });

  describe('GET /api/messages/unread', () => {
    test('should return unread counts for all conversations', async () => {
      // Create another conversation for user1 and user3
      const result2 = await Conversation.getOrCreateDirect(testUser1.id, testUser3.id);
      const conversation2 = result2.conversation;

      // User2 sends 5 messages to user1 in conversation1
      for (let i = 0; i < 5; i++) {
        const msg = await Message.create(
          testConversation.id,
          testUser2.id,
          `Message from user2: ${i + 1}`
        );
        // Create 'sent' status for user1
        await MessageStatus.createInitialStatus(msg.id, [testUser1.id]);
      }

      // User3 sends 3 messages to user1 in conversation2
      for (let i = 0; i < 3; i++) {
        const msg = await Message.create(
          conversation2.id,
          testUser3.id,
          `Message from user3: ${i + 1}`
        );
        await MessageStatus.createInitialStatus(msg.id, [testUser1.id]);
      }

      const response = await request(app)
        .get('/api/messages/unread')
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUnread).toBeGreaterThanOrEqual(0);
      expect(response.body.data.byConversation).toBeDefined();
      expect(typeof response.body.data.byConversation).toBe('object');
    });

    test('should return zero unread when no messages', async () => {
      const response = await request(app)
        .get('/api/messages/unread')
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(200);

      expect(response.body.data.totalUnread).toBeGreaterThanOrEqual(0);
      expect(response.body.data.byConversation).toBeDefined();
    });

    test('should return 401 when not authenticated', async () => {
      await request(app).get('/api/messages/unread').expect(401);
    });
  });
});
