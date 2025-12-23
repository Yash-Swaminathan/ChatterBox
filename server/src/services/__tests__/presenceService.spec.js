const presenceService = require('../presenceService');
const { redisClient } = require('../../config/redis');
const { pool } = require('../../config/database');

jest.mock('../../config/redis');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('presenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setUserOnline', () => {
    it('should set user as online in Redis', async () => {
      redisClient.setEx = jest.fn().mockResolvedValue('OK');
      redisClient.sAdd = jest.fn().mockResolvedValue(1);

      const result = await presenceService.setUserOnline('user-123', 'socket-456');

      expect(result).toBe(true);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'presence:user-123',
        60,
        expect.stringContaining('"status":"online"')
      );
      expect(redisClient.sAdd).toHaveBeenCalledWith('user:sockets:user-123', 'socket-456');
    });

    it('should return false on Redis error', async () => {
      redisClient.setEx = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.setUserOnline('user-123', 'socket-456');

      expect(result).toBe(false);
    });
  });

  describe('setUserOffline', () => {
    it('should set user as offline when last socket disconnects', async () => {
      redisClient.sRem = jest.fn().mockResolvedValue(1);
      redisClient.sCard = jest.fn().mockResolvedValue(0);
      redisClient.setEx = jest.fn().mockResolvedValue('OK');

      const result = await presenceService.setUserOffline('user-123', 'socket-456');

      expect(result).toBe(true);
      expect(redisClient.sRem).toHaveBeenCalledWith('user:sockets:user-123', 'socket-456');
      expect(redisClient.sCard).toHaveBeenCalledWith('user:sockets:user-123');
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'presence:user-123',
        60,
        expect.stringContaining('"status":"offline"')
      );
    });

    it('should not set offline if user has remaining sockets', async () => {
      redisClient.sRem = jest.fn().mockResolvedValue(1);
      redisClient.sCard = jest.fn().mockResolvedValue(2);

      const result = await presenceService.setUserOffline('user-123', 'socket-456');

      expect(result).toBe(false);
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    it('should return false if socket was not found', async () => {
      redisClient.sRem = jest.fn().mockResolvedValue(0);

      const result = await presenceService.setUserOffline('user-123', 'socket-456');

      expect(result).toBe(false);
      expect(redisClient.sCard).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      redisClient.sRem = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.setUserOffline('user-123', 'socket-456');

      expect(result).toBe(false);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status to away', async () => {
      const currentPresence = {
        status: 'online',
        timestamp: '2025-01-01T00:00:00Z',
        socketId: 'socket-123',
      };

      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(currentPresence));
      redisClient.setEx = jest.fn().mockResolvedValue('OK');

      const result = await presenceService.updateUserStatus('user-123', 'away');

      expect(result).toBeTruthy();
      expect(result.status).toBe('away');
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'presence:user-123',
        60,
        expect.stringContaining('"status":"away"')
      );
    });

    it('should reject invalid status', async () => {
      const result = await presenceService.updateUserStatus('user-123', 'invalid');

      expect(result).toBeNull();
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    it('should return null if user is not online', async () => {
      redisClient.get = jest.fn().mockResolvedValue(null);

      const result = await presenceService.updateUserStatus('user-123', 'away');

      expect(result).toBeNull();
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    it('should handle all valid statuses', async () => {
      const currentPresence = { status: 'online', timestamp: '2025-01-01T00:00:00Z' };
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(currentPresence));
      redisClient.setEx = jest.fn().mockResolvedValue('OK');

      for (const status of ['online', 'away', 'busy', 'offline']) {
        const result = await presenceService.updateUserStatus('user-123', status);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('getUserPresence', () => {
    it('should return parsed presence data', async () => {
      const presence = {
        status: 'online',
        timestamp: '2025-01-01T00:00:00Z',
        socketId: 'socket-123',
      };

      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(presence));

      const result = await presenceService.getUserPresence('user-123');

      expect(result).toEqual(presence);
      expect(redisClient.get).toHaveBeenCalledWith('presence:user-123');
    });

    it('should return null if user not in Redis', async () => {
      redisClient.get = jest.fn().mockResolvedValue(null);

      const result = await presenceService.getUserPresence('user-123');

      expect(result).toBeNull();
    });

    it('should handle Redis errors', async () => {
      redisClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.getUserPresence('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getBulkPresence', () => {
    it('should fetch presence for multiple users', async () => {
      const presences = [
        JSON.stringify({ status: 'online', timestamp: '2025-01-01T00:00:00Z' }),
        JSON.stringify({ status: 'away', timestamp: '2025-01-01T00:00:00Z' }),
        null,
      ];

      redisClient.mGet = jest.fn().mockResolvedValue(presences);

      const result = await presenceService.getBulkPresence(['user-1', 'user-2', 'user-3']);

      expect(result).toEqual({
        'user-1': { status: 'online', timestamp: '2025-01-01T00:00:00Z' },
        'user-2': { status: 'away', timestamp: '2025-01-01T00:00:00Z' },
        'user-3': null,
      });

      expect(redisClient.mGet).toHaveBeenCalledWith([
        'presence:user-1',
        'presence:user-2',
        'presence:user-3',
      ]);
    });

    it('should return empty object for empty input', async () => {
      const result = await presenceService.getBulkPresence([]);

      expect(result).toEqual({});
      expect(redisClient.mGet).not.toHaveBeenCalled();
    });

    it('should handle parse errors gracefully', async () => {
      redisClient.mGet = jest.fn().mockResolvedValue(['invalid-json']);

      const result = await presenceService.getBulkPresence(['user-1']);

      expect(result['user-1']).toBeNull();
    });

    it('should handle Redis errors', async () => {
      redisClient.mGet = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.getBulkPresence(['user-1']);

      expect(result).toEqual({});
    });
  });

  describe('refreshHeartbeat', () => {
    it('should refresh TTL for active socket', async () => {
      redisClient.sIsMember = jest.fn().mockResolvedValue(true);
      redisClient.expire = jest.fn().mockResolvedValue(1);

      const result = await presenceService.refreshHeartbeat('user-123', 'socket-456');

      expect(result).toBe(true);
      expect(redisClient.sIsMember).toHaveBeenCalledWith('user:sockets:user-123', 'socket-456');
      expect(redisClient.expire).toHaveBeenCalledWith('presence:user-123', 60);
    });

    it('should reject heartbeat for non-existent socket', async () => {
      redisClient.sIsMember = jest.fn().mockResolvedValue(false);

      const result = await presenceService.refreshHeartbeat('user-123', 'socket-456');

      expect(result).toBe(false);
      expect(redisClient.expire).not.toHaveBeenCalled();
    });

    it('should return false if expire fails', async () => {
      redisClient.sIsMember = jest.fn().mockResolvedValue(true);
      redisClient.expire = jest.fn().mockResolvedValue(0);

      const result = await presenceService.refreshHeartbeat('user-123', 'socket-456');

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      redisClient.sIsMember = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.refreshHeartbeat('user-123', 'socket-456');

      expect(result).toBe(false);
    });
  });

  describe('getUserContacts', () => {
    it('should return cached contacts', async () => {
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(['user-2', 'user-3']));
      pool.query = jest.fn();

      const result = await presenceService.getUserContacts('user-1');

      expect(result).toEqual(['user-2', 'user-3']);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      redisClient.get = jest.fn().mockResolvedValue(null);
      redisClient.setEx = jest.fn().mockResolvedValue('OK');
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ contact_user_id: 'user-2' }, { contact_user_id: 'user-3' }],
      });

      const result = await presenceService.getUserContacts('user-1');

      expect(result).toEqual(['user-2', 'user-3']);
      expect(pool.query).toHaveBeenCalled();
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'user:contacts:user-1',
        300,
        JSON.stringify(['user-2', 'user-3'])
      );
    });

    it('should return empty array if contacts table does not exist', async () => {
      redisClient.get = jest.fn().mockResolvedValue(null);
      pool.query = jest.fn().mockRejectedValue({ code: '42P01' });

      const result = await presenceService.getUserContacts('user-1');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      redisClient.get = jest.fn().mockResolvedValue(null);
      pool.query = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(presenceService.getUserContacts('user-1')).rejects.toThrow('DB error');
    });
  });

  describe('getOnlineContacts', () => {
    it('should return online contacts only', async () => {
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(['user-2', 'user-3', 'user-4']));
      redisClient.mGet = jest
        .fn()
        .mockResolvedValue([
          JSON.stringify({ status: 'online', timestamp: '2025-01-01T00:00:00Z' }),
          JSON.stringify({ status: 'offline', timestamp: '2025-01-01T00:00:00Z' }),
          JSON.stringify({ status: 'away', timestamp: '2025-01-01T00:00:00Z' }),
        ]);

      const result = await presenceService.getOnlineContacts('user-1');

      expect(result).toEqual({
        'user-2': { status: 'online', timestamp: '2025-01-01T00:00:00Z' },
        'user-4': { status: 'away', timestamp: '2025-01-01T00:00:00Z' },
      });
    });

    it('should return empty object if no contacts', async () => {
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify([]));

      const result = await presenceService.getOnlineContacts('user-1');

      expect(result).toEqual({});
    });

    it('should handle errors gracefully', async () => {
      redisClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.getOnlineContacts('user-1');

      expect(result).toEqual({});
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should clean up stale socket sets', async () => {
      redisClient.scan = jest
        .fn()
        .mockResolvedValueOnce({
          cursor: '10',
          keys: ['user:sockets:user-1', 'user:sockets:user-2'],
        })
        .mockResolvedValueOnce({
          cursor: '0',
          keys: ['user:sockets:user-3'],
        });

      redisClient.get = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ status: 'online' }))
        .mockResolvedValueOnce(null);

      redisClient.del = jest.fn().mockResolvedValue(1);

      const result = await presenceService.cleanupStaleConnections();

      expect(result).toBe(2);
      expect(redisClient.del).toHaveBeenCalledTimes(2);
      expect(redisClient.del).toHaveBeenCalledWith('user:sockets:user-1');
      expect(redisClient.del).toHaveBeenCalledWith('user:sockets:user-3');
    });

    it('should handle Redis errors', async () => {
      redisClient.scan = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.cleanupStaleConnections();

      expect(result).toBe(0);
    });
  });

  describe('invalidateContactCache', () => {
    it('should delete contact cache', async () => {
      redisClient.del = jest.fn().mockResolvedValue(1);

      const result = await presenceService.invalidateContactCache('user-123');

      expect(result).toBe(true);
      expect(redisClient.del).toHaveBeenCalledWith('user:contacts:user-123');
    });

    it('should handle Redis errors', async () => {
      redisClient.del = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await presenceService.invalidateContactCache('user-123');

      expect(result).toBe(false);
    });
  });
});
