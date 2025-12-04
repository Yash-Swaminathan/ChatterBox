// Define types for authentication

/**
 * @typedef {Object} TokenPayload
 * @property {string} userId - User's unique identifier (UUID)
 * @property {string} email
 */

/**
 * @typedef {Object} DecodedToken
 * @property {string} userId
 * @property {string} email
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 */

/**
 * @typedef {Object} UserCredentials
 * @property {string} email
 * @property {string} password - Hashed password
 */

/**
 * @typedef {Object} AuthResponse
 * @property {Object} user
 * @property {string} user.id
 * @property {string} user.username
 * @property {string} user.email
 * @property {string} user.displayName
 * @property {string} accessToken - JWT access token (15 min)
 * @property {string} refreshToken - JWT refresh token (7 days)
 */

/**
 * @typedef {Object} RefreshTokenRequest
 * @property {string} refreshToken - The refresh token to validate
 */

/**
 * @typedef {Object} ValidationErrorResponse
 * @property {boolean} success - will be false
 * @property {Object} error
 * @property {string} error.code - (VALIDATION_ERROR)
 * @property {string} error.message
 * @property {string[]} error.details
 */

module.exports = {};
