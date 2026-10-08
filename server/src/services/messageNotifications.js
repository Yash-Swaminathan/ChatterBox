const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { getOwnerId } = require('./ownerService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Owner notifications: at most one per conversation per 10 minutes, and 30 per hour overall
const OWNER_CONVERSATION_COOLDOWN_SECONDS = 10 * 60;
const OWNER_HOURLY_LIMIT = 30;

// Visitor reply emails: at most one per conversation per 30 minutes
const VISITOR_EMAIL_COOLDOWN_SECONDS = 30 * 60;

// Remind the owner about a visitor who has waited this long without a reply
const REMINDER_DELAY_MINUTES = 90;
const REMINDER_SWEEP_INTERVAL_MS = 60 * 1000;
const REMINDERS_KEY = 'reminders:pending';

const UNSUBSCRIBE_PURPOSE = 'unsubscribe';

let sweepTimer = null;

/**
 * Whether a user currently has an open socket on this server
 * @param {string} userId
 * @returns {boolean}
 */
function isUserConnected(userId) {
  // Required lazily: the socket handlers load this module
  const { getUserSockets } = require('../socket/handlers/connectionHandler');
  return getUserSockets(userId).size > 0;
}

/**
 * Take a cooldown slot. Returns false while a previous slot is still active.
 * If Redis is unavailable the notification is allowed: missing one is worse than a duplicate.
 * @param {string} key
 * @param {number} seconds
 * @returns {Promise<boolean>}
 */
async function acquireCooldown(key, seconds) {
  try {
    const result = await redisClient.set(key, '1', { NX: true, EX: seconds });
    return result === 'OK';
  } catch (error) {
    logger.warn('Notification cooldown check failed, allowing', { key, error: error.message });
    return true;
  }
}

/**
 * Count this notification against the owner's hourly limit
 * @returns {Promise<boolean>} False once the limit is exceeded
 */
async function withinOwnerHourlyLimit() {
  try {
    const key = 'notify:owner:hourly';
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, 60 * 60);
    }
    return count <= OWNER_HOURLY_LIMIT;
  } catch (error) {
    logger.warn('Notification hourly limit check failed, allowing', { error: error.message });
    return true;
  }
}

async function getUsers(userIds) {
  const result = await pool.query(
    `SELECT id, username, display_name, email, email_notifications
     FROM users
     WHERE id = ANY($1)`,
    [userIds]
  );
  return result.rows;
}

async function isFirstMessageInConversation(conversationId, messageId) {
  const result = await pool.query(
    'SELECT 1 FROM messages WHERE conversation_id = $1 AND id <> $2 LIMIT 1',
    [conversationId, messageId]
  );
  return result.rows.length === 0;
}

/**
 * Signed token carried by the "stop these emails" link, so it works without logging in
 * @param {string} userId
 * @returns {string}
 */
function createUnsubscribeToken(userId) {
  return jwt.sign({ userId, purpose: UNSUBSCRIBE_PURPOSE }, process.env.JWT_ACCESS_SECRET);
}

/**
 * @param {string} token
 * @returns {string|null} The user ID, or null if the token is not a valid unsubscribe token
 */
function verifyUnsubscribeToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return decoded.purpose === UNSUBSCRIBE_PURPOSE ? decoded.userId : null;
  } catch {
    return null;
  }
}

