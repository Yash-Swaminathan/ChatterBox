const { hashPassword, comparePassword } = require('./bcrypt');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('./jwt');

describe('Bcrypt Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBe(60); // bcrypt hash length
    });

    it('should produce different hashes for the same password (salting)', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should hash passwords with bcrypt format', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      // bcrypt format: $2a$ or $2b$ followed by cost and salt
      expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'correctPassword123';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'correctPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty password correctly', async () => {
      const password = '';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should be case-sensitive', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await comparePassword('testpassword123', hash);
      expect(isValid).toBe(false);
    });
  });
});

describe('JWT Utilities', () => {
  const testPayload = {
    userId: 'test-user-id-123',
    email: 'test@example.com',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate different tokens for same payload', async () => {
      const token1 = generateAccessToken(testPayload);
      // Wait 1 second to ensure different iat (issued at) timestamp
      await new Promise(resolve => setTimeout(resolve, 1001));
      const token2 = generateAccessToken(testPayload);

      expect(token1).not.toBe(token2); // Different because of iat (issued at)
    });

    it('should include payload data in token', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should include expiration time', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should generate different tokens for same payload', async () => {
      const token1 = generateRefreshToken(testPayload);
      // Wait 1 second to ensure different iat (issued at) timestamp
      await new Promise(resolve => setTimeout(resolve, 1001));
      const token2 = generateRefreshToken(testPayload);

      expect(token1).not.toBe(token2);
    });

    it('should include payload data in token', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'notajwt';

      expect(() => {
        verifyAccessToken(malformedToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for empty token', () => {
      expect(() => {
        verifyAccessToken('');
      }).toThrow();
    });

    it('should reject refresh token when verifying as access token', () => {
      const refreshToken = generateRefreshToken(testPayload);

      expect(() => {
        verifyAccessToken(refreshToken);
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyRefreshToken(invalidToken);
      }).toThrow('Invalid refresh token');
    });

    it('should reject access token when verifying as refresh token', () => {
      const accessToken = generateAccessToken(testPayload);

      expect(() => {
        verifyRefreshToken(accessToken);
      }).toThrow('Invalid refresh token');
    });
  });

  describe('Token expiration times', () => {
    it('should set access token to expire in approximately 15 minutes', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;

      // Should be approximately 15 minutes (900 seconds), allow 5 second variance
      expect(expiresIn).toBeGreaterThanOrEqual(895);
      expect(expiresIn).toBeLessThanOrEqual(905);
    });

    it('should set refresh token to expire in approximately 7 days', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;

      // Should be approximately 7 days (604800 seconds), allow 5 second variance
      expect(expiresIn).toBeGreaterThanOrEqual(604795);
      expect(expiresIn).toBeLessThanOrEqual(604805);
    });
  });
});

describe('Integration: Bcrypt + JWT', () => {
  it('should simulate complete user authentication flow', async () => {
    // Step 1: Hash password during registration
    const password = 'UserPassword123';
    const passwordHash = await hashPassword(password);

    // Step 2: Store user (simulated)
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      passwordHash,
    };

    // Step 3: Login - verify password
    const loginPassword = 'UserPassword123';
    const isPasswordValid = await comparePassword(loginPassword, user.passwordHash);
    expect(isPasswordValid).toBe(true);

    // Step 4: Generate tokens after successful login
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Step 5: Verify tokens can be decoded
    const accessDecoded = verifyAccessToken(accessToken);
    const refreshDecoded = verifyRefreshToken(refreshToken);

    expect(accessDecoded.userId).toBe(user.id);
    expect(accessDecoded.email).toBe(user.email);
    expect(refreshDecoded.userId).toBe(user.id);
    expect(refreshDecoded.email).toBe(user.email);
  });

  it('should reject login with wrong password', async () => {
    // Setup
    const correctPassword = 'CorrectPassword123';
    const wrongPassword = 'WrongPassword456';
    const passwordHash = await hashPassword(correctPassword);

    // Attempt login with wrong password
    const isValid = await comparePassword(wrongPassword, passwordHash);
    expect(isValid).toBe(false);

    // Should not generate tokens if password is invalid
    if (!isValid) {
      // Login fails, no tokens generated
      expect(true).toBe(true);
    }
  });

  it('should handle token refresh flow', async () => {
    const payload = { userId: 'user-123', email: 'user@example.com' };

    // Generate initial tokens
    const initialAccessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Simulate time passing
    await new Promise(resolve => setTimeout(resolve, 1001));

    // Simulate access token expiring
    // Verify refresh token is still valid
    const refreshDecoded = verifyRefreshToken(refreshToken);
    expect(refreshDecoded.userId).toBe(payload.userId);

    // Generate new access token using refresh token data
    const newAccessToken = generateAccessToken({
      userId: refreshDecoded.userId,
      email: refreshDecoded.email,
    });

    expect(newAccessToken).toBeDefined();
    expect(newAccessToken).not.toBe(initialAccessToken);

    // New access token should be valid
    const newAccessDecoded = verifyAccessToken(newAccessToken);
    expect(newAccessDecoded.userId).toBe(payload.userId);
  });
});
