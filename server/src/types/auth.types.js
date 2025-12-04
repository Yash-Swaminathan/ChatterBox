/**
 * Shared type definitions for authentication
 * These can be referenced across the entire project
 */

/**
 * @typedef {Object} TokenPayload
 * @property {string} userId - User's unique identifier (UUID)
 * @property {string} email - User's email address
 */

/**
 * @typedef {Object} DecodedToken
 * @property {string} userId - User's unique identifier
 * @property {string} email - User's email address
 * @property {number} iat - Issued at timestamp (seconds since epoch)
 * @property {number} exp - Expiration timestamp (seconds since epoch)
 */

/**
 * @typedef {Object} UserCredentials
 * @property {string} email - User's email address
 * @property {string} password - User's password (plain text, will be hashed)
 */

/**
 * @typedef {Object} AuthResponse
 * @property {Object} user - User data (without password)
 * @property {string} user.id - User ID
 * @property {string} user.username - Username
 * @property {string} user.email - Email
 * @property {string} user.displayName - Display name
 * @property {string} accessToken - JWT access token (15 min)
 * @property {string} refreshToken - JWT refresh token (7 days)
 */

/**
 * @typedef {Object} RefreshTokenRequest
 * @property {string} refreshToken - The refresh token to validate
 */

// Export empty object to make this a module
module.exports = {};
