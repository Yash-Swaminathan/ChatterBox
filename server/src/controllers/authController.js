const { query, getClient } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const validator = require('validator');
const logger = require('../utils/logger');

// Register a new user
// POST /api/auth/register
async function register(req, res) {
  const client = await getClient();

  try {
    // Sanitize and normalize inputs
    const username = validator.trim(req.body.username || '');
    const email = validator.normalizeEmail(req.body.email || '') || validator.trim(req.body.email || '');
    const password = req.body.password || ''; // Don't trim passwords
    const displayName = req.body.displayName ? validator.trim(req.body.displayName) : username;
    const phoneNumber = req.body.phoneNumber ? validator.trim(req.body.phoneNumber) : null;

    // Start transaction
    await client.query('BEGIN');

    // Check if user already exists
    const existingUserQuery = `
      SELECT id FROM users
      WHERE email = $1 OR username = $2
    `;
    const existingUser = await client.query(existingUserQuery, [email, username]);

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email or username already exists',
        },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user
    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash, display_name, phone_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, display_name, phone_number, created_at, status
    `;
    const userResult = await client.query(insertUserQuery, [
      username,
      email,
      passwordHash,
      displayName || username,
      phoneNumber || null,
    ]);

    const user = userResult.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token in sessions table
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const insertSessionQuery = `
      INSERT INTO sessions (user_id, refresh_token, expires_at, device_info)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    await client.query(insertSessionQuery, [
      user.id,
      refreshToken,
      expiresAt,
      JSON.stringify({ userAgent: req.headers['user-agent'] || 'Unknown' }),
    ]);

    // Commit transaction
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          status: user.status,
          createdAt: user.created_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration failed', {
      errorCode: error.code,
      errorMessage: error.message,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register user',
      },
    });
  } finally {
    client.release();
  }
}

// Login user
// POST /api/auth/login
async function login(req, res) {
  const client = await getClient();

  try {
    // Sanitize inputs
    const email = validator.normalizeEmail(req.body.email || '') || validator.trim(req.body.email || '');
    const password = req.body.password || ''; // Don't trim passwords

    await client.query('BEGIN');

    // Find user by email or username
    const findUserQuery = `
      SELECT id, username, email, password_hash, display_name, phone_number, status, is_active
      FROM users
      WHERE email = $1 OR username = $1
    `;
    const userResult = await client.query(findUserQuery, [email]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (!user.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account has been deactivated',
        },
      });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Update user status to online and last_seen
    const updateStatusQuery = `
      UPDATE users
      SET status = 'online', last_seen = NOW()
      WHERE id = $1
    `;
    await client.query(updateStatusQuery, [user.id]);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token in sessions table
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const insertSessionQuery = `
      INSERT INTO sessions (user_id, refresh_token, expires_at, device_info)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    await client.query(insertSessionQuery, [
      user.id,
      refreshToken,
      expiresAt,
      JSON.stringify({ userAgent: req.headers['user-agent'] || 'Unknown' }),
    ]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          status: 'online',
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Login failed', {
      errorCode: error.code,
      errorMessage: error.message,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Failed to login',
      },
    });
  } finally {
    client.release();
  }
}

// Logout user
// POST /api/auth/logout
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.userId;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
      });
    }

    // Mark session as inactive
    const deactivateSessionQuery = `
      UPDATE sessions
      SET is_active = false
      WHERE refresh_token = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await query(deactivateSessionQuery, [refreshToken, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    // Update user status to offline
    const updateStatusQuery = `
      UPDATE users
      SET status = 'offline', last_seen = NOW()
      WHERE id = $1
    `;
    await query(updateStatusQuery, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    logger.error('Logout failed', {
      errorCode: error.code,
      errorMessage: error.message,
      userId: req.user?.userId,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout',
      },
    });
  }
}

// Refresh access token
// POST /api/auth/refresh
async function refreshTokenHandler(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: error.message || 'Invalid refresh token',
        },
      });
    }

    // Check if session exists and is active
    const checkSessionQuery = `
      SELECT id, user_id, is_active, expires_at
      FROM sessions
      WHERE refresh_token = $1
    `;
    const sessionResult = await query(checkSessionQuery, [refreshToken]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_INACTIVE',
          message: 'Session is inactive',
        },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        },
      });
    }

    // Update last_used_at for session
    const updateSessionQuery = `
      UPDATE sessions
      SET last_used_at = NOW()
      WHERE refresh_token = $1
    `;
    await query(updateSessionQuery, [refreshToken]);

    // Get user data for new access token
    const getUserQuery = `
      SELECT id, username, email
      FROM users
      WHERE id = $1
    `;
    const userResult = await query(getUserQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      errorCode: error.code,
      errorMessage: error.message,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token',
      },
    });
  }
}

// Get current user
// GET /api/auth/me
async function getCurrentUser(req, res) {
  try {
    const userId = req.user.userId;

    const getUserQuery = `
      SELECT id, username, email, display_name, phone_number, bio, avatar_url, status, last_seen, created_at, email_verified, phone_verified
      FROM users
      WHERE id = $1 AND is_active = true
    `;
    const userResult = await query(getUserQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const user = userResult.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name,
          phoneNumber: user.phone_number,
          bio: user.bio,
          avatarUrl: user.avatar_url,
          status: user.status,
          lastSeen: user.last_seen,
          createdAt: user.created_at,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
        },
      },
    });
  } catch (error) {
    logger.error('Get current user failed', {
      errorCode: error.code,
      errorMessage: error.message,
      userId: req.user?.userId,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_FAILED',
        message: 'Failed to get user data',
      },
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  refreshToken: refreshTokenHandler,
  getCurrentUser,
};
