const Conversation = require('../Conversation');
const { pool } = require('../../config/database');

jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('Conversation Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create conversation with participants', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            // INSERT conversation
            rows: [
              {
                id: 'conv-123',
                type: 'direct',
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }) // INSERT participant 1
          .mockResolvedValueOnce({ rows: [] }) // INSERT participant 2
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };

      pool.connect = jest.fn().mockResolvedValue(mockClient);

      const result = await Conversation.create('direct', ['user-1', 'user-2']);

      expect(result.id).toBe('conv-123');
      expect(result.type).toBe('direct');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('DB error')), // INSERT fails
        release: jest.fn(),
      };

      pool.connect = jest.fn().mockResolvedValue(mockClient);

      await expect(Conversation.create('direct', ['user-1', 'user-2'])).rejects.toThrow('DB error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findDirectConversation', () => {
    it('should find existing direct conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'conv-123',
            type: 'direct',
            created_at: new Date(),
          },
        ],
      });

      const result = await Conversation.findDirectConversation('user-1', 'user-2');

      expect(result).toBeDefined();
      expect(result.id).toBe('conv-123');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT c.*'), [
        'user-1',
        'user-2',
      ]);
    });

    it('should return null if conversation does not exist', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Conversation.findDirectConversation('user-1', 'user-2');

      expect(result).toBeNull();
    });
  });

  describe('getOrCreateDirect', () => {
    it('should return existing conversation', async () => {
      const existingConv = {
        id: 'conv-123',
        type: 'direct',
        created_at: new Date(),
      };

      pool.query = jest.fn().mockResolvedValue({ rows: [existingConv] });

      const { conversation, created } = await Conversation.getOrCreateDirect('user-1', 'user-2');

      expect(created).toBe(false);
      expect(conversation.id).toBe('conv-123');
    });

    it('should create new conversation if does not exist', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // pg_advisory_lock
        .mockResolvedValueOnce({ rows: [] }) // findDirectConversation
        .mockResolvedValueOnce({ rows: [] }); // pg_advisory_unlock

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            // INSERT conversation
            rows: [{ id: 'conv-456', type: 'direct', created_at: new Date() }],
          })
          .mockResolvedValueOnce({ rows: [] }) // INSERT participant 1
          .mockResolvedValueOnce({ rows: [] }) // INSERT participant 2
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };

      pool.connect = jest.fn().mockResolvedValue(mockClient);

      const { conversation, created } = await Conversation.getOrCreateDirect('user-1', 'user-2');

      expect(created).toBe(true);
      expect(conversation.id).toBe('conv-456');
    });
  });

  describe('findById', () => {
    it('should return conversation with participants', async () => {
      pool.query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'conv-123',
            type: 'direct',
            participants: [
              {
                userId: 'user-2',
                username: 'user2',
                email: 'user2@example.com',
                avatarUrl: null,
              },
            ],
          },
        ],
      });

      const result = await Conversation.findById('conv-123', 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('conv-123');
      expect(result.participants).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        'conv-123',
        'user-1',
      ]);
    });

    it('should return null if conversation not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Conversation.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should return user conversations with pagination', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({
          // conversations query
          rows: [
            {
              id: 'conv-123',
              type: 'direct',
              participants: [{ userId: 'user-2', username: 'user2' }],
            },
          ],
        })
        .mockResolvedValueOnce({
          // count query
          rows: [{ count: '1' }],
        });

      const result = await Conversation.findByUser('user-1', { limit: 20, offset: 0 });

      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should respect pagination parameters', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await Conversation.findByUser('user-1', { limit: 10, offset: 5 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        expect.arrayContaining(['user-1', 10, 5])
      );
    });

    it('should filter by type when provided', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await Conversation.findByUser('user-1', { limit: 20, offset: 0, type: 'direct' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('c.type = $4'),
        expect.arrayContaining(['user-1', 20, 0, 'direct'])
      );
    });

    it('should return empty array if user has no conversations', async () => {
      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Conversation.findByUser('user-1', { limit: 20, offset: 0 });

      expect(result.conversations).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('addParticipant', () => {
    it('should add participant to conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Conversation.addParticipant('conv-123', 'user-3', false);

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversation_participants'),
        ['conv-123', 'user-3', false]
      );
    });

    it('should return false if participant already exists', async () => {
      const error = new Error('Duplicate');
      error.code = '23505'; // Unique constraint violation

      pool.query = jest.fn().mockRejectedValue(error);

      const result = await Conversation.addParticipant('conv-123', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant from conversation (soft delete)', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      const result = await Conversation.removeParticipant('conv-123', 'user-2');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversation_participants'),
        ['conv-123', 'user-2']
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET left_at = NOW()'),
        ['conv-123', 'user-2']
      );
    });

    it('should return false if participant not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 0 });

      const result = await Conversation.removeParticipant('conv-123', 'user-999');

      expect(result).toBe(false);
    });
  });

  describe('isParticipant', () => {
    it('should return true if user is participant', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [{ exists: true }] });

      const result = await Conversation.isParticipant('conv-123', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not participant', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Conversation.isParticipant('conv-123', 'user-999');

      expect(result).toBe(false);
    });
  });

  describe('touch', () => {
    it('should update conversation updated_at', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      await Conversation.touch('conv-123');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE conversations'), [
        'conv-123',
      ]);
    });
  });

  describe('getParticipantIds', () => {
    it('should return participant IDs', async () => {
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      });

      const result = await Conversation.getParticipantIds('conv-123');

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array if no participants', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await Conversation.getParticipantIds('conv-123');

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete conversation', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 1 });

      const result = await Conversation.delete('conv-123');

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM conversations WHERE id = $1', [
        'conv-123',
      ]);
    });

    it('should return false if conversation not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rowCount: 0 });

      const result = await Conversation.delete('non-existent');

      expect(result).toBe(false);
    });
  });
});
