import User from '../models/user.model.js';
import Franchise from '../models/franchise.model.js';
import { getPaginationMeta } from '../utils/helpers.js';
import auditService from '../services/audit.service.js';
import { getRegionalManagerFranchiseIds, regionalManagerCanAccessFranchise } from '../utils/regionalScope.js';

/**
 * Get all users (role-based filtering)
 */
export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, status, franchiseId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === 'franchise') {
      query.franchise = req.user.franchise;
      query.role = 'agent';
    }
    if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds === null || franchiseIds.length === 0) {
        query._id = null;
      } else {
        query.$or = [
          { role: 'franchise', franchiseOwned: { $in: franchiseIds } },
          { role: 'agent', franchise: { $in: franchiseIds } },
        ];
      }
    }

    if (role) query.role = role;
    if (status) query.status = status;
    if (franchiseId) query.franchise = franchiseId;

    const users = await User.find(query)
      .select('-password')
      .populate('franchise', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const pagination = getPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: users,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('franchise', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds !== null && franchiseIds.length > 0) {
        const inScope =
          (user.role === 'franchise' && user.franchiseOwned && franchiseIds.some((fid) => fid.toString() === user.franchiseOwned.toString())) ||
          (user.role === 'agent' && user.franchise && franchiseIds.some((fid) => fid.toString() === user.franchise.toString()));
        if (!inScope) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view users from franchises associated with you.',
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create user (Admin/Manager)
 */
export const createUser = async (req, res, next) => {
  try {
    const { role, franchise, ...userData } = req.body;

    // Validate role
    const validRoles = ['super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'agent', 'accounts_manager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    if (['agent', 'franchise'].includes(role)) {
      if (!franchise) {
        return res.status(400).json({
          success: false,
          message: 'Franchise is required for this role',
        });
      }
      if (req.user.role === 'regional_manager') {
        const franchiseIds = await getRegionalManagerFranchiseIds(req);
        if (franchiseIds !== null && franchiseIds.length > 0) {
          const allowed = franchiseIds.some((fid) => fid.toString() === franchise.toString());
          if (!allowed) {
            return res.status(403).json({
              success: false,
              message: 'You can only create users for franchises associated with you.',
            });
          }
        }
      }
      userData.franchise = franchise;
    }

    userData.role = role;
    userData.createdBy = req.user._id;

    const user = await User.create(userData);

    // Log audit
    await auditService.logCreate(req.user._id, 'user', user._id, user.toObject(), req);

    const userResponse = await User.findById(user._id).select('-password').populate('franchise', 'name');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 */
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds !== null && franchiseIds.length > 0) {
        const inScope =
          (user.role === 'franchise' && user.franchiseOwned && franchiseIds.some((fid) => fid.toString() === user.franchiseOwned.toString())) ||
          (user.role === 'agent' && user.franchise && franchiseIds.some((fid) => fid.toString() === user.franchise.toString()));
        if (!inScope) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only update users from franchises associated with you.',
          });
        }
        if (req.body.franchise != null) {
          const newFranchiseAllowed = franchiseIds.some((fid) => fid.toString() === req.body.franchise.toString());
          if (!newFranchiseAllowed) {
            return res.status(403).json({
              success: false,
              message: 'You can only assign users to franchises associated with you.',
            });
          }
        }
      }
    }

    const previousValues = user.toObject();
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password').populate('franchise', 'name');

    // Log audit
    await auditService.logUpdate(req.user._id, 'user', updatedUser._id, previousValues, updatedUser.toObject(), req);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer agent between franchises
 */
export const transferAgent = async (req, res, next) => {
  try {
    const { franchiseId } = req.body;

    if (!franchiseId) {
      return res.status(400).json({
        success: false,
        message: 'Franchise ID is required',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'Only agents can be transferred',
      });
    }

    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const canAccessTarget = await regionalManagerCanAccessFranchise(req, franchiseId);
      const canAccessCurrent = await regionalManagerCanAccessFranchise(req, user.franchise);
      if (!canAccessTarget || !canAccessCurrent) {
        return res.status(403).json({
          success: false,
          message: 'You can only transfer agents between franchises associated with you.',
        });
      }
    }

    const previousValues = user.toObject();
    user.franchise = franchiseId;
    await user.save();

    // Log audit
    await auditService.logUpdate(req.user._id, 'user', user._id, previousValues, user.toObject(), req);

    const updatedUser = await User.findById(user._id).select('-password').populate('franchise', 'name');

    res.status(200).json({
      success: true,
      message: 'Agent transferred successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate/Deactivate user
 */
export const activateUser = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    if (req.user.role === 'regional_manager') {
      const franchiseIds = await getRegionalManagerFranchiseIds(req);
      if (franchiseIds !== null && franchiseIds.length > 0) {
        const inScope =
          (user.role === 'franchise' && user.franchiseOwned && franchiseIds.some((fid) => fid.toString() === user.franchiseOwned.toString())) ||
          (user.role === 'agent' && user.franchise && franchiseIds.some((fid) => fid.toString() === user.franchise.toString()));
        if (!inScope) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only activate/deactivate users from franchises associated with you.',
          });
        }
      }
    }

    const previousValues = user.toObject();
    user.status = status;
    await user.save();

    await auditService.logUpdate(req.user._id, 'user', user._id, previousValues, user.toObject(), req);

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
