/**
 * Application Constants
 *
 * Centralized configuration values used throughout the application.
 */

module.exports = {
  // Group Conversation Limits
  MAX_GROUP_PARTICIPANTS: 100, // Industry standard (WhatsApp: 256, Telegram: 200k, Discord: no limit)
  MIN_GROUP_PARTICIPANTS: 3, // Minimum for group conversations (creator + 2 others)

  // Message Limits
  MAX_MESSAGE_LENGTH: 10000, // Maximum characters per message

  // File Upload Limits
  MAX_AVATAR_SIZE: 5 * 1024 * 1024, // 5MB for avatars
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB for file attachments

  // Pagination Defaults
  DEFAULT_PAGINATION_LIMIT: 50,
  MAX_PAGINATION_LIMIT: 100,

  // Rate Limiting (requests per window)
  RATE_LIMIT_AUTH: 5, // Login/register attempts
  RATE_LIMIT_API: 120, // General API requests
  RATE_LIMIT_MESSAGE: 30, // Message sending

  // Cache TTL (seconds)
  CACHE_TTL_USER_PROFILE: 3600, // 1 hour
  CACHE_TTL_CONVERSATION_LIST: 300, // 5 minutes
  CACHE_TTL_PRESENCE: 30, // 30 seconds
};
