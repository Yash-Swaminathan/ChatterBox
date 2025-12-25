/**
 * Pagination utility functions
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_LIMIT = 1;
const DEFAULT_OFFSET = 0;
const MIN_OFFSET = 0;

/**
 * Extract and validate pagination parameters from request
 * @returns {Object} Validated pagination params { limit, offset }
 */
function getPaginationParams(req) {
  let limit = parseInt(req.query.limit, 10);
  let offset = parseInt(req.query.offset, 10);

  // Validate and apply defaults for limit
  if (isNaN(limit) || limit < MIN_LIMIT) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  // Validate and apply defaults for offset
  if (isNaN(offset) || offset < MIN_OFFSET) {
    offset = DEFAULT_OFFSET;
  }

  return { limit, offset };
}

/**
 * Create pagination response object
 * @param {number} total - Total number of items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @param {Array} data - Array of data items
 * @returns {Object} Response with data and pagination metadata
 */
function createPaginationResponse(total, limit, offset, data) {
  // Ensure total is a valid number
  const totalCount = parseInt(total, 10) || 0;

  // Calculate if there are more results
  const hasMore = offset + limit < totalCount;

  return {
    data,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore,
    },
  };
}

module.exports = {
  getPaginationParams,
  createPaginationResponse,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  DEFAULT_OFFSET,
};
