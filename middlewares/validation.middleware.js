/**
 * Validation Middleware
 * Basic validation helpers for request validation
 */

/**
 * Validate required fields in request body
 * @param {Array<String>} fields - Required field names
 * @returns {Function} Express middleware
 */
export function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];

    for (const field of fields) {
      if (!req.body[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean} Is valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate mobile number (Indian format)
 * @param {String} mobile - Mobile number to validate
 * @returns {Boolean} Is valid mobile
 */
export function isValidMobile(mobile) {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
}

/**
 * Validate ObjectId format
 * @param {String} id - ID to validate
 * @returns {Boolean} Is valid ObjectId
 */
export function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Validate pagination parameters
 * @returns {Function} Express middleware
 */
export function validatePagination() {
  return (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be greater than 0',
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100',
      });
    }

    req.pagination = { page, limit };
    next();
  };
}
