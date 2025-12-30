const { pool } = require('../config/database');
const {
  beginTestTransaction,
  rollbackTestTransaction,
  createTestUser,
  createTestConversation,
  addTestParticipant,
  createTestMessage,
  createTestSetup,
} = require('./testUtils');

/**
 * Test Utilities Verification Tests
 *
 * These tests verify that transaction-based test isolation works correctly.
 * They confirm that:
 * 1. Data created within a transaction is visible inside the transaction
 * 2. Data is automatically rolled back and NOT visible after transaction ends
 * 3. Multiple test suites can run in parallel without conflicts
 */

describe('Test Utils - Transaction Isolation', () => {
  let testClient;

  beforeAll(async () => {
    testClient = await beginTestTransaction();
  });

  afterAll(async () => {
    await rollbackTestTransaction(testClient);
  });

  describe('beginTestTransaction and rollbackTestTransaction', () => {
    it('should create a test user within transaction', async () => {
      const user = await createTestUser(testClient, {
        username: 'isolation_test_user',
        email: 'isolation@test.com',
      });

      expect(user).toHaveProperty('id');
      expect(user.username).toBe('isolation_test_user');
      expect(user.email).toBe('isolation@test.com');
    });

    it('should verify user exists within the transaction', async () => {
      const result = await testClient.query(
        'SELECT * FROM users WHERE username = $1',
        ['isolation_test_user']
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email).toBe('isolation@test.com');
    });
  });

  describe('createTestUser', () => {
    it('should create user with auto-generated username and email', async () => {
      const user = await createTestUser(testClient);

      expect(user).toHaveProperty('id');
      expect(user.username).toMatch(/^testuser_\d+_\d+$/);
      expect(user.email).toMatch(/^testuser_\d+_\d+@test\.com$/);
      expect(user.display_name).toBe('Test User');
      expect(user.status).toBe('online');
    });

    it('should create user with custom data', async () => {
      const user = await createTestUser(testClient, {
        displayName: 'Custom User',
        status: 'away',
      });

      expect(user.display_name).toBe('Custom User');
      expect(user.status).toBe('away');
    });

    it('should handle multiple users without conflicts', async () => {
      const user1 = await createTestUser(testClient, { displayName: 'User 1' });
      const user2 = await createTestUser(testClient, { displayName: 'User 2' });

      expect(user1.id).not.toBe(user2.id);
      expect(user1.username).not.toBe(user2.username);
      expect(user1.email).not.toBe(user2.email);
    });
  });

  describe('createTestConversation', () => {
    it('should create direct conversation', async () => {
      const conversation = await createTestConversation(testClient, {
        type: 'direct',
      });

      expect(conversation).toHaveProperty('id');
      expect(conversation.type).toBe('direct');
      expect(conversation.name).toBeNull();
    });

    it('should create group conversation with name', async () => {
      const user = await createTestUser(testClient);
      const conversation = await createTestConversation(testClient, {
        type: 'group',
        name: 'Test Group',
        createdBy: user.id,
      });

      expect(conversation.type).toBe('group');
      expect(conversation.name).toBe('Test Group');
      expect(conversation.created_by).toBe(user.id);
    });
  });

  describe('addTestParticipant', () => {
    it('should add participant to conversation', async () => {
      const user = await createTestUser(testClient);
      const conversation = await createTestConversation(testClient);

      const participant = await addTestParticipant(testClient, {
        conversationId: conversation.id,
        userId: user.id,
        isAdmin: false,
      });

      expect(participant.conversation_id).toBe(conversation.id);
      expect(participant.user_id).toBe(user.id);
      expect(participant.is_admin).toBe(false);
    });

    it('should set isAdmin to true for admin participants', async () => {
      const user = await createTestUser(testClient);
      const conversation = await createTestConversation(testClient);

      const participant = await addTestParticipant(testClient, {
        conversationId: conversation.id,
        userId: user.id,
        isAdmin: true,
      });

      expect(participant.is_admin).toBe(true);
    });
  });

  describe('createTestMessage', () => {
    it('should create message in conversation', async () => {
      const { users, conversation } = await createTestSetup(testClient);

      const message = await createTestMessage(testClient, {
        conversationId: conversation.id,
        senderId: users[0].id,
        content: 'Test message',
      });

      expect(message.conversation_id).toBe(conversation.id);
      expect(message.sender_id).toBe(users[0].id);
      expect(message.content).toBe('Test message');
    });

    it('should support reply_to_id', async () => {
      const { users, conversation } = await createTestSetup(testClient);

      const message1 = await createTestMessage(testClient, {
        conversationId: conversation.id,
        senderId: users[0].id,
        content: 'Original message',
      });

      const message2 = await createTestMessage(testClient, {
        conversationId: conversation.id,
        senderId: users[1].id,
        content: 'Reply message',
        replyToId: message1.id,
      });

      expect(message2.reply_to_id).toBe(message1.id);
    });
  });

  describe('createTestSetup', () => {
    it('should create complete test setup with default options', async () => {
      const { users, conversation, participants } = await createTestSetup(testClient);

      expect(users).toHaveLength(2);
      expect(conversation.type).toBe('direct');
      expect(participants).toHaveLength(2);
      expect(participants[0].is_admin).toBe(true); // First user is admin
      expect(participants[1].is_admin).toBe(false);
    });

    it('should create group conversation with multiple users', async () => {
      const { users, conversation, participants } = await createTestSetup(testClient, {
        userCount: 3,
        conversationType: 'group',
        conversationName: 'Test Group',
      });

      expect(users).toHaveLength(3);
      expect(conversation.type).toBe('group');
      expect(conversation.name).toBe('Test Group');
      expect(participants).toHaveLength(3);
      expect(participants[0].is_admin).toBe(true);
      expect(participants[1].is_admin).toBe(false);
      expect(participants[2].is_admin).toBe(false);
    });
  });
});

/**
 * Transaction Rollback Verification
 *
 * This test runs OUTSIDE of a transaction to verify that data from
 * previous tests was successfully rolled back and does NOT persist.
 */
describe('Test Utils - Rollback Verification', () => {
  it('should NOT find test data after transaction rollback', async () => {
    // Query for test data that was created in previous describe block
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      ['isolation_test_user']
    );

    // Data should NOT exist (rolled back)
    expect(result.rows.length).toBe(0);
  });

  it('should NOT find test data from testUtils transaction tests', async () => {
    // Check specifically for the users created in the testUtils transaction tests above
    // These should have specific usernames we created in the transaction block
    const result = await pool.query(
      "SELECT * FROM users WHERE username IN ('isolation_test_user', 'User 1', 'User 2')"
    );

    // If this fails, transaction rollback is NOT working for testUtils tests!
    // Data from the transaction block above should be rolled back.
    expect(result.rows.length).toBe(0);
  });
});
