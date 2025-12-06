const request = require('supertest');
const app = require('../app');
const { query, closePool } = require('../config/database');

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'TestPass123',
  displayName: 'Test User',
};

const testUser2 = {
  username: 'testuser2',
  email: 'test2@example.com',
  password: 'TestPass456',
};

// Store tokens for testing
let accessToken;
let refreshToken;
let userId;

// Clean up function to delete test users
async function cleanupTestUsers() {
  try {
    await query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', [
      'test%@example.com',
    ]);
    await query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
  } catch (error) {
    console.error('Error cleaning up test users:', error);
  }
}

// Setup and teardown
beforeAll(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
  await closePool();
});

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app).post('/api/auth/register').send(testUser).expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            username: testUser.username,
            email: testUser.email,
            displayName: testUser.displayName,
          },
        },
      });

      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Store tokens for later tests
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
      userId = response.body.data.user.id;
    });

    test('should reject registration with duplicate email', async () => {
      const duplicateUser = {
        username: 'different',
        email: testUser.email,
        password: 'TestPass123',
      };

      const response = await request(app).post('/api/auth/register').send(duplicateUser).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email or username already exists',
        },
      });
    });

    test('should reject registration with duplicate username', async () => {
      const duplicateUser = {
        username: testUser.username,
        email: 'different@example.com',
        password: 'TestPass123',
      };

      const response = await request(app).post('/api/auth/register').send(duplicateUser).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'USER_EXISTS',
        },
      });
    });

    test('should reject registration with invalid email', async () => {
      const invalidUser = {
        username: 'validuser',
        email: 'invalid-email',
        password: 'TestPass123',
      };

      const response = await request(app).post('/api/auth/register').send(invalidUser).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
      expect(response.body.error.details).toContain('Invalid email format');
    });

    test('should reject registration with short password', async () => {
      const invalidUser = {
        username: 'validuser',
        email: 'valid@example.com',
        password: 'short',
      };

      const response = await request(app).post('/api/auth/register').send(invalidUser).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Password must be at least 8 characters');
    });

    test('should reject registration with short username', async () => {
      const invalidUser = {
        username: 'ab',
        email: 'valid@example.com',
        password: 'TestPass123',
      };

      const response = await request(app).post('/api/auth/register').send(invalidUser).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('Username must be at least 3 characters');
    });

    test('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: testUser.email,
            username: testUser.username,
            status: 'online',
          },
        },
      });

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Update tokens for later tests
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      });
    });

    test('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: userId,
            email: testUser.email,
            username: testUser.username,
          },
        },
      });

      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toMatch(/INVALID_TOKEN|TOKEN_EXPIRED/);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
        },
      });

      // Update access token
      accessToken = response.body.data.accessToken;
    });

    test('should reject refresh without token', async () => {
      const response = await request(app).post('/api/auth/refresh').send({}).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
        },
      });
    });

    test('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    });

    test('should reject logout without auth token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: refreshToken,
        })
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    test('should reject refresh token after logout', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SESSION_INACTIVE',
        },
      });
    });
  });

  describe('Complete Authentication Flow', () => {
    test('should complete full registration -> login -> access protected route -> logout flow', async () => {
      // 1. Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser2)
        .expect(201);

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        registerResponse.body.data;

      // 2. Access protected route
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(meResponse.body.data.user.email).toBe(testUser2.email);

      // 3. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      const newAccessToken2 = refreshResponse.body.data.accessToken;

      // 4. Use new access token
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken2}`)
        .expect(200);

      // 5. Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken2}`)
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      // 6. Verify token is invalidated
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(401);
    });
  });

  describe('Password Security', () => {
    test('should not return password hash in any response', async () => {
      // Register with unique credentials
      const uniqueId = Date.now();
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: `securitytest${uniqueId}`,
          email: `security${uniqueId}@example.com`,
          password: 'TestPass123',
        })
        .expect(201);

      expect(registerResponse.body.data.user).not.toHaveProperty('password_hash');

      // Login
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: `security${uniqueId}@example.com`,
        password: 'TestPass123',
      });

      expect(loginResponse.body.data.user).not.toHaveProperty('password_hash');

      // Get current user
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginResponse.body.data.accessToken}`);

      expect(meResponse.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should hash passwords differently for same password', async () => {
      // Get the password hash from database
      const result = await query(
        'SELECT password_hash FROM users WHERE email = $1',
        [testUser.email]
      );
      const hash1 = result.rows[0].password_hash;

      // Register another user with same password
      await request(app).post('/api/auth/register').send({
        username: 'samepass',
        email: 'samepass@example.com',
        password: testUser.password,
      });

      const result2 = await query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['samepass@example.com']
      );
      const hash2 = result2.rows[0].password_hash;

      // Hashes should be different (bcrypt generates unique salt)
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Session Management', () => {
    test('should create session on login', async () => {
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser2.email,
        password: testUser2.password,
      });

      const { refreshToken: token } = loginResponse.body.data;

      // Check session exists in database
      const sessionResult = await query(
        'SELECT * FROM sessions WHERE refresh_token = $1',
        [token]
      );

      expect(sessionResult.rows.length).toBe(1);
      expect(sessionResult.rows[0].is_active).toBe(true);
    });

    test('should deactivate session on logout', async () => {
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser2.email,
        password: testUser2.password,
      });

      const { accessToken: token, refreshToken: rToken } = loginResponse.body.data;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: rToken });

      // Check session is inactive
      const sessionResult = await query(
        'SELECT * FROM sessions WHERE refresh_token = $1',
        [rToken]
      );

      expect(sessionResult.rows[0].is_active).toBe(false);
    });
  });

  describe('User Status Management', () => {
    test('should set status to online on login', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser2.email,
        password: testUser2.password,
      });

      expect(response.body.data.user.status).toBe('online');

      // Verify in database
      const userResult = await query(
        'SELECT status FROM users WHERE email = $1',
        [testUser2.email]
      );
      expect(userResult.rows[0].status).toBe('online');
    });

    test('should set status to offline on logout', async () => {
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser2.email,
        password: testUser2.password,
      });

      const { accessToken: token, refreshToken: rToken } = loginResponse.body.data;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: rToken });

      // Verify in database
      const userResult = await query(
        'SELECT status FROM users WHERE email = $1',
        [testUser2.email]
      );
      expect(userResult.rows[0].status).toBe('offline');
    });
  });
});