function getUnsubscribeUrl(userId) {
  const base = (process.env.API_PUBLIC_URL || notificationService.getAppUrl()).replace(/\/+$/, '');
  return `${base}/api/users/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}

/**
 * A visitor wrote to the owner: notify the owner and start the reply reminder
 */
async function handleMessageToOwner({ message, conversationId, senderId }) {
  // First unanswered message starts the clock; later ones must not push it back
  try {
    const dueAt = Date.now() + REMINDER_DELAY_MINUTES * 60 * 1000;
    await redisClient.zAdd(REMINDERS_KEY, { score: dueAt, value: conversationId }, { NX: true });
  } catch (error) {
    logger.warn('Could not schedule reply reminder', { conversationId, error: error.message });
  }

  // If the owner has the app open they see it live, except for a brand new
  // conversation, which is worth a ping either way
  const ownerIsOnline = isUserConnected(getOwnerId());
  if (ownerIsOnline && !(await isFirstMessageInConversation(conversationId, message.id))) {
    return;
  }

  if (
    !(await acquireCooldown(
      `notify:owner:conv:${conversationId}`,
      OWNER_CONVERSATION_COOLDOWN_SECONDS
    ))
  ) {
    return;
  }
  if (!(await withinOwnerHourlyLimit())) {
    logger.warn('Owner notification skipped: hourly limit reached', { conversationId });
    return;
  }

  const [sender] = await getUsers([senderId]);
  await notificationService.notifyOwnerOfMessage({
    senderName: sender?.display_name || sender?.username || 'Someone',
    content: message.content,
  });

  logger.info('Owner notified of message', { conversationId, senderId });
}

/**
 * The owner wrote to visitors: cancel the reminder and email anyone who is away
 */
async function handleMessageFromOwner({ message, conversationId, senderId, recipientIds }) {
  try {
    await redisClient.zRem(REMINDERS_KEY, conversationId);
  } catch (error) {
    logger.warn('Could not cancel reply reminder', { conversationId, error: error.message });
  }

  const awayIds = recipientIds.filter(id => !isUserConnected(id));
  if (awayIds.length === 0) {
    return;
  }

  const users = await getUsers([senderId, ...awayIds]);
  const owner = users.find(u => u.id === senderId);
  const ownerName = owner?.display_name || owner?.username || 'The site owner';

  for (const recipient of users.filter(u => u.id !== senderId)) {
    if (!recipient.email || recipient.email_notifications === false) {
      continue;
    }
    if (
      !(await acquireCooldown(
        `notify:reply:${conversationId}:${recipient.id}`,
        VISITOR_EMAIL_COOLDOWN_SECONDS
      ))
    ) {
      continue;
    }

    const sent = await notificationService.notifyVisitorOfReply({
      to: recipient.email,
      ownerName,
      content: message.content,
      unsubscribeUrl: getUnsubscribeUrl(recipient.id),
    });

    if (sent) {
      logger.info('Visitor emailed about owner reply', { conversationId, userId: recipient.id });
    }
  }
}

/**
 * Called after a message has been saved and broadcast. Decides who, if anyone,
 * should be notified outside the app. Never throws.
 * @param {Object} event
 * @param {Object} event.message - Saved message ({ id, content, ... })
 * @param {string} event.conversationId
 * @param {string} event.senderId
 * @param {string[]} event.recipientIds - Participants other than the sender
 */
async function onMessageSent(event) {
  const ownerId = getOwnerId();
  if (!ownerId) {
    return;
  }

  try {
    if (event.senderId === ownerId) {
      await handleMessageFromOwner(event);
    } else if (event.recipientIds.includes(ownerId)) {
      await handleMessageToOwner(event);
    }
  } catch (error) {
    logger.error('Message notification failed', {
      conversationId: event.conversationId,
      error: error.message,
    });
  }
}

/**
 * Send reminders for every conversation whose reply is overdue. Never throws.
 * @returns {Promise<number>} How many reminders were sent
 */
async function sweepReminders() {
  const ownerId = getOwnerId();
  if (!ownerId) {
    return 0;
  }

  let sent = 0;

  try {
    const due = await redisClient.zRangeByScore(REMINDERS_KEY, 0, Date.now());

    for (const conversationId of due) {
      // Remove first, so a failure below cannot make the same reminder fire every minute
      const removed = await redisClient.zRem(REMINDERS_KEY, conversationId);
      if (!removed) {
        continue;
      }

      const result = await pool.query(
        `SELECT u.username, u.display_name
         FROM conversation_participants cp
         INNER JOIN users u ON u.id = cp.user_id
         WHERE cp.conversation_id = $1 AND cp.user_id <> $2 AND cp.left_at IS NULL
         LIMIT 1`,
        [conversationId, ownerId]
      );
      const visitor = result.rows[0];
      if (!visitor) {
        continue;
      }

      await notificationService.notifyOwnerReminder({
        senderName: visitor.display_name || visitor.username,
        minutesWaiting: REMINDER_DELAY_MINUTES,
      });
      sent++;

      logger.info('Owner reminded of unanswered conversation', { conversationId });
    }
  } catch (error) {
    logger.error('Reminder sweep failed', { error: error.message });
  }

  return sent;
}

/**
 * Start checking for overdue replies once a minute. Pending reminders live in
 * Redis, so they survive a restart.
 */
function startReminderSweep() {
  if (sweepTimer || !getOwnerId()) {
    return;
  }

  sweepTimer = setInterval(sweepReminders, REMINDER_SWEEP_INTERVAL_MS);
  // Do not keep the process alive just for this timer
  sweepTimer.unref();

  logger.info('Reply reminder sweep started', { delayMinutes: REMINDER_DELAY_MINUTES });
}

function stopReminderSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

module.exports = {
  onMessageSent,
  sweepReminders,
  startReminderSweep,
  stopReminderSweep,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  REMINDERS_KEY,
  REMINDER_DELAY_MINUTES,
};
