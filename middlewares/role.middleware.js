
export function requireRole(...roles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      // Super admin has access to everything
      if (req.user.role === 'super_admin') {
        return next();
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}


export function requirePermission(permission) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      // Super admin has all permissions
      if (req.user.role === 'super_admin') {
        return next();
      }

      // Check if user has permission
      if (!req.user.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user owns the resource or has admin role
 * @param {Function} ownerCheckFn - Function that checks ownership
 * @returns {Function} Express middleware
 */
export function requireOwnershipOrRole(ownerCheckFn) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      // Super admin and franchise manager have access
      if (['super_admin', 'franchise_manager'].includes(req.user.role)) {
        return next();
      }

      // Check ownership
      const isOwner = await ownerCheckFn(req);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Default export for backward compatibility
export default requireRole;