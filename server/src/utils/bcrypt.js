const bcrypt = require('bcryptjs');

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  const saltRounds = 12; // Higher = more secure but slower to hash Randomly generated
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
