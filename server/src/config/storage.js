const Minio = require('minio');
const logger = require('../utils/logger');

/**
 * MinIO Storage Configuration
 * Provides S3-compatible object storage for file uploads (avatars, attachments, etc.)
 */

/**
 * MinIO client configuration
 * Uses environment variables for connection settings
 */
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT, 10) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  region: process.env.MINIO_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'chatterbox-avatars';

/**
 * Initialize MinIO bucket
 * Creates the bucket if it doesn't exist
 * Should be called on application startup
 *
 * @returns {Promise<void>}
 */
async function initializeBucket() {
  try {
    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket
      await minioClient.makeBucket(BUCKET_NAME, process.env.MINIO_REGION || 'us-east-1');
      logger.info('MinIO bucket created successfully', { bucket: BUCKET_NAME });

      // TODO: SECURITY ENHANCEMENT (Future)
      // Set bucket policy to private by default
      // Only allow authenticated access via pre-signed URLs
      // Priority: High (implement before production)

      // Set bucket to be publicly readable (for avatars)
      // In production, consider using pre-signed URLs instead
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      logger.info('MinIO bucket policy set to public read', { bucket: BUCKET_NAME });
    } else {
      logger.info('MinIO bucket already exists', { bucket: BUCKET_NAME });
    }
  } catch (error) {
    logger.error('Error initializing MinIO bucket', {
      bucket: BUCKET_NAME,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Upload a file to MinIO
 *
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} fileName - Unique file name (should include path)
 * @param {string} contentType - MIME type of the file
 * @param {Object} [metadata] - Optional metadata to attach to file
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadFile(fileBuffer, fileName, contentType, metadata = {}) {
  try {
    // Upload file to MinIO
    await minioClient.putObject(BUCKET_NAME, fileName, fileBuffer, fileBuffer.length, {
      'Content-Type': contentType,
      ...metadata,
    });

    // Construct public URL
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const fileUrl = `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${fileName}`;

    logger.info('File uploaded successfully to MinIO', {
      fileName,
      contentType,
      size: fileBuffer.length,
      url: fileUrl,
    });

    return fileUrl;
  } catch (error) {
    logger.error('Error uploading file to MinIO', {
      fileName,
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Delete a file from MinIO
 *
 * @param {string} fileName - File name/path to delete
 * @returns {Promise<boolean>} - True if deleted successfully, false if file didn't exist
 */
async function deleteFile(fileName) {
  try {
    // Check if file exists first
    try {
      await minioClient.statObject(BUCKET_NAME, fileName);
    } catch (error) {
      if (error.code === 'NotFound') {
        logger.warn('File not found in MinIO, skipping deletion', { fileName });
        return false;
      }
      throw error;
    }

    // Delete file
    await minioClient.removeObject(BUCKET_NAME, fileName);

    logger.info('File deleted successfully from MinIO', { fileName });
    return true;
  } catch (error) {
    logger.error('Error deleting file from MinIO', {
      fileName,
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Failed to delete file from storage');
  }
}

/**
 * Extract filename from MinIO URL
 *
 * @param {string} fileUrl - Full MinIO URL
 * @returns {string|null} - Extracted filename or null if invalid URL
 */
function getFileNameFromUrl(fileUrl) {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return null;
    }

    // Parse URL to extract filename
    // Example: http://localhost:9000/chatterbox-avatars/avatars/user-id/file.jpg
    // Result: avatars/user-id/file.jpg

    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');

    // Remove empty strings and bucket name
    const fileName = pathParts.slice(2).join('/'); // Skip first two parts (empty and bucket name)

    return fileName || null;
  } catch (error) {
    logger.warn('Failed to extract filename from URL', { fileUrl, error: error.message });
    return null;
  }
}

/**
 * Test MinIO connection
 * Useful for health checks and debugging
 *
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  try {
    // Try to list buckets as a connection test
    await minioClient.listBuckets();
    logger.info('MinIO connection successful');
    return true;
  } catch (error) {
    logger.error('MinIO connection failed', {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

/**
 * Get file metadata from MinIO
 *
 * @param {string} fileName - File name/path
 * @returns {Promise<Object|null>} - File metadata or null if not found
 */
async function getFileMetadata(fileName) {
  try {
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);
    return {
      size: stat.size,
      etag: stat.etag,
      lastModified: stat.lastModified,
      contentType: stat.metaData['content-type'],
    };
  } catch (error) {
    if (error.code === 'NotFound') {
      logger.warn('File not found in MinIO', { fileName });
      return null;
    }
    logger.error('Error getting file metadata from MinIO', {
      fileName,
      error: error.message,
    });
    throw error;
  }
}

// TODO: PERFORMANCE OPTIMIZATION (Future)
// Implement file streaming for large files
// Instead of loading entire file into memory, stream it directly
// Priority: Low (current max file size is 5MB, streaming not critical yet)

// TODO: FEATURE ENHANCEMENT (Future)
// Generate pre-signed URLs for private files
// Example: async function getPresignedUrl(fileName, expirySeconds = 3600)
// Priority: Medium (useful when implementing private attachments)

// TODO: MONITORING (Future)
// Track storage usage and set up alerts
// Monitor bucket size, file count, failed uploads
// Priority: Low (implement when scaling)

module.exports = {
  minioClient,
  BUCKET_NAME,
  initializeBucket,
  uploadFile,
  deleteFile,
  getFileNameFromUrl,
  testConnection,
  getFileMetadata,
};
