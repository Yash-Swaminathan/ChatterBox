// Capture the reset link instead of sending real email.
// Declared before the requires: this Jest config does not hoist jest.mock calls.
jest.mock('../../services/notificationService', () => ({
  getAppUrl: jest.fn(() => 'https://chat.example.com'),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const app = require('../../app');
const { query, closePool } = require('../../config/database');
const notificationService = require('../../services/notificationService');
const { hashToken } = require('../passwordResetController');

const testUser = {
  username: 'testuser_pwreset',
  email: 'testpwreset@example.com',
  password: 'OldPass123',
};
const NEW_PASSWORD = 'NewPass456';

async function cleanup() {
  await query("DELETE FROM users WHERE email LIKE '%pwreset@example.com'");
}

// Ask for a reset and return the token from the link that would have been emailed
async function requestResetToken(email = testUser.email) {
  notificationService.sendPasswordResetEmail.mockClear();
  await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);

  const call = notificationService.sendPasswordResetEmail.mock.calls[0];
  return call ? new URL(call[0].resetUrl).searchParams.get('token') : null;
}

const login = password =>
  request(app).post('/api/auth/login').send({ email: testUser.email, password });

describe('Password reset API', () => {
  let userId;
  let refreshToken;

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  // A fresh account with the original password for every test
  beforeEach(async () => {
    await cleanup();
    const response = await request(app).post('/api/auth/register').send(testUser).expect(201);
    userId = response.body.data.user.id;
    refreshToken = response.body.data.refreshToken;
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should email a reset link for an existing account', async () => {
      const token = await requestResetToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const email = notificationService.sendPasswordResetEmail.mock.calls[0][0];
      expect(email.to).toBe(testUser.email);
      expect(email.resetUrl).toMatch(/^https:\/\/chat\.example\.com\/reset-password\?token=/);
      expect(email.expiresInMinutes).toBe(30);
    });

    it('should store only a hash of the token', async () => {
      const token = await requestResetToken();

      const result = await query('SELECT token_hash FROM password_resets WHERE user_id = $1', [
        userId,
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].token_hash).toBe(hashToken(token));
      expect(result.rows[0].token_hash).not.toBe(token);
    });

    it('should respond identically for an unknown email and send nothing', async () => {
      const known = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);
      notificationService.sendPasswordResetEmail.mockClear();

      const unknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody_pwreset@example.com' })
        .expect(200);

      expect(unknown.body).toEqual(known.body);
      expect(notificationService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should require an email', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({}).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should make an earlier link stop working when a new one is requested', async () => {
      const firstToken = await requestResetToken();
      const secondToken = await requestResetToken();

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: firstToken, password: NEW_PASSWORD })
        .expect(400);
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: secondToken, password: NEW_PASSWORD })
        .expect(200);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should change the password', async () => {
      const token = await requestResetToken();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: NEW_PASSWORD })
        .expect(200);

      expect(response.body.success).toBe(true);
      await login(NEW_PASSWORD).expect(200);
      await login(testUser.password).expect(401);
    });

    it('should sign the user out of existing sessions', async () => {
      const token = await requestResetToken();

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: NEW_PASSWORD })
        .expect(200);

      await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('should only accept a token once', async () => {
      const token = await requestResetToken();

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: NEW_PASSWORD })
        .expect(200);
      const second = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'Another789' })
        .expect(400);

      expect(second.body.error.code).toBe('INVALID_RESET_TOKEN');
      await login(NEW_PASSWORD).expect(200);
    });

    it('should reject an expired token', async () => {
      const token = await requestResetToken();
      await query("UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [
        userId,
      ]);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: NEW_PASSWORD })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
      await login(testUser.password).expect(200);
    });

    it('should reject an unknown token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'f'.repeat(64), password: NEW_PASSWORD })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    });

    it('should apply the registration password rules', async () => {
      const token = await requestResetToken();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'weak' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      // The token is still usable after a rejected password
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: NEW_PASSWORD })
        .expect(200);
    });

    it('should require a token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: NEW_PASSWORD })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/users/unsubscribe', () => {
    const { createUnsubscribeToken } = require('../../services/messageNotifications');

    it('should turn off reply emails with a valid token', async () => {
      const token = createUnsubscribeToken(userId);

      const response = await request(app).get(`/api/users/unsubscribe?token=${token}`).expect(200);

      expect(response.text).toContain('no longer receive');
      const result = await query('SELECT email_notifications FROM users WHERE id = $1', [userId]);
      expect(result.rows[0].email_notifications).toBe(false);
    });

    it('should reject an invalid token and change nothing', async () => {
      await request(app).get('/api/users/unsubscribe?token=nope').expect(400);

      const result = await query('SELECT email_notifications FROM users WHERE id = $1', [userId]);
      expect(result.rows[0].email_notifications).toBe(true);
    });
  });
});
