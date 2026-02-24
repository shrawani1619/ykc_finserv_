
export function requireRole(...roles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      // Super admin has access to everything; regional_manager is scoped in controllers
      if (req.user.role === 'super_admin') {
        return next();
      }

      if (!roles.includes(req.user.role)) {
        console.log(`Role check failed: User ${req.user.email || req.user._id} has role '${req.user.role}', but required roles are: [${roles.join(', ')}]`);
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Your role: ${req.user.role}, Required: ${roles.join(' or ')}`,
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

      // Super admin has access; regional_manager checked in controller
      if (req.user.role === 'super_admin') {
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