const jwt = require('jsonwebtoken');
require('dotenv').config();

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Import shared type definitions from auth.types.js
 * @typedef {import('../types/auth.types').TokenPayload} TokenPayload
 * @typedef {import('../types/auth.types').DecodedToken} DecodedToken
 */

/**
 * Generate an access token (15 minute expiry)
 * @param {TokenPayload} payload - User data to encode
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate a refresh token (7 day expiry)
 * @param {TokenPayload} payload - User data to encode
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify an access token
 * @param {string} token - JWT token to verify
 * @returns {DecodedToken} Decoded payload with timestamps
 * @throws {Error} If token is invalid or expired
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    }
    throw new Error('Invalid access token');
  }
}

/**
 * Verify a refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {DecodedToken} Decoded payload with timestamps
 * @throws {Error} If token is invalid or expired
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    }
    throw new Error('Invalid refresh token');
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
