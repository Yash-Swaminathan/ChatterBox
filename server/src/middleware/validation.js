const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity');
const { isValidUUID, isInRange, isOneOf } = require('../utils/validators');
const { MAX_GROUP_PARTICIPANTS, MIN_GROUP_PARTICIPANTS } = require('../utils/constants');

// Initialize profanity matcher
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Constants for message search validation
const SEARCH_QUERY_MIN_LENGTH = 1;
const SEARCH_QUERY_MAX_LENGTH = 100;
const SEARCH_LIMIT_MIN = 1;
const SEARCH_LIMIT_MAX = 100;

/**
 * Validate registration input
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

/**
 * Validate status update input
 */
function validateStatusUpdate(req, res, next) {
  const { status } = req.body;
  const errors = [];

  // Status is required
  if (status === undefined || status === null) {
    errors.push('Status is required');
  } else {
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (typeof status !== 'string') {
      errors.push('Status must be a string');
    } else if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  // Check for extra fields (only status should be in the body)
  const allowedFields = ['status'];
  const providedFields = Object.keys(req.body);
  const extraFields = providedFields.filter(field => !allowedFields.includes(field));

  if (extraFields.length > 0) {
    errors.push(`Unexpected fields: ${extraFields.join(', ')}`);
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
 * Validate create direct conversation input
 */
function validateCreateDirectConversation(req, res, next) {
  const { participantId } = req.body;
  const errors = [];

  // Check participantId is provided
  if (!participantId) {
    errors.push('participantId is required');
  }

  // Validate UUID format
  if (participantId && !isValidUUID(participantId)) {
    errors.push('participantId must be a valid UUID');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate create group conversation input
 *
 * Request body:
 * {
 *   participantIds: string[],  // Array of UUIDs (min 3 including creator)
 *   name?: string,             // Optional group name (1-100 chars if provided)
 *   avatarUrl?: string         // Optional avatar URL
 * }
 */
function validateCreateGroupConversation(req, res, next) {
  const { participantIds, name, avatarUrl } = req.body;
  const errors = [];

  // 1. Validate participantIds is provided
  if (!participantIds) {
    errors.push('participantIds is required');
  }

  // 2. Validate participantIds is an array
  if (participantIds && !Array.isArray(participantIds)) {
    errors.push('participantIds must be an array');
  }

  // 3. Validate minimum participants (from constants)
  if (Array.isArray(participantIds) && participantIds.length < MIN_GROUP_PARTICIPANTS) {
    errors.push(`Group must have at least ${MIN_GROUP_PARTICIPANTS} participants (including creator)`);
  }

  // 4. Validate maximum participants (from constants - prevent DoS attacks)
  if (Array.isArray(participantIds) && participantIds.length > MAX_GROUP_PARTICIPANTS) {
    errors.push(`Maximum ${MAX_GROUP_PARTICIPANTS} participants allowed`);
  }

  // 5. Validate each participant ID is a valid UUID
  if (Array.isArray(participantIds)) {
    const invalidIds = participantIds.filter(id => !isValidUUID(id));
    if (invalidIds.length > 0) {
      errors.push('All participantIds must be valid UUIDs');
    }
  }

  // 6. Validate no duplicate participant IDs
  if (Array.isArray(participantIds)) {
    const uniqueIds = new Set(participantIds);
    if (uniqueIds.size !== participantIds.length) {
      errors.push('participantIds must not contain duplicates');
    }
  }

  // 7. Validate group name (optional, but if provided must be 1-100 chars)
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') {
      errors.push('name must be a string');
    } else if (name.trim().length < 1) {
      errors.push('name must not be empty if provided');
    } else if (name.trim().length > 100) {
      errors.push('name must not exceed 100 characters');
    }
  }

  // 8. Validate avatarUrl (optional, but if provided must be valid URL format)
  if (avatarUrl !== undefined && avatarUrl !== null) {
    if (typeof avatarUrl !== 'string') {
      errors.push('avatarUrl must be a string');
    } else if (avatarUrl.trim().length > 0) {
      // Basic URL validation
      try {
        new URL(avatarUrl);
      } catch (error) {
        console.error('Error validating avatarUrl:', error);
        errors.push('avatarUrl must be a valid URL');
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate get conversations query parameters
 */
function validateGetConversations(req, res, next) {
  const { limit, offset, type } = req.query;
  const errors = [];

  // Validate limit (optional, 1-100)
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || !isInRange(limitNum, 1, 100)) {
      errors.push('limit must be a number between 1 and 100');
    }
  }

  // Validate offset (optional, >= 0)
  if (offset !== undefined) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('offset must be a non-negative number');
    }
  }

  // Validate type (optional, 'direct' or 'group')
  if (type !== undefined) {
    const validTypes = ['direct', 'group'];
    if (!isOneOf(type, validTypes)) {
      errors.push('type must be either "direct" or "group"');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate get messages request
 */
function validateGetMessages(req, res, next) {
  const { conversationId } = req.params;
  const { limit, cursor, includeDeleted } = req.query;
  const errors = [];

  // Validate conversationId (UUID)
  if (!conversationId || !isValidUUID(conversationId)) {
    errors.push('Valid conversation ID required');
  }

  // Validate limit (optional, 1-100, default 50)
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || !isInRange(limitNum, 1, 100)) {
      errors.push('limit must be a number between 1 and 100');
    }
  }

  // Validate cursor (optional UUID)
  if (cursor && !isValidUUID(cursor)) {
    errors.push('cursor must be a valid UUID');
  }

  // Validate includeDeleted (optional boolean string)
  if (includeDeleted !== undefined && !isOneOf(includeDeleted, ['true', 'false'])) {
    errors.push('includeDeleted must be true or false');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors[0],
        field: errors.length === 1 ? Object.keys(req.query)[0] : undefined,
      },
    });
  }

  next();
}

/**
 * Validate message edit request
 */
function validateMessageEdit(req, res, next) {
  const { messageId } = req.params;
  const { content } = req.body;
  const errors = [];

  // Validate messageId is UUID
  if (!messageId || !isValidUUID(messageId)) {
    errors.push('Valid message ID required');
  }

  // Validate content exists (detailed validation in Message.validateContent)
  if (content === undefined || content === null) {
    errors.push('Content is required');
  } else if (typeof content !== 'string') {
    errors.push('Content must be a string');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: errors[0],
      },
    });
  }

  next();
}

