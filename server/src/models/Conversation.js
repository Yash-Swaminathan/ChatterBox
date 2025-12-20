// Conversation Model
// Week 4 Day 1-2: Conversation Setup
// Purpose: Database operations for conversation management

// INSTRUCTIONS:
// 1. Import required dependencies (pool from database config, logger)
// 2. Create a Conversation class with static methods
// 3. Each method should handle database queries with proper error handling
// 4. Use transactions for operations that modify multiple tables
// 5. Add JSDoc comments to all methods
// 6. Log important operations for debugging
// 7. Follow the existing User model pattern for consistency

// TODO: Import dependencies
// const { pool } = require('../config/database');
// const logger = require('../utils/logger');


/**
 * Conversation Model
 * Handles all database operations for conversations
 */
class Conversation {
  /**
   * Create a new conversation with participants
   *
   * INSTRUCTIONS:
   * 1. Get a database client from pool for transaction
   * 2. Start transaction with BEGIN
   * 3. INSERT into conversations table, get RETURNING *
   * 4. INSERT participants into conversation_participants (use parameterized query)
   * 5. COMMIT transaction
   * 6. Release client
   * 7. Handle errors with ROLLBACK
   * 8. Log the operation
   *
   * @param {string} type - 'direct' or 'group'
   * @param {string[]} participantIds - Array of user UUIDs to add as participants
   * @returns {Promise<Object>} Created conversation object
   * @throws {Error} If database operation fails
   *
   * Example:
   *   const conv = await Conversation.create('direct', ['user-1-uuid', 'user-2-uuid']);
   */
  static async create(type, participantIds) {
    // TODO: Implement create method
    // Hint: Use pool.connect() to get a client for transaction
    // Hint: Use client.query('BEGIN') to start transaction
    // Hint: Use client.query('INSERT INTO conversations...')
    // Hint: Loop through participantIds and insert into conversation_participants
    // Hint: Don't forget client.query('COMMIT') and client.release()
    // Hint: Wrap in try/catch with ROLLBACK on error
  }

  /**
   * Find existing direct conversation between two users
   *
   * INSTRUCTIONS:
   * 1. Query conversations table with JOINs to conversation_participants
   * 2. Match where BOTH users are participants
   * 3. Filter by type = 'direct'
   * 4. Ensure exactly 2 participants (prevents matching group chats)
   * 5. Return first match or null
   *
   * @param {string} userId1 - First user's UUID
   * @param {string} userId2 - Second user's UUID
   * @returns {Promise<Object|null>} Conversation object or null if not found
   *
   * SQL Hint:
   *   SELECT c.*
   *   FROM conversations c
   *   INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
   *   INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
   *   WHERE c.type = 'direct'
   *   AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
   *   LIMIT 1
   */
  static async findDirectConversation(userId1, userId2) {
    // TODO: Implement findDirectConversation method
    // Hint: Use pool.query() with the SQL above
    // Hint: Return result.rows[0] || null
  }

  /**
   * Get or create a direct conversation (idempotent)
   *
   * INSTRUCTIONS:
   * 1. Call findDirectConversation() first
   * 2. If exists, return { conversation, created: false }
   * 3. If not exists, call create() with type='direct'
   * 4. Return { conversation, created: true }
   * 5. Use transaction to prevent race conditions (see week4-day1-2-plan.md Edge Case 5)
   *
   * @param {string} userId1 - First user's UUID
   * @param {string} userId2 - Second user's UUID
   * @returns {Promise<{conversation: Object, created: boolean}>}
   *
   * Example:
   *   const { conversation, created } = await Conversation.getOrCreateDirect('user-1', 'user-2');
   *   if (created) {
   *     console.log('New conversation created');
   *   } else {
   *     console.log('Existing conversation returned');
   *   }
   */
  static async getOrCreateDirect(userId1, userId2) {
    // TODO: Implement getOrCreateDirect method
    // Hint: const existing = await this.findDirectConversation(userId1, userId2);
    // Hint: if (existing) return { conversation: existing, created: false };
    // Hint: const conversation = await this.create('direct', [userId1, userId2]);
    // Hint: return { conversation, created: true };

    // ADVANCED: For production, wrap in transaction with SELECT FOR UPDATE to prevent
    // race conditions when two users simultaneously create conversation with each other
    // See week4-day1-2-plan.md Edge Case 5 for implementation
  }

  /**
   * Find conversation by ID with participant details
   *
   * INSTRUCTIONS:
   * 1. Query conversations table
   * 2. JOIN with conversation_participants and users tables
   * 3. Use json_agg() to aggregate participants into JSON array
   * 4. Optionally filter out requesting user from participants list (for UI)
   * 5. Return conversation with embedded participants array
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} [excludeUserId] - Optional user ID to exclude from participants (usually current user)
   * @returns {Promise<Object|null>} Conversation with participants or null
   *
   * SQL Hint:
   *   SELECT
   *     c.*,
   *     json_agg(
   *       json_build_object(
   *         'userId', u.id,
   *         'username', u.username,
   *         'email', u.email,
   *         'avatarUrl', u.avatar_url
   *       )
   *     ) FILTER (WHERE u.id IS NOT NULL AND ($2::uuid IS NULL OR u.id != $2)) as participants
   *   FROM conversations c
   *   LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
   *   LEFT JOIN users u ON cp.user_id = u.id
   *   WHERE c.id = $1
   *   GROUP BY c.id
   */
  static async findById(conversationId, excludeUserId = null) {
    // TODO: Implement findById method
    // Hint: Use LEFT JOIN to handle deleted users gracefully
    // Hint: Use json_agg() to build participants array
    // Hint: FILTER clause to exclude current user if provided
  }

