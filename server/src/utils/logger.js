// simple structured logger utility
// in production, replace with winston or pino

// TODO: Replace with winston or pino
// Winston is a popular logger for Node.js

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

/**
 * Log a message with structured data
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  // In production, send to logging service
  // For now, use console with structured format
  const output = JSON.stringify(logEntry);

  if (level === LOG_LEVELS.ERROR) {
    console.error(output);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Log error with context
 * @param {string} message - Error message
 * @param {Object} meta - Additional context (don't include sensitive data)
 */
function error(message, meta = {}) {
  // Filter out sensitive data
  const safeMeta = {
    ...meta,
    // Don't log sensitive fields
    password: undefined,
    passwordHash: undefined,
    token: undefined,
  };

  log(LOG_LEVELS.ERROR, message, safeMeta);
}

/**
 * Log warning
 * @param {string} message - Warning message
 * @param {Object} meta - Additional context
 */
function warn(message, meta = {}) {
  log(LOG_LEVELS.WARN, message, meta);
}

/**
 * Log info
 * @param {string} message - Info message
 * @param {Object} meta - Additional context
 */
function info(message, meta = {}) {
  log(LOG_LEVELS.INFO, message, meta);
}

/**
 * Log debug (only in development)
 * @param {string} message - Debug message
 * @param {Object} meta - Additional context
 */
function debug(message, meta = {}) {
  if (process.env.NODE_ENV === 'development') {
    log(LOG_LEVELS.DEBUG, message, meta);
  }
}

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS,
};
