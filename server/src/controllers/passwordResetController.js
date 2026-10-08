const crypto = require('crypto');
const validator = require('validator');
const { query, getClient } = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const RESET_TOKEN_TTL_MINUTES = 30;

// The database stores only this hash, so a leaked table does not contain usable links
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Request a password reset link
// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  // The same response whether or not the account exists, so this cannot be used to find accounts
  const genericResponse = {
    success: true,
    data: {
      message: 'If an account exists for that email, a reset link has been sent.',
    },
  };

  try {
    const rawEmail = String(req.body.email || '');
    const email = validator.normalizeEmail(rawEmail) || validator.trim(rawEmail);

    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Only the newest link should work
    await query(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(token), expiresAt]
    );

    const resetUrl = `${notificationService.getAppUrl()}/reset-password?token=${token}`;

    // Not awaited: the response time must not reveal whether an email was sent
    notificationService
      .sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      })
      .then(sent => {
        // Without an email provider configured there is no other way to get the link locally
        if (!sent && process.env.NODE_ENV === 'development') {
          logger.info('Password reset link (email not configured)', { resetUrl });
        }
      })
      .catch(error => {
        logger.error('Failed to send password reset email', { error: error.message });
      });

    logger.info('Password reset requested', { userId: user.id });

    return res.status(200).json(genericResponse);
  } catch (error) {
    logger.error('Forgot password failed', { error: error.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not process the request',
      },
    });
  }
}

// Set a new password using a reset token
// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const { token, password } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the row so two requests cannot both use the same token
    const resetResult = await client.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(token)]
    );
    const reset = resetResult.rows[0];

    if (!reset) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'This reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    const passwordHash = await hashPassword(password);

    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      reset.user_id,
    ]);
    await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);

    // Sign out everywhere: whoever knew the old password should not stay logged in
    await client.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [
      reset.user_id,
    ]);

    await client.query('COMMIT');

    logger.info('Password reset completed', { userId: reset.user_id });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Your password has been changed. You can now sign in.',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Reset password failed', { error: error.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not reset the password',
      },
    });
  } finally {
    client.release();
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
  hashToken,
  RESET_TOKEN_TTL_MINUTES,
};
