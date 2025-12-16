const socketAuthMiddleware = require('../socketAuth');
const { extractToken } = socketAuthMiddleware;
const { generateAccessToken } = require('../../../utils/jwt');

describe('Socket Authentication Middleware', () => {
  describe('extractToken', () => {
    it('should extract token from auth.token', () => {
      const handshake = {
        auth: { token: 'test-token-123' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('test-token-123');
    });

    it('should extract token from query.token', () => {
      const handshake = {
        query: { token: 'query-token-456' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('query-token-456');
    });

    it('should extract token from Authorization header (Bearer)', () => {
      const handshake = {
        headers: { authorization: 'Bearer header-token-789' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('header-token-789');
    });

    it('should prioritize auth.token over query.token', () => {
      const handshake = {
        auth: { token: 'auth-token' },
        query: { token: 'query-token' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('auth-token');
    });

    it('should prioritize auth.token over Authorization header', () => {
      const handshake = {
        auth: { token: 'auth-token' },
        headers: { authorization: 'Bearer header-token' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('auth-token');
    });

    it('should trim whitespace from tokens', () => {
      const handshake = {
        auth: { token: '  token-with-spaces  ' },
      };

      const token = extractToken(handshake);
      expect(token).toBe('token-with-spaces');
    });

    it('should return null if no token found', () => {
      const handshake = {};

      const token = extractToken(handshake);
      expect(token).toBeNull();
    });

    it('should return null if token is not a string', () => {
      const handshake = {
        auth: { token: 12345 },
      };

      const token = extractToken(handshake);
      expect(token).toBeNull();
    });

    it('should handle malformed Authorization header', () => {
      const handshake = {
        headers: { authorization: 'InvalidFormat token' },
      };

      const token = extractToken(handshake);
      expect(token).toBeNull();
    });

    it('should handle empty Authorization header after Bearer', () => {
      const handshake = {
        headers: { authorization: 'Bearer   ' },
      };

      const token = extractToken(handshake);
      expect(token).toBeNull();
    });

    it('should handle null or undefined handshake fields gracefully', () => {
      const handshake = {
        auth: null,
        query: undefined,
        headers: null,
      };

      const token = extractToken(handshake);
      expect(token).toBeNull();
    });
  });

  describe('socketAuthMiddleware', () => {
    let mockSocket;
    let mockNext;

    beforeEach(() => {
      mockSocket = {
        id: 'test-socket-id',
        handshake: {
          address: '127.0.0.1',
        },
      };
      mockNext = jest.fn();
    });

    it('should authenticate with valid token', () => {
      const token = generateAccessToken({
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should reject connection without token', () => {
      mockSocket.handshake.auth = {};

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Authentication token required');
      expect(mockSocket.user).toBeUndefined();
    });

    it('should reject connection with invalid token', () => {
      mockSocket.handshake.auth = { token: 'invalid-token' };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Invalid token');
      expect(mockSocket.user).toBeUndefined();
    });

    it('should reject connection with malformed token', () => {
      mockSocket.handshake.auth = { token: 'not.a.jwt' };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockSocket.user).toBeUndefined();
    });

    it('should reject connection with expired token', () => {
      // Create token with past expiration
      const token = generateAccessToken(
        {
          userId: 'user-123',
          username: 'testuser',
        },
        '-1h' // Expired 1 hour ago
      );

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Token expired');
      expect(mockSocket.user).toBeUndefined();
    });

    it('should reject token without required userId field', () => {
      const token = generateAccessToken({
        username: 'testuser',
        // Missing userId
      });

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Invalid token payload');
      expect(mockSocket.user).toBeUndefined();
    });

    it('should reject token without required username field', () => {
      const token = generateAccessToken({
        userId: 'user-123',
        // Missing username
      });

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Invalid token payload');
      expect(mockSocket.user).toBeUndefined();
    });

    it('should handle token from query parameter', () => {
      const token = generateAccessToken({
        userId: 'user-456',
        username: 'queryuser',
      });

      mockSocket.handshake.query = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({
        userId: 'user-456',
        username: 'queryuser',
        email: null,
      });
    });

    it('should handle token from Authorization header', () => {
      const token = generateAccessToken({
        userId: 'user-789',
        username: 'headeruser',
      });

      mockSocket.handshake.headers = {
        authorization: `Bearer ${token}`,
      };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({
        userId: 'user-789',
        username: 'headeruser',
        email: null,
      });
    });

    it('should handle token with optional email field', () => {
      const token = generateAccessToken({
        userId: 'user-999',
        username: 'emailuser',
        email: 'user@test.com',
      });

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user.email).toBe('user@test.com');
    });

    it('should handle token without email field gracefully', () => {
      const token = generateAccessToken({
        userId: 'user-888',
        username: 'noemailuser',
      });

      mockSocket.handshake.auth = { token };

      socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({
        userId: 'user-888',
        username: 'noemailuser',
        email: null,
      });
    });
  });
});
