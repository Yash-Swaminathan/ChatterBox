/**
 * Validate registration input
 *
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function (callback)
 */
function validateRegistration(req, res, next) {
  const { username, email, password } = req.body;
  const errors = [];

  // Username validation
  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (username.length > 50) {
    errors.push('Username must be less than 50 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Email validation
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  // Password validation
  if (!password || password.length === 0) {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else if (password.length > 100) {
    errors.push('Password must be less than 100 characters');
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: errors,
      },
    });
  }

  next();
}

/**
 * Validate login input
 *
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function (callback)
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  }

  if (!password || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: errors,
      },
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
};