/**
 * Validate message delete request
 */
function validateMessageDelete(req, res, next) {
  const { messageId } = req.params;
  const errors = [];

  // Validate messageId is UUID
  if (!messageId || !isValidUUID(messageId)) {
    errors.push('Valid message ID required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: errors[0],
      },
    });
  }

  next();
}

/**
 * Validate message search request
 */
function validateMessageSearch(req, res, next) {
  const { q, conversationId, limit, cursor, includeDeleted } = req.query;
  const errors = [];

  // Validate query (required, 1-100 chars after trimming)
  if (!q) {
    errors.push('Search query is required');
  } else if (typeof q !== 'string') {
    errors.push('Query must be a string');
  } else {
    const trimmed = q.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      errors.push('Query cannot be empty');
    } else if (trimmed.length < SEARCH_QUERY_MIN_LENGTH) {
      errors.push(`Query must be at least ${SEARCH_QUERY_MIN_LENGTH} character`);
    } else if (trimmed.length > SEARCH_QUERY_MAX_LENGTH) {
      errors.push(`Query must be ${SEARCH_QUERY_MAX_LENGTH} characters or less`);
    }
  }

  // Validate conversationId (optional UUID)
  if (conversationId && !isValidUUID(conversationId)) {
    errors.push('conversationId must be a valid UUID');
  }

  // Validate limit (optional, 1-100, default 50)
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum)) {
      errors.push('limit must be a number');
    } else if (!isInRange(limitNum, SEARCH_LIMIT_MIN, SEARCH_LIMIT_MAX)) {
      errors.push(`limit must be between ${SEARCH_LIMIT_MIN} and ${SEARCH_LIMIT_MAX}`);
    }
  }

  // Validate cursor (optional, format: ISO-timestamp:uuid)
  if (cursor) {
    // Strict ISO 8601 format with milliseconds + UUID v4
    const cursorRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
    if (!cursorRegex.test(cursor)) {
      errors.push('Invalid cursor format. Expected: ISO-timestamp:uuid');
    }
  }

  // Validate includeDeleted (optional boolean string)
  if (includeDeleted !== undefined && !isOneOf(includeDeleted, ['true', 'false'])) {
    errors.push('includeDeleted must be true or false');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors[0],
      },
    });
  }

  next();
}