  /**
   * Find all conversations for a user (with pagination)
   *
   * INSTRUCTIONS:
   * 1. Query conversations where user is a participant
   * 2. Include participant details (usernames, avatars)
   * 3. Order by updated_at DESC (most recent first)
   * 4. Apply pagination with LIMIT and OFFSET
   * 5. Optionally filter by conversation type
   * 6. Return array of conversations AND total count
   *
   * @param {string} userId - User's UUID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results (default 20, max 100)
   * @param {number} options.offset - Skip this many results (default 0)
   * @param {string} [options.type] - Filter by type: 'direct' or 'group'
   * @returns {Promise<{conversations: Object[], total: number}>}
   *
   * SQL Hint for conversations:
   *   SELECT
   *     c.*,
   *     json_agg(
   *       json_build_object(
   *         'userId', u.id,
   *         'username', u.username,
   *         'avatarUrl', u.avatar_url
   *       )
   *     ) FILTER (WHERE u.id IS NOT NULL AND u.id != $1) as participants
   *   FROM conversations c
   *   INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
   *   LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
   *   LEFT JOIN users u ON cp2.user_id = u.id
   *   WHERE cp.user_id = $1
   *   [AND c.type = $4]  -- if type filter provided
   *   GROUP BY c.id
   *   ORDER BY c.updated_at DESC
   *   LIMIT $2 OFFSET $3
   *
   * SQL Hint for total count:
   *   SELECT COUNT(DISTINCT c.id)
   *   FROM conversations c
   *   INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
   *   WHERE cp.user_id = $1
   *   [AND c.type = $2]  -- if type filter provided
   */
  static async findByUser(userId, { limit = 20, offset = 0, type = null }) {
    // TODO: Implement findByUser method
    // Hint: Run TWO queries - one for conversations, one for total count
    // Hint: Return { conversations: result.rows, total: countResult.rows[0].count }
    // Hint: Handle type filter conditionally (if type provided, add to WHERE clause)
    // Hint: Parse total as integer: parseInt(countResult.rows[0].count, 10)
  }

  /**
   * Add a participant to a conversation
   *
   * INSTRUCTIONS:
   * 1. INSERT into conversation_participants
   * 2. Handle duplicate key error gracefully (user already in conversation)
   * 3. Return success boolean
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to add
   * @param {boolean} [isAdmin=false] - Whether user is admin (for groups)
   * @returns {Promise<boolean>} True if added, false if already exists
   */
  static async addParticipant(conversationId, userId, isAdmin = false) {
    // TODO: Implement addParticipant method
    // Hint: INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
    // Hint: Use try/catch to handle unique constraint violation (code '23505')
    // Hint: Return true on success, false if already exists
  }

  /**
   * Remove a participant from a conversation
   *
   * INSTRUCTIONS:
   * 1. DELETE from conversation_participants
   * 2. Return number of rows deleted (0 if user wasn't in conversation)
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to remove
   * @returns {Promise<number>} Number of rows deleted (0 or 1)
   */
  static async removeParticipant(conversationId, userId) {
    // TODO: Implement removeParticipant method
    // Hint: DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2
    // Hint: Return result.rowCount
  }

  /**
   * Check if user is a participant in a conversation
   *
   * INSTRUCTIONS:
   * 1. Query conversation_participants for matching row
   * 2. Return boolean
   *
   * @param {string} conversationId - Conversation UUID
   * @param {string} userId - User UUID to check
   * @returns {Promise<boolean>} True if user is participant
   */
  static async isParticipant(conversationId, userId) {
    // TODO: Implement isParticipant method
    // Hint: SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2
    // Hint: Return result.rows.length > 0
  }

  /**
   * Update conversation's updated_at timestamp
   *
   * INSTRUCTIONS:
   * 1. UPDATE conversations SET updated_at = CURRENT_TIMESTAMP
   * 2. Called whenever a message is sent (Week 4 Day 3-5)
   * 3. Ensures conversation appears at top of user's conversation list
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<void>}
   */
  static async touch(conversationId) {
    // TODO: Implement touch method
    // Hint: UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
  }

  /**
   * Get all participant user IDs for a conversation
   *
   * INSTRUCTIONS:
   * 1. Query conversation_participants
   * 2. Return array of user IDs
   * 3. Used for broadcasting messages to all participants (Week 4 Day 3-5)
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<string[]>} Array of user UUIDs
   */
  static async getParticipantIds(conversationId) {
    // TODO: Implement getParticipantIds method
    // Hint: SELECT user_id FROM conversation_participants WHERE conversation_id = $1
    // Hint: Return result.rows.map(row => row.user_id)
  }

  /**
   * Delete a conversation
   *
   * INSTRUCTIONS:
   * 1. DELETE from conversations table
   * 2. ON DELETE CASCADE will automatically delete participants
   * 3. In future, implement soft delete (add deleted_at column)
   *
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(conversationId) {
    // TODO: Implement delete method
    // Hint: DELETE FROM conversations WHERE id = $1
    // Hint: Return result.rowCount > 0

    // FUTURE: Change to soft delete:
    // UPDATE conversations SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1
  }
}

// TODO: Export the Conversation class
// module.exports = Conversation;
