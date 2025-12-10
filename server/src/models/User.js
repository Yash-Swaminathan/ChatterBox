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
    const allowedFields = ['display_name', 'bio', 'status'];
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
  updateUserProfile,
  checkUserExists,
  getUserByEmail,
  getUserByUsername,
  isValidUUID,
};