/**
 * Validate add contact request
 */
function validateAddContact(req, res, next) {
  const { userId, nickname } = req.body;
  const errors = [];

  // Validate userId (required, UUID)
  if (!userId) {
    errors.push('userId is required');
  } else if (!isValidUUID(userId)) {
    errors.push('userId must be a valid UUID');
  }

  // Validate nickname (optional, max 100 chars)
  if (nickname !== undefined && nickname !== null) {
    if (typeof nickname !== 'string') {
      errors.push('nickname must be a string');
    } else {
      const trimmedNickname = nickname.trim();
      if (trimmedNickname.length === 0) {
        errors.push('nickname cannot be empty or whitespace only');
      } else if (trimmedNickname.length > 100) {
        errors.push('nickname must be 100 characters or less');
      } else {
        // Update request body with trimmed value
        req.body.nickname = trimmedNickname;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate update contact request
 */
function validateUpdateContact(req, res, next) {
  const { nickname, isFavorite } = req.body;
  const errors = [];

  // At least one field must be provided
  if (nickname === undefined && isFavorite === undefined) {
    errors.push('At least one field (nickname or isFavorite) must be provided');
  }

  // Validate nickname if provided
  if (nickname !== undefined && nickname !== null) {
    if (typeof nickname !== 'string') {
      errors.push('nickname must be a string');
    } else {
      const trimmedNickname = nickname.trim();
      if (trimmedNickname.length === 0) {
        errors.push('nickname cannot be empty or whitespace only');
      } else if (trimmedNickname.length > 100) {
        errors.push('nickname must be 100 characters or less');
      } else {
        // Update request body with trimmed value
        req.body.nickname = trimmedNickname;
      }
    }
  }

  // Validate isFavorite if provided
  if (isFavorite !== undefined && isFavorite !== null) {
    if (typeof isFavorite !== 'boolean') {
      errors.push('isFavorite must be a boolean');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate get contacts query parameters
 */
function validateGetContacts(req, res, next) {
  const { limit, offset, includeBlocked } = req.query;
  const errors = [];

  // Validate limit (optional, 1-200)
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || !isInRange(limitNum, 1, 200)) {
      errors.push('limit must be a number between 1 and 200');
    }
  }

  // Validate offset (optional, >= 0)
  if (offset !== undefined) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('offset must be a non-negative number');
    }
  }

  // Validate includeBlocked (optional boolean string)
  if (includeBlocked !== undefined && !isOneOf(includeBlocked, ['true', 'false'])) {
    errors.push('includeBlocked must be true or false');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors[0],
    });
  }

  next();
}

/**
 * Validate user search query parameters
 */
function validateUserSearch(req, res, next) {
  const { q, excludeContacts } = req.query;
  const errors = [];

  // Validate query (required, min 2 chars)
  if (!q || typeof q !== 'string') {
    errors.push('Search query (q) is required');
  } else if (q.trim().length < 2) {
    errors.push('Query must be at least 2 characters');
  }

  // Validate excludeContacts (optional boolean string)
  if (excludeContacts !== undefined && !isOneOf(excludeContacts, ['true', 'false'])) {
    errors.push('excludeContacts must be true or false');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors[0],
      },
    });
  }

  next();
}

/**
 * Generic UUID validator middleware factory
 * Returns middleware that validates a parameter is a valid UUID
 */
