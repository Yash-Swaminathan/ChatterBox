const Message = require('../Message');
const { pool } = require('../../config/database');

jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('Message Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateContent', () => {
    it('should return null for valid content', () => {
      expect(Message.validateContent('Hello world')).toBeNull();
    });

    it('should reject undefined content', () => {
      expect(Message.validateContent(undefined)).toBe('Content is required');
    });

    it('should reject null content', () => {
      expect(Message.validateContent(null)).toBe('Content is required');
    });

    it('should reject non-string content', () => {
      expect(Message.validateContent(123)).toBe('Content must be a string');
      expect(Message.validateContent({ text: 'hi' })).toBe('Content must be a string');
      expect(Message.validateContent(['hi'])).toBe('Content must be a string');
    });

    it('should reject empty string', () => {
      expect(Message.validateContent('')).toBe('Content cannot be empty');
    });

    it('should reject whitespace-only content', () => {
      expect(Message.validateContent('   ')).toBe('Content cannot be empty');
      expect(Message.validateContent('\t\n')).toBe('Content cannot be empty');
    });

    it('should reject content exceeding max length', () => {
      const longContent = 'a'.repeat(10001);
      expect(Message.validateContent(longContent)).toBe(
        `Content exceeds maximum length of ${Message.MAX_CONTENT_LENGTH} characters`
      );
    });

    it('should accept content at max length', () => {
      const maxContent = 'a'.repeat(10000);
      expect(Message.validateContent(maxContent)).toBeNull();
    });

    it('should accept unicode and emoji content', () => {
      expect(Message.validateContent('Hello 👋 World 🌍')).toBeNull();
      expect(Message.validateContent('مرحبا')).toBeNull();
      expect(Message.validateContent('你好')).toBeNull();
    });
  });

  describe('create', () => {
    const mockMessage = {
      id: 'msg-123',
      conversation_id: 'conv-123',
      sender_id: 'user-123',
      content: 'Hello world',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    const mockMessageWithSender = {
      ...mockMessage,
      sender: {
        id: 'user-123',
        username: 'testuser',
        avatarUrl: null,
      },
    };

    it('should create a message with valid data', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [mockMessage] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockMessageWithSender] }); // findById

      const result = await Message.create('conv-123', 'user-123', 'Hello world');

      expect(result.id).toBe('msg-123');
      expect(result.content).toBe('Hello world');
      expect(result.sender.username).toBe('testuser');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), [
        'conv-123',
        'user-123',
        'Hello world',
      ]);
    });

    it('should trim whitespace from content', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [mockMessage] })
        .mockResolvedValueOnce({ rows: [mockMessageWithSender] });

      await Message.create('conv-123', 'user-123', '  Hello world  ');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), [
        'conv-123',
        'user-123',
        'Hello world',
      ]);
    });

    it('should reject empty content', async () => {
      await expect(Message.create('conv-123', 'user-123', '')).rejects.toThrow(
        'Content cannot be empty'
      );

      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only content', async () => {
      await expect(Message.create('conv-123', 'user-123', '   ')).rejects.toThrow(
        'Content cannot be empty'
      );
    });

    it('should reject content exceeding max length', async () => {
      const longContent = 'a'.repeat(10001);

      await expect(Message.create('conv-123', 'user-123', longContent)).rejects.toThrow(
        'Content exceeds maximum length'
      );
    });

    it('should handle database errors', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(Message.create('conv-123', 'user-123', 'Hello')).rejects.toThrow('DB error');
    });
  });

  describe('findById', () => {
    it('should return message with sender info', async () => {
      const mockResult = {
        id: 'msg-123',
        conversation_id: 'conv-123',
        sender_id: 'user-123',
        content: 'Hello',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        sender: {
          id: 'user-123',
          username: 'testuser',
          avatarUrl: 'http://example.com/avatar.jpg',
        },
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockResult] });

      const result = await Message.findById('msg-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('msg-123');
      expect(result.sender.username).toBe('testuser');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['msg-123']);
    });

    it('should return null for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByConversation', () => {
    const mockMessages = [
      {
        id: 'msg-3',
        content: 'Third message',
        created_at: new Date('2025-01-03'),
        sender: { id: 'user-1', username: 'user1', avatarUrl: null },
      },
      {
        id: 'msg-2',
        content: 'Second message',
        created_at: new Date('2025-01-02'),
        sender: { id: 'user-2', username: 'user2', avatarUrl: null },
      },
      {
        id: 'msg-1',
        content: 'First message',
        created_at: new Date('2025-01-01'),
        sender: { id: 'user-1', username: 'user1', avatarUrl: null },
      },
    ];

    it('should return messages ordered by created_at DESC', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: mockMessages });

      const result = await Message.findByConversation('conv-123');

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].id).toBe('msg-3'); // Most recent first
      expect(result.hasMore).toBe(false);
    });

    it('should respect limit parameter', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: mockMessages.slice(0, 2) });

      const result = await Message.findByConversation('conv-123', { limit: 2 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['conv-123', 3]) // limit + 1 for hasMore check
      );
    });

    it('should support cursor-based pagination', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [mockMessages[2]] });

      const result = await Message.findByConversation('conv-123', { cursor: 'msg-2' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at <'),
        expect.arrayContaining(['conv-123', 'msg-2'])
      );
    });

    it('should return hasMore flag correctly', async () => {
      // Return limit + 1 messages to indicate more available
      const messagesWithExtra = [...mockMessages, { id: 'msg-0' }];
      pool.query = jest.fn().mockResolvedValue({ rows: messagesWithExtra });

      const result = await Message.findByConversation('conv-123', { limit: 3 });

      expect(result.hasMore).toBe(true);
      expect(result.messages).toHaveLength(3); // Should not include extra
      expect(result.nextCursor).toBe('msg-1');
    });

    it('should return nextCursor as null when no more messages', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: mockMessages.slice(0, 2) });

      const result = await Message.findByConversation('conv-123', { limit: 3 });

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should exclude deleted messages by default', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Message.findByConversation('conv-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });

    it('should include deleted messages when requested', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Message.findByConversation('conv-123', { includeDeleted: true });

      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });

    it('should handle empty conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.findByConversation('conv-123');

      expect(result.messages).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should enforce maximum limit of 100', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Message.findByConversation('conv-123', { limit: 200 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([101]) // 100 + 1 for hasMore
      );
    });

    it('should enforce minimum limit of 1', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Message.findByConversation('conv-123', { limit: 0 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([2]) // 1 + 1 for hasMore
      );
    });
  });

  describe('update', () => {
    const mockUpdatedMessage = {
      id: 'msg-123',
      content: 'Updated content',
      updated_at: new Date(),
      sender: { id: 'user-123', username: 'testuser', avatarUrl: null },
    };

    it('should update message content', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'msg-123' }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [mockUpdatedMessage] }); // findById

      const result = await Message.update('msg-123', 'Updated content');

      expect(result.content).toBe('Updated content');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE messages'), [
        'Updated content',
        'msg-123',
      ]);
    });

    it('should trim updated content', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'msg-123' }] })
        .mockResolvedValueOnce({ rows: [mockUpdatedMessage] });

      await Message.update('msg-123', '  Updated content  ');

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['Updated content', 'msg-123']);
    });

    it('should return null for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.update('non-existent', 'New content');

      expect(result).toBeNull();
    });

    it('should reject empty content', async () => {
      await expect(Message.update('msg-123', '')).rejects.toThrow('Content cannot be empty');
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should reject content exceeding max length', async () => {
      const longContent = 'a'.repeat(10001);
      await expect(Message.update('msg-123', longContent)).rejects.toThrow(
        'Content exceeds maximum length'
      );
    });
  });

  describe('softDelete', () => {
    it('should set deleted_at timestamp', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'msg-123' }] });

      const result = await Message.softDelete('msg-123');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET deleted_at = CURRENT_TIMESTAMP'),
        ['msg-123']
      );
    });

    it('should return false for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.softDelete('non-existent');

      expect(result).toBe(false);
    });

    it('should return false if already deleted', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.softDelete('msg-123');

      expect(result).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
        'msg-123',
      ]);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      const result = await Message.hardDelete('msg-123');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['msg-123']);
    });

    it('should return false for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 0 });

      const result = await Message.hardDelete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true for message owner', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'msg-123' }] });

      const result = await Message.isOwner('msg-123', 'user-123');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('sender_id = $2'), [
        'msg-123',
        'user-123',
      ]);
    });

    it('should return false for non-owner', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.isOwner('msg-123', 'other-user');

      expect(result).toBe(false);
    });

    it('should return false for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.isOwner('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('countByConversation', () => {
    it('should return message count', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await Message.countByConversation('conv-123');

      expect(result).toBe(42);
    });

    it('should exclude deleted messages by default', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '0' }] });

      await Message.countByConversation('conv-123');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
        'conv-123',
      ]);
    });

    it('should include deleted messages when requested', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '0' }] });

      await Message.countByConversation('conv-123', true);

      expect(pool.query).toHaveBeenCalledWith(expect.not.stringContaining('deleted_at IS NULL'), [
        'conv-123',
      ]);
    });

    it('should return 0 for empty conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await Message.countByConversation('conv-123');

      expect(result).toBe(0);
    });
  });

  describe('getLatest', () => {
    it('should return latest message with sender info', async () => {
      const mockMessage = {
        id: 'msg-123',
        content: 'Latest message',
        created_at: new Date(),
        sender: { id: 'user-123', username: 'testuser', avatarUrl: null },
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [mockMessage] });

      const result = await Message.getLatest('conv-123');

      expect(result.id).toBe('msg-123');
      expect(result.content).toBe('Latest message');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY m.created_at DESC'),
        ['conv-123']
      );
    });

    it('should return null for empty conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.getLatest('conv-123');

      expect(result).toBeNull();
    });

    it('should exclude deleted messages', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await Message.getLatest('conv-123');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
        'conv-123',
      ]);
    });
  });

  describe('exists', () => {
    it('should return true for existing non-deleted message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 'msg-123' }] });

      const result = await Message.exists('msg-123');

      expect(result).toBe(true);
    });

    it('should return false for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.exists('non-existent');

      expect(result).toBe(false);
    });

    it('should return false for deleted message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.exists('deleted-msg');

      expect(result).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
        'deleted-msg',
      ]);
    });
  });

  describe('getConversationId', () => {
    it('should return conversation ID for existing message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ conversation_id: 'conv-123' }] });

      const result = await Message.getConversationId('msg-123');

      expect(result).toBe('conv-123');
    });

    it('should return null for non-existent message', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Message.getConversationId('non-existent');

      expect(result).toBeNull();
    });
  });
});
