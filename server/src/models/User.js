const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * User Model
 * Handles all database operations related to users
 */

/**
 * Get user by ID (includes all fields for authenticated user)
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserById(userId) {
  try {
    // Validate UUID format
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for getUserById', { userId });
      return null;
    }

    const query = `
      SELECT
        id,
        username,
        email,
        phone_number,
        display_name,
        bio,
        avatar_url,
        status,
        last_seen,
        created_at,
        updated_at,
        is_active,
        email_verified,
        phone_verified
      FROM users
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      logger.info('User not found', { userId });
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error in getUserById', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get public user profile (excludes sensitive data)
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Public user object or null if not found
 */
async function getPublicUserById(userId) {
  try {
    // Validate UUID format
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for getPublicUserById', { userId });
      return null;
    }

    const query = `
      SELECT
        id,
        username,
        display_name,
        bio,
        avatar_url,
        status,
        last_seen,
        created_at
      FROM users
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      logger.info('User not found for public profile', { userId });
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error in getPublicUserById', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update user profile
 * @param {string} userId - User UUID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.display_name] - Display name (1-100 chars)
 * @param {string} [updates.bio] - Bio (0-500 chars)
 * @param {string} [updates.status] - Status (online, offline, away, busy)
 * @param {string} [updates.avatar_url] - Avatar URL (from MinIO/S3)
 * @returns {Promise<Object|null>} Updated user object or null if not found
 */
async function updateUserProfile(userId, updates) {
  try {
    // Validate UUID format
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for updateUserProfile', { userId });
      return null;
    }

    // Build dynamic query based on provided fields
    const allowedFields = ['display_name', 'bio', 'status', 'avatar_url'];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    // Filter to only allowed fields that are present in updates
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    // If no valid fields to update, return current user
    if (updateFields.length === 0) {
      logger.info('No valid fields to update', { userId });
      return await getUserById(userId);
    }

    // Always update updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    // Add userId as the last parameter
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND is_active = true
      RETURNING
        id,
        username,
        email,
        phone_number,
        display_name,
        bio,
        avatar_url,
        status,
        last_seen,
        created_at,
        updated_at,
        is_active,
        email_verified,
        phone_verified
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      logger.info('User not found for update', { userId });
      return null;
    }

    logger.info('User profile updated successfully', {
      userId,
      updatedFields: Object.keys(updates),
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserProfile', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check if user exists and is active
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>} True if user exists and is active
 */
async function checkUserExists(userId) {
  try {
    // Validate UUID format
    if (!isValidUUID(userId)) {
      return false;
    }

    const query = `
      SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = $1 AND is_active = true
      ) as exists
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0].exists;
  } catch (error) {
    logger.error('Error in checkUserExists', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get user by email (used internally for auth)
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByEmail(email) {
  try {
    const query = `
      SELECT
        id,
        username,
        email,
        phone_number,
        password_hash,
        display_name,
        bio,
        avatar_url,
        status,
        last_seen,
        created_at,
        updated_at,
        is_active,
        email_verified,
        phone_verified
      FROM users
      WHERE email = $1 AND is_active = true
    `;

    const result = await pool.query(query, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error in getUserByEmail', { email, error: error.message });
    throw error;
  }
}

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByUsername(username) {
  try {
    const query = `
      SELECT
        id,
        username,
        email,
        phone_number,
        display_name,
        bio,
        avatar_url,
        status,
        last_seen,
        created_at,
        updated_at,
        is_active,
        email_verified,
        phone_verified
      FROM users
      WHERE username = $1 AND is_active = true
    `;

    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error in getUserByUsername', {
      username,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Search users by username or email with pagination
 * @param {string} query - Search query (username or email)
 * @param {number} limit - Maximum number of results
 * @param {number} offset - Number of results to skip
 * @returns {Promise<Object>} Object with users array and total count
 */
async function searchUsers(query, limit = 20, offset = 0) {
  try {
    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      logger.warn('Invalid search query', { query });
      return { users: [], total: 0 };
    }

    // TODO: SECURITY CONSIDERATION (Future)
    // Monitor for search enumeration attacks (users systematically searching emails)
    // Consider adding rate limiting specifically for search or obfuscating results
    // Track failed/suspicious search patterns and alert
    // Priority: Low (monitor for abuse, implement if needed)

    const searchPattern = `%${query.trim()}%`;

    // TODO: PERFORMANCE OPTIMIZATION (Future)
    // Consider using window functions to combine count + results in a single query:
    // SELECT id, username, ..., COUNT(*) OVER() as total_count
    // This would eliminate the separate count query and improve performance
    // Priority: Medium (optimize when user base grows beyond 10k users)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE
        is_active = TRUE
        AND (
          username ILIKE $1
          OR email ILIKE $1
        )
    `;

    const countResult = await pool.query(countQuery, [searchPattern]);
    const total = parseInt(countResult.rows[0].total, 10);

    // TODO: SEARCH RELEVANCE (Future Enhancement)
    // Add relevance-based ordering for better UX:
    // ORDER BY CASE
    //   WHEN username = query THEN 1 (exact match)
    //   WHEN username ILIKE query || '%' THEN 2 (starts with)
    //   ELSE 3 (contains)
    // END, username
    // Priority: Low (nice-to-have for better search experience)

    // TODO: PERFORMANCE OPTIMIZATION (Future)
    // Consider adding trigram indexes for better ILIKE performance:
    // CREATE EXTENSION IF NOT EXISTS pg_trgm;
    // CREATE INDEX idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
    // CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
    // This improves search with leading wildcards (%query%)
    // Priority: Medium (add when search queries become slow >100ms)

    // Get paginated results
    const searchQuery = `
      SELECT
        id,
        username,
        display_name,
        bio,
        avatar_url,
        status,
        created_at
      FROM users
      WHERE
        is_active = TRUE
        AND (
          username ILIKE $1
          OR email ILIKE $1
        )
      ORDER BY username
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(searchQuery, [searchPattern, limit, offset]);

    logger.info('User search completed', {
      query,
      resultsFound: result.rows.length,
      total,
    });

    return {
      users: result.rows,
      total,
    };
  } catch (error) {
    logger.error('Error in searchUsers', { query, error: error.message });
    throw error;
  }
}

/**
 * Get public user profile (alias for getPublicUserById for consistency)
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Public user object or null if not found
 */
async function getPublicUserProfile(userId) {
  return await getPublicUserById(userId);
}

/**
 * Update user status
 * @param {string} userId - User UUID
 * @param {string} status - New status (online, offline, away, busy)
 * @returns {Promise<Object|null>} Updated user status info or null if not found
 */
async function updateUserStatus(userId, status) {
  try {
    // Validate UUID format
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for updateUserStatus', { userId });
      return null;
    }

    // Validate status value
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) {
      logger.warn('Invalid status value', { userId, status });
      throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const query = `
      UPDATE users
      SET
        status = $1,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND is_active = true
      RETURNING id, status, last_seen
    `;

    const result = await pool.query(query, [status, userId]);

    if (result.rows.length === 0) {
      logger.info('User not found for status update', { userId });
      return null;
    }

    logger.info('User status updated successfully', { userId, status });

    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserStatus', {
      userId,
      status,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Update user's last seen timestamp
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>} True if updated successfully
 */
async function updateLastSeen(userId) {
  try {
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for updateLastSeen', { userId });
      return false;
    }

    const query = `
      UPDATE users
      SET last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [userId]);

    if (result.rowCount === 0) {
      logger.info('User not found for last_seen update', { userId });
      return false;
    }

    logger.debug('Last seen timestamp updated', { userId });
    return true;
  } catch (error) {
    logger.error('Error in updateLastSeen', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get user's contacts (for presence broadcasting)
 * @param {string} userId - User UUID
 * @returns {Promise<string[]>} Array of contact user IDs
 */
async function getUserContacts(userId) {
  try {
    if (!isValidUUID(userId)) {
      logger.warn('Invalid UUID format for getUserContacts', { userId });
      return [];
    }

    const query = `
      SELECT contact_user_id
      FROM contacts
      WHERE user_id = $1 AND is_blocked = false
    `;

    const result = await pool.query(query, [userId]);
    return result.rows.map(row => row.contact_user_id);
  } catch (error) {
    if (error.code === '42P01') {
      logger.debug('Contacts table does not exist yet', { userId });
      return [];
    }

    logger.error('Error in getUserContacts', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = {
  getUserById,
  getPublicUserById,
  getPublicUserProfile,
  updateUserProfile,
  updateUserStatus,
  updateLastSeen,
  getUserContacts,
  searchUsers,
  checkUserExists,
  getUserByEmail,
  getUserByUsername,
  isValidUUID,
};
