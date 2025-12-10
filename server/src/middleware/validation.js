const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity');

// Initialize profanity matcher
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

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
  } else if (matcher.hasMatch(username)) {
    errors.push('Username contains inappropriate language');
  }

  // Email validation (more robust regex to prevent issues like double dots)
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
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

/**
 * Validate profile update input
 *
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function (callback)
 */
function validateProfileUpdate(req, res, next) {
  const { display_name, bio, status } = req.body;
  const errors = [];

  // Validate display_name if provided
  if (display_name !== undefined) {
    if (typeof display_name !== 'string') {
      errors.push('Display name must be a string');
    } else if (display_name.trim().length === 0) {
      errors.push('Display name cannot be empty');
    } else if (display_name.length > 100) {
      errors.push('Display name must be less than 100 characters');
    } else if (matcher.hasMatch(display_name)) {
      errors.push('Display name contains inappropriate language');
    }
  }

  // Validate bio if provided
  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      errors.push('Bio must be a string');
    } else if (bio.length > 500) {
      errors.push('Bio must be less than 500 characters');
    } else if (matcher.hasMatch(bio)) {
      errors.push('Bio contains inappropriate language');
    }
    // Empty bio is allowed (user can clear their bio)
  }

  // Validate status if provided
  if (status !== undefined) {
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (typeof status !== 'string') {
      errors.push('Status must be a string');
    } else if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}. Got: ${status}`);
    }
  }

  // Check if at least one field is provided
  if (display_name === undefined && bio === undefined && status === undefined) {
    errors.push('At least one field must be provided for update');
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
  validateProfileUpdate,
};
