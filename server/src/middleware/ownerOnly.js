const { isOwnerOnlyMode, isOwner, canReachAll } = require('../services/ownerService');
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
 * In owner-only mode, allow the request only if every target user is the requester,
 * the owner or an accepted connection (or the requester is the owner).
 * Must run after requireAuth.
 * @param {Function} getTargetIds - (req) => target user ID, or an array of them
 */
function requireReachableTarget(getTargetIds) {
  return async (req, res, next) => {
    try {
      const targetIds = [].concat(getTargetIds(req) ?? []);

      if (!(await canReachAll(req.user.userId, targetIds))) {
        return forbidden(req, res, 'You can only contact the site owner and your connections');
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requireOwnerInOwnerOnlyMode,
  requireReachableTarget,
};
