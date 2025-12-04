const { validateRegistration, validateLogin } = require('./validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validateRegistration', () => {
    test('should pass with valid registration data', () => {
      req.body = {
        username: 'validuser',
        email: 'valid@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    // Username validation tests
    test('should reject missing username', () => {
      req.body = {
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: expect.arrayContaining(['Username is required']),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject empty username', () => {
      req.body = {
        username: '   ',
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Username is required']),
          }),
        })
      );
    });

    test('should reject username shorter than 3 characters', () => {
      req.body = {
        username: 'ab',
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Username must be at least 3 characters']),
          }),
        })
      );
    });

    test('should reject username longer than 50 characters', () => {
      req.body = {
        username: 'a'.repeat(51),
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Username must be less than 50 characters']),
          }),
        })
      );
    });

    test('should reject username with special characters', () => {
      req.body = {
        username: 'user@name',
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining([
              'Username can only contain letters, numbers, and underscores',
            ]),
          }),
        })
      );
    });

    test('should accept username with underscores', () => {
      req.body = {
        username: 'valid_user_123',
        email: 'test@example.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    // Email validation tests
    test('should reject missing email', () => {
      req.body = {
        username: 'validuser',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Email is required']),
          }),
        })
      );
    });

    test('should reject empty email', () => {
      req.body = {
        username: 'validuser',
        email: '   ',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Email is required']),
          }),
        })
      );
    });

    test('should reject invalid email format - no @', () => {
      req.body = {
        username: 'validuser',
        email: 'invalidemail.com',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Invalid email format']),
          }),
        })
      );
    });

    test('should reject invalid email format - no domain', () => {
      req.body = {
        username: 'validuser',
        email: 'test@',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Invalid email format']),
          }),
        })
      );
    });

    test('should reject invalid email format - no TLD', () => {
      req.body = {
        username: 'validuser',
        email: 'test@domain',
        password: 'Password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Invalid email format']),
          }),
        })
      );
    });

    test('should accept valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        req.body = {
          username: 'validuser',
          email: email,
          password: 'Password123',
        };
        next.mockClear();
        validateRegistration(req, res, next);
        expect(next).toHaveBeenCalled();
      });
    });

    // Password validation tests
    test('should reject missing password', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Password is required']),
          }),
        })
      );
    });

    test('should reject password shorter than 8 characters', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
        password: 'Pass1',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Password must be at least 8 characters']),
          }),
        })
      );
    });

    test('should reject password longer than 100 characters', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
        password: 'A1' + 'a'.repeat(99),
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Password must be less than 100 characters']),
          }),
        })
      );
    });

    test('should reject password without uppercase letter', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
        password: 'password123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining([
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            ]),
          }),
        })
      );
    });

    test('should reject password without lowercase letter', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
        password: 'PASSWORD123',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining([
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            ]),
          }),
        })
      );
    });

    test('should reject password without number', () => {
      req.body = {
        username: 'validuser',
        email: 'test@example.com',
        password: 'PasswordABC',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining([
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            ]),
          }),
        })
      );
    });

    // Multiple errors test
    test('should return all validation errors at once', () => {
      req.body = {
        username: 'ab',
        email: 'invalid',
        password: 'weak',
      };

      validateRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const call = res.json.mock.calls[0][0];
      expect(call.error.details.length).toBeGreaterThan(1);
    });
  });

  describe('validateLogin', () => {
    test('should pass with valid login data', () => {
      req.body = {
        email: 'test@example.com',
        password: 'anypassword',
      };

      validateLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should reject missing email', () => {
      req.body = {
        password: 'anypassword',
      };

      validateLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Email is required']),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject empty email', () => {
      req.body = {
        email: '   ',
        password: 'anypassword',
      };

      validateLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Email is required']),
          }),
        })
      );
    });

    test('should reject missing password', () => {
      req.body = {
        email: 'test@example.com',
      };

      validateLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Password is required']),
          }),
        })
      );
    });

    test('should reject empty password', () => {
      req.body = {
        email: 'test@example.com',
        password: '',
      };

      validateLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.arrayContaining(['Password is required']),
          }),
        })
      );
    });

    test('should reject both missing email and password', () => {
      req.body = {};

      validateLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const call = res.json.mock.calls[0][0];
      expect(call.error.details).toContain('Email is required');
      expect(call.error.details).toContain('Password is required');
    });

    test('should not validate email format for login (less strict)', () => {
      req.body = {
        email: 'notanemail',
        password: 'anypassword',
      };

      validateLogin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should not validate password strength for login', () => {
      req.body = {
        email: 'test@example.com',
        password: 'weak',
      };

      validateLogin(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
