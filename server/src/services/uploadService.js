const { v4: uuidv4 } = require('uuid');
const { uploadFile, deleteFile, getFileNameFromUrl } = require('../config/storage');
const logger = require('../utils/logger');

/**
 * Upload Service
 * Handles file upload operations for avatars and other file types
 */

/**
 * Upload avatar for a user
 * Generates unique filename, uploads to MinIO, and returns public URL
 *
 * @param {Buffer} fileBuffer - File data from Multer
 * @param {string} userId - User ID (UUID)
 * @param {string} mimetype - MIME type of the file
 * @param {string} originalname - Original filename from client
 * @returns {Promise<string>} - Public URL of uploaded avatar
 * @throws {Error} - If upload fails
 */
async function uploadAvatar(fileBuffer, userId, mimetype, originalname) {
  try {
    // Validate inputs
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      logger.error('Invalid file buffer provided', { userId });
      throw new Error('Invalid file buffer');
    }

    if (!userId || typeof userId !== 'string') {
      logger.error('Invalid user ID provided for avatar upload');
      throw new Error('Invalid user ID');
    }

    // Generate unique filename
    const filename = generateAvatarFilename(userId, originalname);

    logger.info('Uploading avatar to MinIO', {
      userId,
      filename,
      mimetype,
      size: fileBuffer.length,
    });

    // Upload to MinIO
    const fileUrl = await uploadFile(fileBuffer, filename, mimetype, {
      'x-amz-meta-user-id': userId,
      'x-amz-meta-original-name': originalname,
      'x-amz-meta-upload-timestamp': new Date().toISOString(),
    });

    logger.info('Avatar uploaded successfully', {
      userId,
      filename,
      url: fileUrl,
    });

    return fileUrl;
  } catch (error) {
    logger.error('Failed to upload avatar', {
      userId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Failed to upload avatar. Please try again.');
  }
}

/**
 * Delete avatar from storage
 * Extracts filename from URL and deletes from MinIO
 *
 * @param {string} avatarUrl - Full URL of the avatar to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function deleteAvatar(avatarUrl) {
  try {
    // Validate URL
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      logger.warn('Invalid avatar URL provided for deletion', { avatarUrl });
      return false;
    }

    // Extract filename from URL
    const filename = getFileNameFromUrl(avatarUrl);

    if (!filename) {
      logger.warn('Could not extract filename from avatar URL', { avatarUrl });
      return false;
    }

    logger.info('Deleting avatar from MinIO', { filename, avatarUrl });

    // Delete from MinIO
    const deleted = await deleteFile(filename);

    if (deleted) {
      logger.info('Avatar deleted successfully', { filename });
    } else {
      logger.warn('Avatar not found in storage', { filename });
    }

    return deleted;
  } catch (error) {
    // Log error but don't throw - deletion failure shouldn't block avatar update
    logger.error('Failed to delete avatar', {
      avatarUrl,
      error: error.message,
      stack: error.stack,
    });

    // TODO: MONITORING (Future)
    // Track failed deletions and set up cleanup job
    // Orphaned files waste storage space
    // Consider implementing a scheduled cleanup task
    // Priority: Low (implement when storage costs become significant)

    return false;
  }
}

/**
 * Generate unique filename for avatar
 * Format: avatars/{userId}/{uuid}-{timestamp}.{extension}
 *
 * @param {string} userId - User ID
 * @param {string} originalname - Original filename from client
 * @returns {string} - Unique filename for storage
 */
function generateAvatarFilename(userId, originalname) {
  try {
    // Validate inputs
    if (!userId || !originalname) {
      throw new Error('userId and originalname are required');
    }

    // Extract file extension (lowercase)
    // Handle files without extensions by defaulting to .jpg
    const lastDotIndex = originalname.lastIndexOf('.');
    const ext = lastDotIndex !== -1
      ? originalname.toLowerCase().substring(lastDotIndex)
      : '.jpg'; // Default extension for files without one

    // Generate unique ID
    const uniqueId = uuidv4();

    // Add timestamp for additional uniqueness
    const timestamp = Date.now();

    // Construct filename: avatars/user-id/uuid-timestamp.ext
    const filename = `avatars/${userId}/${uniqueId}-${timestamp}${ext}`;

    return filename;
  } catch (error) {
    logger.error('Failed to generate avatar filename', {
      userId,
      originalname,
      error: error.message,
    });
    throw new Error('Failed to generate filename');
  }
}

/**
 * Validate file buffer
 * Checks if buffer is valid and within size limits
 *
 * @param {Buffer} fileBuffer - File buffer to validate
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} - True if valid
 * @throws {Error} - If invalid
 */
function validateFileBuffer(fileBuffer, maxSize = 5 * 1024 * 1024) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Invalid file buffer');
  }

  if (fileBuffer.length === 0) {
    throw new Error('File is empty');
  }

  if (fileBuffer.length > maxSize) {
    throw new Error(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
  }

  return true;
}

// TODO: FEATURE ENHANCEMENT (Future)
// Implement multi-file upload for message attachments
// async function uploadAttachment(fileBuffer, userId, conversationId, mimetype, originalname)
// Support for: images, documents, videos, audio
// Priority: Medium (implement when adding file sharing to messages)

// TODO: PERFORMANCE OPTIMIZATION (Future)
// Implement thumbnail generation for images
// Generate multiple sizes: large (512x512), medium (128x128), small (48x48)
// Use 'sharp' npm package for image processing
// Store thumbnails alongside original files
// Priority: Low (optimize for performance later)

// TODO: SECURITY ENHANCEMENT (Future)
// Implement virus scanning on uploaded files
// Integrate with ClamAV or cloud-based virus scanner
// Scan files before storing in MinIO
// Priority: High (critical for production)

module.exports = {
  uploadAvatar,
  deleteAvatar,
  generateAvatarFilename,
  validateFileBuffer,
};
