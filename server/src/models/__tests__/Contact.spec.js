const Contact = require('../Contact');
const { pool } = require('../../config/database');

jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('Contact Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: false,
        is_favorite: false,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.create('user-1', 'user-2');

      expect(result.id).toBe('contact-123');
      expect(result.userId).toBe('user-1');
      expect(result.contactUserId).toBe('user-2');
      expect(result.created).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contacts'),
        ['user-1', 'user-2', null]
      );
    });

    it('should return existing contact if already exists (idempotent)', async () => {
      const oldDate = new Date(Date.now() - 10000); // 10 seconds ago
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: false,
        is_favorite: false,
        added_at: oldDate
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.create('user-1', 'user-2');

      expect(result.id).toBe('contact-123');
      expect(result.created).toBe(false); // Not newly created
    });

    it('should throw error on self-contact attempt (CHECK constraint)', async () => {
      const error = new Error('CHECK constraint violation');
      error.code = '23514';
      pool.query = jest.fn().mockRejectedValue(error);

      await expect(Contact.create('user-1', 'user-1')).rejects.toThrow('Cannot add yourself as a contact');
    });

    it('should throw error if target user does not exist (foreign key)', async () => {
      const error = new Error('Foreign key violation');
      error.code = '23503';
      pool.query = jest.fn().mockRejectedValue(error);

      await expect(Contact.create('user-1', 'non-existent')).rejects.toThrow('Contact user not found');
    });

    it('should create contact with nickname', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: 'Alice',
        is_blocked: false,
        is_favorite: false,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.create('user-1', 'user-2', 'Alice');

      expect(result.nickname).toBe('Alice');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contacts'),
        ['user-1', 'user-2', 'Alice']
      );
    });

    it('should create contact without nickname (null)', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: false,
        is_favorite: false,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.create('user-1', 'user-2');

      expect(result.nickname).toBeNull();
    });

    it('should throw error if missing contacts table', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      await expect(Contact.create('user-1', 'user-2'))
        .rejects.toThrow('Database schema not initialized. Please run migrations.');
    });

    it('should handle database errors gracefully', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      await expect(Contact.create('user-1', 'user-2')).rejects.toThrow('Database connection lost');
    });
  });

  describe('findById', () => {
    it('should find contact by ID', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: 'Alice',
        is_blocked: false,
        is_favorite: true,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.findById('contact-123');

      expect(result.id).toBe('contact-123');
      expect(result.nickname).toBe('Alice');
      expect(result.isFavorite).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id'),
        ['contact-123']
      );
    });

    it('should return null if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null if contacts table does not exist', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Contact.findById('contact-123');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should list contacts for user with pagination', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          user_id: 'user-1',
          contact_user_id: 'user-2',
          nickname: 'Alice',
          is_blocked: false,
          is_favorite: true,
          added_at: new Date(),
          username: 'alice',
          email: 'alice@example.com',
          display_name: 'Alice Smith',
          avatar_url: null,
          status: 'online',
          last_seen: new Date()
        },
        {
          id: 'contact-2',
          user_id: 'user-1',
          contact_user_id: 'user-3',
          nickname: null,
          is_blocked: false,
          is_favorite: false,
          added_at: new Date(),
          username: 'bob',
          email: 'bob@example.com',
          display_name: 'Bob Jones',
          avatar_url: null,
          status: 'offline',
          last_seen: new Date()
        }
      ];

      pool.query = jest.fn().mockResolvedValue({ rows: mockContacts });

      const result = await Contact.findByUser('user-1', 50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('contact-1');
      expect(result[0].user.username).toBe('alice');
      expect(result[1].user.username).toBe('bob');
    });

    it('should filter blocked contacts by default', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Contact.findByUser('user-1', 50, 0, false);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND c.is_blocked = FALSE'),
        expect.any(Array)
      );
    });

    it('should include blocked contacts when requested', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Contact.findByUser('user-1', 50, 0, true);

      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('AND c.is_blocked = FALSE'),
        expect.any(Array)
      );
    });

    it('should return empty array if user has no contacts', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.findByUser('user-with-no-contacts');

      expect(result).toEqual([]);
    });

    it('should enforce max limit (200 contacts per query)', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Contact.findByUser('user-1', 500, 0);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['user-1', 200, 0])
      );
    });

    it('should handle pagination edge cases (offset > total)', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.findByUser('user-1', 50, 1000);

      expect(result).toEqual([]);
    });

    it('should return empty array if contacts table does not exist', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Contact.findByUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('isContact', () => {
    it('should return true if contact exists', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'contact-123' }] });

      const result = await Contact.isContact('user-1', 'user-2');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1'),
        ['user-1', 'user-2']
      );
    });

    it('should return false if contact does not exist', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.isContact('user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false if contacts table does not exist', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Contact.isContact('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('countByUser', () => {
    it('should count total contacts for user', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ total: '15' }] });

      const result = await Contact.countByUser('user-1');

      expect(result).toBe(15);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['user-1']
      );
    });

    it('should count excluding blocked contacts by default', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ total: '10' }] });

      await Contact.countByUser('user-1', false);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND is_blocked = FALSE'),
        expect.any(Array)
      );
    });

    it('should count including blocked contacts when requested', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ total: '12' }] });

      await Contact.countByUser('user-1', true);

      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('AND is_blocked = FALSE'),
        expect.any(Array)
      );
    });

    it('should return 0 if contacts table does not exist', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Contact.countByUser('user-1');

      expect(result).toBe(0);
    });
  });

  describe('updateNickname', () => {
    it('should update nickname successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: 'New Nickname',
        is_blocked: false,
        is_favorite: false,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.updateNickname('contact-123', 'New Nickname');

      expect(result.nickname).toBe('New Nickname');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contacts'),
        ['New Nickname', 'contact-123']
      );
    });

    it('should return null if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.updateNickname('non-existent', 'Nickname');

      expect(result).toBeNull();
    });

    it('should handle database errors on update', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(Contact.updateNickname('contact-123', 'Nickname')).rejects.toThrow('Database error');
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite status', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: false,
        is_favorite: true,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.toggleFavorite('contact-123');

      expect(result.isFavorite).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_favorite = NOT is_favorite'),
        ['contact-123']
      );
    });

    it('should return null if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.toggleFavorite('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteContact', () => {
    it('should delete contact by ID', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'contact-123' }] });

      const result = await Contact.deleteContact('contact-123');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM contacts'),
        ['contact-123']
      );
    });

    it('should return false if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.deleteContact('non-existent');

      expect(result).toBe(false);
    });

    it('should handle database errors on delete', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(Contact.deleteContact('contact-123')).rejects.toThrow('Database error');
    });
  });

  describe('deleteByUsers', () => {
    it('should delete contact by userId pair', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'contact-123' }] });

      const result = await Contact.deleteByUsers('user-1', 'user-2');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM contacts'),
        ['user-1', 'user-2']
      );
    });

    it('should return false if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.deleteByUsers('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should check if contact exists (alias for isContact)', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'contact-123' }] });

      const result = await Contact.exists('user-1', 'user-2');

      expect(result).toBe(true);
    });
  });

  describe('getContactDetails', () => {
    it('should get contact with full user information', async () => {
      const mockRow = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: 'Alice',
        is_blocked: false,
        is_favorite: true,
        added_at: new Date(),
        username: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice Smith',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'online',
        last_seen: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockRow] });

      const result = await Contact.getContactDetails('contact-123');

      expect(result.id).toBe('contact-123');
      expect(result.user.username).toBe('alice');
      expect(result.user.email).toBe('alice@example.com');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN users'),
        ['contact-123']
      );
    });

    it('should return null if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.getContactDetails('non-existent');

      expect(result).toBeNull();
    });

    it('should return null if contacts table does not exist', async () => {
      const error = new Error('Table does not exist');
      error.code = '42P01';
      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Contact.getContactDetails('contact-123');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle unicode/emoji in nickname', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: '😀 Best Friend',
        is_blocked: false,
        is_favorite: false,
        added_at: new Date()
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.updateNickname('contact-123', '😀 Best Friend');

      expect(result.nickname).toBe('😀 Best Friend');
    });

    it('should prevent SQL injection in queries', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Contact.findById(maliciousInput);

      // Verify parameterized query was used (not string concatenation)
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [maliciousInput]
      );
    });
  });

  describe('toggleBlock', () => {
    it('should block contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: true,
        is_favorite: false,
        added_at: new Date(),
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.toggleBlock('contact-123', true);

      expect(result.isBlocked).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contacts'),
        [true, 'contact-123']
      );
    });

    it('should unblock contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        user_id: 'user-1',
        contact_user_id: 'user-2',
        nickname: null,
        is_blocked: false,
        is_favorite: false,
        added_at: new Date(),
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockContact] });

      const result = await Contact.toggleBlock('contact-123', false);

      expect(result.isBlocked).toBe(false);
    });

    it('should return null if contact not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.toggleBlock('non-existent', true);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(Contact.toggleBlock('contact-123', true)).rejects.toThrow('DB error');
    });
  });

  describe('isBlocked', () => {
    it('should return true if user A blocked user B', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ blocked: true }] });

      const result = await Contact.isBlocked('user-1', 'user-2');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        ['user-1', 'user-2']
      );
    });

    it('should return true if user B blocked user A (bidirectional)', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ blocked: true }] });

      const result = await Contact.isBlocked('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false if not blocked', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ blocked: false }] });

      const result = await Contact.isBlocked('user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false on database errors (fail-safe)', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await Contact.isBlocked('user-1', 'user-2');

      expect(result).toBe(false); // Fail-safe: don't block on errors
    });
  });

  describe('isSenderBlockedInConversation', () => {
    it('should return true if sender blocked in direct conversation', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ type: 'direct' }] }) // First query: conversation type
        .mockResolvedValueOnce({ rows: [{ blocked: true }] }); // Second query: blocking check

      const result = await Contact.isSenderBlockedInConversation('conv-123', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for group conversations', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ type: 'group' }] });

      const result = await Contact.isSenderBlockedInConversation('conv-123', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false if not blocked in direct conversation', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ type: 'direct' }] })
        .mockResolvedValueOnce({ rows: [{ blocked: false }] });

      const result = await Contact.isSenderBlockedInConversation('conv-123', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false if conversation not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Contact.isSenderBlockedInConversation('non-existent', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false on database errors (fail-safe)', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await Contact.isSenderBlockedInConversation('conv-123', 'user-1');

      expect(result).toBe(false); // Fail-safe
    });
  });
});
