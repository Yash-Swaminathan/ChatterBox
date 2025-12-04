const { requireAuth } = require('./auth');
const { generateAccessToken } = require('../utils/jwt');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('requireAuth', () => {
    test('should pass with valid token and attach user to req.user', () => {
      const token = generateAccessToken({ userId: '123', email: 'test@example.com' });
      req.headers.authorization = `Bearer ${token}`;

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('123');
      expect(req.user.email).toBe('test@example.com');
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should return 401 when no authorization header is provided', () => {
      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when authorization header does not start with Bearer', () => {
      req.headers.authorization = 'InvalidFormat token123';

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when authorization header is missing space after Bearer', () => {
      req.headers.authorization = 'Bearertoken123';

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 with INVALID_TOKEN for malformed token', () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 with TOKEN_EXPIRED for expired token', () => {
      // Create a token that expires immediately
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: '123', email: 'test@example.com' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '0s' }
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      // Wait a moment to ensure token is expired
      setTimeout(() => {
        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired',
          },
        });
        expect(next).not.toHaveBeenCalled();
      }, 100);
    });

    test('should return 401 when token has invalid signature', () => {
      const jwt = require('jsonwebtoken');
      const tokenWithWrongSecret = jwt.sign(
        { userId: '123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      req.headers.authorization = `Bearer ${tokenWithWrongSecret}`;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle empty token after Bearer', () => {
      req.headers.authorization = 'Bearer ';

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should not modify request object when token is invalid', () => {
      req.headers.authorization = 'Bearer invalid.token';

      requireAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    test('should extract token correctly using split method', () => {
      const token = generateAccessToken({ userId: '456', email: 'user@test.com' });
      req.headers.authorization = `Bearer ${token}`;

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('456');
      expect(req.user.email).toBe('user@test.com');
    });
  });
});
