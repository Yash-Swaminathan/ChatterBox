const multer = require('multer');
const logger = require('../utils/logger');

/**
 * File Upload Middleware using Multer
 * Handles multipart/form-data file uploads with validation
 */

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * File filter function for Multer
 * Validates file type and rejects invalid files
 */
function fileFilter(req, file, cb) {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    logger.warn('Invalid file type attempted upload', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      userId: req.user?.userId,
    });

    const error = new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Extract file extension
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    logger.warn('Invalid file extension attempted upload', {
      extension: ext,
      originalname: file.originalname,
      userId: req.user?.userId,
    });

    const error = new Error(
      'Invalid file extension. Only .jpg, .jpeg, .png, and .gif are allowed.'
    );
    error.code = 'INVALID_FILE_EXTENSION';
    return cb(error, false);
  }

  // TODO: SECURITY ENHANCEMENT (Future)
  // Validate file content (magic bytes) to prevent MIME type spoofing
  // Use 'file-type' npm package to check actual file type from buffer
  // Example:
  // const fileType = await FileType.fromBuffer(file.buffer);
  // if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
  //   return cb(new Error('File content does not match MIME type'), false);
  // }
  // Priority: Medium (implement if abuse detected)

  // Accept file
  cb(null, true);
}

/**
 * Multer configuration for avatar uploads
 * Uses memory storage to buffer files before uploading to MinIO
 */
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory, then upload to MinIO
  limits: {
    fileSize: MAX_FILE_SIZE, // 5MB
    files: 1, // Only accept one file per request
    fields: 1, // Only accept the file field
  },
  fileFilter: fileFilter,
});

/**
 * Middleware to handle single avatar upload
 * Expects field name "avatar" in multipart/form-data
 */
const uploadAvatar = upload.single('avatar');

/**
 * Error handling middleware for Multer errors
 * Converts Multer errors to consistent error responses
 */
function handleUploadError(err, req, res, next) {
  // If no error, continue to next middleware
  if (!err) {
    return next();
  }

  logger.error('File upload error', {
    error: err.message,
    code: err.code,
    userId: req.user?.userId,
  });

  // Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Only one file can be uploaded at a time',
        },
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNEXPECTED_FIELD',
          message: 'Unexpected field in upload. Use "avatar" as the field name.',
        },
      });
    }

    // Generic Multer error
    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message || 'File upload failed',
      },
    });
  }

  // Handle custom file filter errors
  if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_FILE_EXTENSION') {
    return res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Handle unexpected errors
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred during file upload',
    },
  });
}

/**
 * Validate that a file was uploaded
 * Use this middleware after uploadAvatar to ensure file exists
 */
function validateFileExists(req, res, next) {
  if (!req.file) {
    logger.warn('No file provided in upload request', {
      userId: req.user?.userId,
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_FILE_PROVIDED',
        message: 'Please provide an avatar file',
      },
    });
  }

  // Log successful file upload
  logger.info('File uploaded to memory storage', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    userId: req.user?.userId,
  });

  next();
}

// TODO: PERFORMANCE OPTIMIZATION (Future)
// Implement image compression/resizing middleware
// Use 'sharp' npm package to:
// - Resize images to max 512x512 (avatars don't need to be huge)
// - Compress JPEG quality to 85%
// - Convert to WebP format for better compression
// - Generate multiple sizes (large, medium, small)
// Priority: Medium (implement when storage costs increase)

// TODO: SECURITY ENHANCEMENT (Future)
// Remove EXIF data from images to protect user privacy
// EXIF data can contain location, device info, timestamps
// Use 'sharp' to strip metadata
// Priority: Medium (nice-to-have for privacy)

module.exports = {
  uploadAvatar,
  handleUploadError,
  validateFileExists,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
};
