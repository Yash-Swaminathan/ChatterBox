const { isOwnerOnlyMode, isOwner, canReach } = require('../services/ownerService');
const logger = require('../utils/logger');

function forbidden(req, res, message) {
  logger.warn('Request refused by owner-only mode', {
    userId: req.user?.userId,
    method: req.method,
    path: req.originalUrl,
  });

  return res.status(403).json({
    success: false,
    error: {
      code: 'OWNER_ONLY',
      message,
    },
  });
}

/**
 * In owner-only mode, allow the request only for the owner.
 * Must run after requireAuth.
 */
function requireOwnerInOwnerOnlyMode(req, res, next) {
  if (isOwnerOnlyMode() && !isOwner(req.user.userId)) {
    return forbidden(req, res, 'This action is not available');
  }
  return next();
}

/**
 * In owner-only mode, allow the request only if the target user is the requester
 * or the owner (or the requester is the owner).
 * Must run after requireAuth.
 * @param {Function} getTargetId - (req) => target user ID
 */
function requireReachableTarget(getTargetId) {
  return (req, res, next) => {
    if (!canReach(req.user.userId, getTargetId(req))) {
      return forbidden(req, res, 'You can only contact the site owner');
    }
    return next();
  };
}

module.exports = {
  requireOwnerInOwnerOnlyMode,
  requireReachableTarget,
};
