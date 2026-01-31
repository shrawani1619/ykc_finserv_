import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/user.model.js';

/**
 * Protect routes - Verify JWT token from cookies or Authorization header
 */
export const authenticate = async (req, res, next) => {
  try {
    let token;

    // Get token from cookies (preferred)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check if user still exists (using unified User model)
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists',
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active',
        });
      }

      // Attach full user object to request
      req.user = user;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    next(error);
  }
};