function validateUUID(paramName) {
  return function (req, res, next) {
    const value = req.params[paramName];

    if (!value) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `${paramName} is required`,
      });
    }

    if (!isValidUUID(value)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `${paramName} must be a valid UUID`,
      });
    }

    next();
  };
}

/**
 * Validate add participants request body
 * - userIds must be an array
 * - Max 10 users per request
 * - All userIds must be valid UUIDs
 */
function validateAddParticipants() {
  return (req, res, next) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'userIds must be an array',
      });
    }

    if (userIds.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'userIds array cannot be empty',
      });
    }

    if (userIds.length > 10) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot add more than 10 participants at once',
      });
    }

    // Validate all UUIDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = userIds.filter(id => !uuidRegex.test(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid UUID format for userIds: ${invalidIds.join(', ')}`,
      });
    }

    // Check for duplicates
    const uniqueIds = new Set(userIds);
    if (uniqueIds.size !== userIds.length) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Duplicate user IDs in request',
      });
    }

    next();
  };
}

/**
 * Validate group settings update request
 * - name: string (1-100 chars, optional)
 * - avatarUrl: string (URL format, optional) or null to remove
 * - At least one field must be provided
 *
 * // TODO (Week 18): Add profanity filter validation
 * //   - Install 'bad-words' package
 * //   - Filter group names for offensive content
 * //   - Return 400 Bad Request with specific message
 *
 * // TODO (Week 18): Enhance URL validation
 * //   - Check if URL is accessible (HTTP HEAD request)
 * //   - Validate MIME type is image/*
 * //   - Check file size < 5MB
 * //   - Consider adding to uploadService instead
 */
const validateGroupSettings = (req, res, next) => {
  const { name, avatarUrl } = req.body;

  // At least one field must be provided
  if (name === undefined && avatarUrl === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'At least one field (name or avatarUrl) must be provided',
    });
  }

  // Validate name if provided
  if (name !== undefined) {
    // Check type
    if (typeof name !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'name must be a string',
      });
    }

    // Trim and check length
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'name cannot be empty',
      });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'name cannot exceed 100 characters',
      });
    }

    // Replace with trimmed version
    req.body.name = trimmedName;
  }

  // Validate avatarUrl if provided
  if (avatarUrl !== undefined) {
    // Allow null to remove avatar
    if (avatarUrl !== null) {
      // Check type
      if (typeof avatarUrl !== 'string') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'avatarUrl must be a string or null',
        });
      }

      // Basic URL validation
      const trimmedUrl = avatarUrl.trim();
      if (trimmedUrl.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'avatarUrl cannot be empty (use null to remove)',
        });
      }

      // Check URL format
      try {
        new URL(trimmedUrl);
      } catch (error) {
        console.error('Error validating avatarUrl:', error);
        return res.status(400).json({
          error: 'Validation Error',
          message: 'avatarUrl must be a valid URL',
        });
      }

      // Replace with trimmed version
      req.body.avatarUrl = trimmedUrl;
    }
  }

  next();
};

/**
 * Validate participant role update request
 * - role: string ('admin' or 'member')
 */
const validateRoleUpdate = (req, res, next) => {
  const { role } = req.body;

  // Role is required
  if (!role) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'role is required',
    });
  }

  // Check type
  if (typeof role !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'role must be a string',
    });
  }

  // Validate allowed values
  const allowedRoles = ['admin', 'member'];
  if (!allowedRoles.includes(role.toLowerCase())) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'role must be either "admin" or "member"',
    });
  }

  // Normalize to lowercase
  req.body.role = role.toLowerCase();

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validateStatusUpdate,
  validateCreateDirectConversation,
  validateCreateGroupConversation,
  validateGetConversations,
  validateGetMessages,
  validateMessageEdit,
  validateMessageDelete,
  validateMessageSearch,
  validateAddContact,
  validateUpdateContact,
  validateGetContacts,
  validateUserSearch,
  validateUUID,
  validateAddParticipants,
  validateGroupSettings,
  validateRoleUpdate,
};
