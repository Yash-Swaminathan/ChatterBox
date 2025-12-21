/**
 * Validation utility functions
 * Reusable validators for common data types
 */

/**
 * UUID v4 validation regex
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Where x is any hexadecimal digit and y is one of 8, 9, A, or B
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID v4
 * @param {string} uuid - The UUID string to validate
 * @returns {boolean} True if valid UUID v4, false otherwise
 */
function isValidUUID(uuid) {
  if (typeof uuid !== 'string') {
    return false;
  }
  return UUID_V4_REGEX.test(uuid);
}

/**
 * Validate if a value is a valid email address
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid email, false otherwise
 */
function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  // RFC 5322 compliant email regex (simplified version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate if a value is a valid username
 * Rules: 3-30 characters, alphanumeric + underscores, must start with letter
 * @param {string} username - The username to validate
 * @returns {boolean} True if valid username, false otherwise
 */
function isValidUsername(username) {
  if (typeof username !== 'string') {
    return false;
  }
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
  return usernameRegex.test(username);
}

/**
 * Validate if a value is within a numeric range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} True if within range, false otherwise
 */
function isInRange(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }
  return value >= min && value <= max;
}

/**
 * Validate if a value is one of the allowed values
 * @param {any} value - The value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @returns {boolean} True if value is in allowed values, false otherwise
 */
function isOneOf(value, allowedValues) {
  return allowedValues.includes(value);
}

module.exports = {
  isValidUUID,
  isValidEmail,
  isValidUsername,
  isInRange,
  isOneOf,
  UUID_V4_REGEX,
};
