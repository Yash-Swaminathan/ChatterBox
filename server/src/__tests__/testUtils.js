const { pool } = require('../config/database');
const bcrypt = require('../utils/bcrypt');


async function beginTestTransaction() {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

/**
 * Rolls back test transaction and releases the client.
 *
 * This should be called in afterAll() to ensure all test data is cleaned up
 * and the database connection is returned to the pool.
 */
async function rollbackTestTransaction(client) {
  if (!client) return;

  try {
    await client.query('ROLLBACK');
  } catch (error) {
    console.error('Failed to rollback test transaction:', error.message);
  } finally {
    client.release(); // Always release, even if rollback fails
  }
}

/**
 * Creates a test user with auto-generated unique username/email.
 */
async function createTestUser(client, userData = {}) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);

  const defaultData = {
    username: `testuser_${timestamp}_${random}`,
    email: `testuser_${timestamp}_${random}@test.com`,
    passwordHash: await bcrypt.hashPassword('password123'),
    displayName: 'Test User',
    status: 'online',
  };

  const finalData = { ...defaultData, ...userData };

  const result = await client.query(
    `INSERT INTO users (username, email, password_hash, display_name, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, display_name, status, created_at`,
    [
      finalData.username,
      finalData.email,
      finalData.passwordHash,
      finalData.displayName,
      finalData.status,
    ]
  );

  return result.rows[0];
}

/**
 * Creates a test conversation within the transaction.
 */
async function createTestConversation(client, convData = {}) {
  const { type = 'direct', name = null, avatarUrl = null, createdBy = null } = convData;

  const result = await client.query(
    `INSERT INTO conversations (type, name, avatar_url, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [type, name, avatarUrl, createdBy]
  );

  return result.rows[0];
}

/**
 * Adds a participant to a conversation within the transaction.
 */
async function addTestParticipant(client, participantData) {
  const { conversationId, userId, isAdmin = false } = participantData;

  const result = await client.query(
    `INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [conversationId, userId, isAdmin]
  );

  return result.rows[0];
}

/**
 * Creates a test message within the transaction.
 */
async function createTestMessage(client, messageData) {
  const { conversationId, senderId, content, replyToId = null } = messageData;

  const result = await client.query(
    `INSERT INTO messages (conversation_id, sender_id, content, reply_to_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, senderId, content, replyToId]
  );

  return result.rows[0];
}

/**
 * Creates complete test setup: users, conversation, participants.
 *
 * This is a one-liner for the common pattern of creating users and a conversation.
 */
async function createTestSetup(client, options = {}) {
  const { userCount = 2, conversationType = 'direct', conversationName = null } = options;

  // Create users
  const users = [];
  for (let i = 0; i < userCount; i++) {
    const user = await createTestUser(client, {
      displayName: `Test User ${i + 1}`,
    });
    users.push(user);
  }

  // Create conversation
  const conversation = await createTestConversation(client, {
    type: conversationType,
    name: conversationName || (conversationType === 'group' ? 'Test Group' : null),
    createdBy: users[0].id,
  });

  // Add participants
  const participants = [];
  for (let i = 0; i < users.length; i++) {
    const participant = await addTestParticipant(client, {
      conversationId: conversation.id,
      userId: users[i].id,
      isAdmin: i === 0, // First user is admin
    });
    participants.push(participant);
  }

  return { users, conversation, participants };
}

module.exports = {
  beginTestTransaction,
  rollbackTestTransaction,
  createTestUser,
  createTestConversation,
  addTestParticipant,
  createTestMessage,
  createTestSetup,
};
