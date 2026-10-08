jest.mock('../../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../notificationService', () => ({
  getAppUrl: jest.fn(() => 'https://chat.example.com'),
  notifyOwnerOfMessage: jest.fn().mockResolvedValue(undefined),
  notifyOwnerReminder: jest.fn().mockResolvedValue(undefined),
  notifyVisitorOfReply: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../socket/handlers/connectionHandler', () => ({
  getUserSockets: jest.fn(() => new Set()),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { pool } = require('../../config/database');
const { redisClient } = require('../../config/redis');
const notificationService = require('../notificationService');
const { getUserSockets } = require('../../socket/handlers/connectionHandler');
const messageNotifications = require('../messageNotifications');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';

const owner = {
  id: OWNER_ID,
  username: 'yash',
  display_name: 'Yash',
  email: 'owner@example.com',
  email_notifications: true,
};
const visitor = {
  id: VISITOR_ID,
  username: 'sam',
  display_name: 'Sam',
  email: 'sam@example.com',
  email_notifications: true,
};

describe('messageNotifications', () => {
  const originalEnv = { ...process.env };
  const message = { id: 'message-1', content: 'Hello there' };

  // Answers the two kinds of query the module makes
  function mockDatabase({ users = [owner, visitor], earlierMessages = false } = {}) {
    pool.query.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM users')) {
        return { rows: users.filter(u => params[0].includes(u.id)) };
      }
      if (sql.includes('FROM messages')) {
        return { rows: earlierMessages ? [{}] : [] };
      }
      if (sql.includes('FROM conversation_participants')) {
        return { rows: [{ username: visitor.username, display_name: visitor.display_name }] };
      }
      return { rows: [] };
    });
  }

  const online = (...userIds) =>
    getUserSockets.mockImplementation(id => (userIds.includes(id) ? new Set(['socket']) : new Set()));

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_USER_ID = OWNER_ID;
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret';

    redisClient.set.mockResolvedValue('OK');
    redisClient.incr.mockResolvedValue(1);
    redisClient.zAdd.mockResolvedValue(1);
    redisClient.zRem.mockResolvedValue(1);
    redisClient.zRangeByScore = jest.fn().mockResolvedValue([]);

    online();
    mockDatabase();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const fromVisitor = () =>
    messageNotifications.onMessageSent({
      message,
      conversationId: CONVERSATION_ID,
      senderId: VISITOR_ID,
      recipientIds: [OWNER_ID],
    });

  const fromOwner = () =>
    messageNotifications.onMessageSent({
      message,
      conversationId: CONVERSATION_ID,
      senderId: OWNER_ID,
      recipientIds: [VISITOR_ID],
    });

  describe('when no owner is configured', () => {
    it('should do nothing', async () => {
      delete process.env.OWNER_USER_ID;

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).not.toHaveBeenCalled();
      expect(redisClient.zAdd).not.toHaveBeenCalled();
    });
  });

  describe('a visitor messages the owner', () => {
    it('should notify the owner when the owner is offline', async () => {
      mockDatabase({ earlierMessages: true });

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).toHaveBeenCalledWith({
        senderName: 'Sam',
        content: 'Hello there',
      });
    });

    it('should schedule a reminder 90 minutes out without replacing an existing one', async () => {
      const before = Date.now();

      await fromVisitor();

      const [key, entry, options] = redisClient.zAdd.mock.calls[0];
      expect(key).toBe(messageNotifications.REMINDERS_KEY);
      expect(entry.value).toBe(CONVERSATION_ID);
      expect(entry.score).toBeGreaterThanOrEqual(before + 90 * 60 * 1000);
      expect(options).toEqual({ NX: true });
    });

    it('should not notify an online owner about an ongoing conversation', async () => {
      online(OWNER_ID);
      mockDatabase({ earlierMessages: true });

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).not.toHaveBeenCalled();
    });

    it('should notify an online owner about the first message of a conversation', async () => {
      online(OWNER_ID);
      mockDatabase({ earlierMessages: false });

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).toHaveBeenCalled();
    });

    it('should not notify again during the per-conversation cooldown', async () => {
      redisClient.set.mockResolvedValue(null);

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).not.toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        `notify:owner:conv:${CONVERSATION_ID}`,
        '1',
        { NX: true, EX: 600 }
      );
    });

    it('should stop notifying once the hourly limit is exceeded', async () => {
      redisClient.incr.mockResolvedValue(31);

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).not.toHaveBeenCalled();
    });

    it('should still notify when Redis is unavailable', async () => {
      redisClient.set.mockRejectedValue(new Error('The client is closed'));
      redisClient.incr.mockRejectedValue(new Error('The client is closed'));
      redisClient.zAdd.mockRejectedValue(new Error('The client is closed'));

      await fromVisitor();

      expect(notificationService.notifyOwnerOfMessage).toHaveBeenCalled();
    });

    it('should not throw when sending fails', async () => {
      notificationService.notifyOwnerOfMessage.mockRejectedValueOnce(new Error('boom'));

      await expect(fromVisitor()).resolves.toBeUndefined();
    });
  });

  describe('a visitor messages another visitor', () => {
    it('should not notify anyone', async () => {
      await messageNotifications.onMessageSent({
        message,
        conversationId: CONVERSATION_ID,
        senderId: VISITOR_ID,
        recipientIds: ['44444444-4444-4444-8444-444444444444'],
      });

      expect(notificationService.notifyOwnerOfMessage).not.toHaveBeenCalled();
      expect(notificationService.notifyVisitorOfReply).not.toHaveBeenCalled();
    });
  });

  describe('the owner replies', () => {
    it('should cancel the pending reminder', async () => {
      await fromOwner();

      expect(redisClient.zRem).toHaveBeenCalledWith(
        messageNotifications.REMINDERS_KEY,
        CONVERSATION_ID
      );
    });

    it('should email a visitor who is away, with a working unsubscribe link', async () => {
      await fromOwner();

      expect(notificationService.notifyVisitorOfReply).toHaveBeenCalledTimes(1);
      const call = notificationService.notifyVisitorOfReply.mock.calls[0][0];
      expect(call.to).toBe('sam@example.com');
      expect(call.ownerName).toBe('Yash');
      expect(call.content).toBe('Hello there');

      const token = new URL(call.unsubscribeUrl).searchParams.get('token');
      expect(call.unsubscribeUrl).toMatch(/^https:\/\/chat\.example\.com\/api\/users\/unsubscribe/);
      expect(messageNotifications.verifyUnsubscribeToken(token)).toBe(VISITOR_ID);
    });

    it('should not email a visitor who has the app open', async () => {
      online(VISITOR_ID);

      await fromOwner();

      expect(notificationService.notifyVisitorOfReply).not.toHaveBeenCalled();
    });

    it('should not email a visitor who unsubscribed', async () => {
      mockDatabase({ users: [owner, { ...visitor, email_notifications: false }] });

      await fromOwner();

      expect(notificationService.notifyVisitorOfReply).not.toHaveBeenCalled();
    });

    it('should not email again during the cooldown', async () => {
      redisClient.set.mockResolvedValue(null);

      await fromOwner();

      expect(notificationService.notifyVisitorOfReply).not.toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        `notify:reply:${CONVERSATION_ID}:${VISITOR_ID}`,
        '1',
        { NX: true, EX: 1800 }
      );
    });
  });

  describe('unsubscribe tokens', () => {
    it('should round-trip a user ID', () => {
      const token = messageNotifications.createUnsubscribeToken(VISITOR_ID);

      expect(messageNotifications.verifyUnsubscribeToken(token)).toBe(VISITOR_ID);
    });

    it('should reject garbage', () => {
      expect(messageNotifications.verifyUnsubscribeToken('not-a-token')).toBeNull();
      expect(messageNotifications.verifyUnsubscribeToken('')).toBeNull();
    });

    it('should reject an ordinary access token', () => {
      const { generateAccessToken } = require('../../utils/jwt');

      const accessToken = generateAccessToken({ userId: VISITOR_ID });

      expect(messageNotifications.verifyUnsubscribeToken(accessToken)).toBeNull();
    });
  });

  describe('sweepReminders', () => {
    it('should send nothing when nothing is due', async () => {
      await expect(messageNotifications.sweepReminders()).resolves.toBe(0);
      expect(notificationService.notifyOwnerReminder).not.toHaveBeenCalled();
    });

    it('should only ask Redis for reminders that are due now', async () => {
      const before = Date.now();

      await messageNotifications.sweepReminders();

      const [key, min, max] = redisClient.zRangeByScore.mock.calls[0];
      expect(key).toBe(messageNotifications.REMINDERS_KEY);
      expect(min).toBe(0);
      expect(max).toBeGreaterThanOrEqual(before);
      expect(max).toBeLessThanOrEqual(Date.now());
    });

    it('should remind the owner once and remove the reminder', async () => {
      redisClient.zRangeByScore.mockResolvedValue([CONVERSATION_ID]);

      const sent = await messageNotifications.sweepReminders();

      expect(sent).toBe(1);
      expect(redisClient.zRem).toHaveBeenCalledWith(
        messageNotifications.REMINDERS_KEY,
        CONVERSATION_ID
      );
      expect(notificationService.notifyOwnerReminder).toHaveBeenCalledWith({
        senderName: 'Sam',
        minutesWaiting: 90,
      });
    });

    it('should skip a reminder that was cancelled in the meantime', async () => {
      redisClient.zRangeByScore.mockResolvedValue([CONVERSATION_ID]);
      redisClient.zRem.mockResolvedValue(0);

      const sent = await messageNotifications.sweepReminders();

      expect(sent).toBe(0);
      expect(notificationService.notifyOwnerReminder).not.toHaveBeenCalled();
    });

    it('should not throw when Redis fails', async () => {
      redisClient.zRangeByScore.mockRejectedValue(new Error('The client is closed'));

      await expect(messageNotifications.sweepReminders()).resolves.toBe(0);
    });

    it('should do nothing when no owner is configured', async () => {
      delete process.env.OWNER_USER_ID;

      await expect(messageNotifications.sweepReminders()).resolves.toBe(0);
      expect(redisClient.zRangeByScore).not.toHaveBeenCalled();
    });
  });
});
